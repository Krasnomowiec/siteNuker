import type { StorageSchema } from '@/shared/types';
import { readStorage, writeStorage } from '@/shared/storage';
import { DOMAIN_ALIASES, HARD_CAP_SECONDS, LIMIT_STEP, LIMIT_MAX, LIMIT_MIN, NUCLEAR_TIME_OPTIONS } from '@/shared/constants';
import { extractDomain, findMatchingSite, getTodayKey, getDateKey } from '@/shared/utils';
import {
  addSiteBlockRule,
  removeSiteBlockRule,
  addNuclearRules,
  removeNuclearRules,
  removeAllRules,
  reconcileRules,
  isDomainBlocked,
} from '@/shared/blocking';
import {
  type DomainSession,
  getSessionElapsed as _getSessionElapsed,
  getUsedSeconds as _getUsedSeconds,
  createWriteLock,
  createSelfWriteTracker,
  buildBlockedDomainsSet,
  accumulateSessionUsage,
  pruneHistory,
} from '@/shared/backgroundHelpers';

const FLUSH_INTERVAL_TICKS = 5;
const DATE_CHECK_INTERVAL_TICKS = 60;
/** If elapsed time since last session start exceeds this, system likely slept */
const MAX_ELAPSED_SECONDS = FLUSH_INTERVAL_TICKS * 2 + 2;

export default defineBackground(() => {
  // --- Per-domain session tracking ---

  /** Active sessions — one per tracked domain that has open tabs */
  const trackedSessions = new Map<string, DomainSession>();
  /** Reverse lookup: tabId → domain currently tracked in that tab */
  const tabDomainMap = new Map<number, string>();
  /** Active tab — used only for badge display */
  let activeTabId: number | null = null;
  let activeDomain: string | null = null;

  let tickCount = 0;
  let cachedStorage: StorageSchema | null = null;
  let currentDateKey = getTodayKey();

  const selfWrites = createSelfWriteTracker();
  const { withLock: withWriteLock } = createWriteLock();

  /** Domains blocked by site-level rules (limit exceeded) */
  const blockedDomains = new Set<string>();
  /** Resolves when background init is complete (storage loaded, rules reconciled) */
  let resolveInit!: () => void;
  const initReady: Promise<void> = new Promise((r) => {
    resolveInit = r;
  });

  // --- Helpers ---

  function getSessionElapsed(session: DomainSession): number {
    return _getSessionElapsed(session, MAX_ELAPSED_SECONDS);
  }

  function getUsedSeconds(domain: string): number {
    return _getUsedSeconds(domain, trackedSessions, cachedStorage, currentDateKey, MAX_ELAPSED_SECONDS);
  }

  // --- Tab tracking ---

  function startTrackingTab(tabId: number, domain: string): void {
    const oldDomain = tabDomainMap.get(tabId);
    if (oldDomain === domain) return;

    tabDomainMap.set(tabId, domain);

    const existing = trackedSessions.get(domain);
    if (existing) {
      existing.tabIds.add(tabId);
    } else {
      const dayUsage = cachedStorage?.usage[currentDateKey] ?? {};
      const usedSeconds = dayUsage[domain]?.usedSeconds ?? 0;
      trackedSessions.set(domain, {
        tabIds: new Set([tabId]),
        sessionStart: Date.now(),
        baseUsedSeconds: usedSeconds,
      });
    }
  }

  async function stopTrackingTab(tabId: number): Promise<void> {
    const domain = tabDomainMap.get(tabId);
    if (!domain) return;

    tabDomainMap.delete(tabId);

    const session = trackedSessions.get(domain);
    if (!session) return;

    session.tabIds.delete(tabId);
    if (session.tabIds.size === 0) {
      const usedSeconds = session.baseUsedSeconds + getSessionElapsed(session);
      trackedSessions.delete(domain);
      await flushDomainUsage(domain, usedSeconds);
    }
  }

  /** Serializes tab navigation to prevent concurrent state mutations */
  let navQueue: Promise<void> = Promise.resolve();

  async function handleTabNavigation(
    tabId: number,
    url: string,
  ): Promise<void> {
    navQueue = navQueue.then(() => handleTabNavigationInner(tabId, url)).catch(() => {});
  }

  async function handleTabNavigationInner(
    tabId: number,
    url: string,
  ): Promise<void> {
    if (!cachedStorage || !cachedStorage.isEnabled) return;

    const hostname = extractDomain(url, DOMAIN_ALIASES);
    const matchedSite = hostname
      ? findMatchingSite(hostname, cachedStorage.sites, DOMAIN_ALIASES)
      : null;
    const newDomain = matchedSite ? matchedSite.domain : null;
    const oldDomain = tabDomainMap.get(tabId) ?? null;

    if (newDomain === oldDomain) return;

    if (oldDomain) {
      await stopTrackingTab(tabId);
    }

    if (newDomain && !blockedDomains.has(newDomain)) {
      startTrackingTab(tabId, newDomain);
    }

    if (tabId === activeTabId) {
      activeDomain = newDomain;
    }
  }

  async function scanAllTabs(): Promise<void> {
    if (!cachedStorage || !cachedStorage.isEnabled) return;

    let tabs;
    try {
      tabs = await browser.tabs.query({});
    } catch {
      return;
    }

    // Build map of domains → tabIds currently in browser
    const domainsInTabs = new Map<string, Set<number>>();
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      const hostname = extractDomain(tab.url, DOMAIN_ALIASES);
      const matchedSite = hostname
        ? findMatchingSite(hostname, cachedStorage.sites, DOMAIN_ALIASES)
        : null;
      if (matchedSite && !blockedDomains.has(matchedSite.domain)) {
        const domain = matchedSite.domain;
        if (!domainsInTabs.has(domain)) domainsInTabs.set(domain, new Set());
        domainsInTabs.get(domain)!.add(tab.id);
      }
    }

    // Remove tabs no longer present
    for (const [tabId, domain] of tabDomainMap) {
      const tabSet = domainsInTabs.get(domain);
      if (!tabSet || !tabSet.has(tabId)) {
        await stopTrackingTab(tabId);
      }
    }

    // Add new tabs
    for (const [domain, tabIds] of domainsInTabs) {
      for (const tabId of tabIds) {
        startTrackingTab(tabId, domain);
      }
    }

    // Update active tab for badge
    await updateActiveTabInfo();
  }

  async function updateActiveTabInfo(): Promise<void> {
    let tabs;
    try {
      tabs = await browser.tabs.query({ active: true, currentWindow: true });
    } catch {
      return;
    }
    const tab = tabs[0];
    if (!tab?.id || !tab.url) {
      activeTabId = null;
      activeDomain = null;
      return;
    }

    activeTabId = tab.id;
    const hostname = extractDomain(tab.url, DOMAIN_ALIASES);
    const matchedSite =
      hostname && cachedStorage
        ? findMatchingSite(hostname, cachedStorage.sites, DOMAIN_ALIASES)
        : null;
    activeDomain = matchedSite ? matchedSite.domain : null;
  }

  // --- Nuclear expiry check (called every tick) ---

  async function checkNuclearExpiry(): Promise<void> {
    if (!cachedStorage?.isEnabled || !cachedStorage.nuclearMode) return;
    const expiresAt = new Date(
      cachedStorage.nuclearMode.expiresAt,
    ).getTime();
    if (isNaN(expiresAt) || Math.ceil((expiresAt - Date.now()) / 1000) <= 0) {
      await handleNuclearExpired();
    }
  }

  // --- Storage flush ---

  async function flushAllUsage(): Promise<void> {
    return withWriteLock(flushAllUsageInner);
  }

  /** Uncapped flush for date rollover — counts all elapsed time including sleep periods */
  async function flushAllUsageUncapped(): Promise<void> {
    return withWriteLock(async () => {
      if (!cachedStorage || trackedSessions.size === 0) return;

      const dateKey = currentDateKey;
      const usage = { ...cachedStorage.usage };
      const dayUsage = { ...(usage[dateKey] ?? {}) };
      let changed = false;

      for (const [domain, session] of trackedSessions) {
        // Use uncapped elapsed — include sleep time for accurate daily totals
        const rawElapsed = Math.max(0, Math.floor((Date.now() - session.sessionStart) / 1000));
        const currentUsed = session.baseUsedSeconds + rawElapsed;
        const domainUsage = dayUsage[domain] ?? {
          usedSeconds: 0,
          blockedAttempts: 0,
          limitChanges: [],
        };
        if (currentUsed > domainUsage.usedSeconds) {
          dayUsage[domain] = { ...domainUsage, usedSeconds: currentUsed };
          changed = true;
        }
      }

      // Reset session timers
      for (const [, session] of trackedSessions) {
        const rawElapsed = Math.max(0, Math.floor((Date.now() - session.sessionStart) / 1000));
        session.baseUsedSeconds = session.baseUsedSeconds + rawElapsed;
        session.sessionStart = Date.now();
      }

      if (changed) {
        usage[dateKey] = dayUsage;
        selfWrites.mark();
        await writeStorage({ usage });
        cachedStorage = { ...cachedStorage, usage };
      }
    });
  }

  async function flushAllUsageInner(): Promise<void> {
    if (!cachedStorage || trackedSessions.size === 0) return;

    const dateKey = currentDateKey;
    const usage = { ...cachedStorage.usage };
    const { updatedDayUsage, changed } = accumulateSessionUsage(
      trackedSessions,
      usage[dateKey] ?? {},
      MAX_ELAPSED_SECONDS,
    );

    // Reset session timers after accumulation
    for (const [, session] of trackedSessions) {
      session.baseUsedSeconds =
        session.baseUsedSeconds + getSessionElapsed(session);
      session.sessionStart = Date.now();
    }

    if (changed) {
      usage[dateKey] = updatedDayUsage;
      selfWrites.mark();
      await writeStorage({ usage });
      cachedStorage = { ...cachedStorage, usage };
    }
  }

  /** Inner flush — must be called within withWriteLock */
  async function flushDomainUsageInner(
    domain: string,
    usedSeconds: number,
  ): Promise<void> {
    if (!cachedStorage) return;
    const dateKey = currentDateKey;
    const usage = { ...cachedStorage.usage };
    const dayUsage = { ...(usage[dateKey] ?? {}) };
    const domainUsage = dayUsage[domain] ?? {
      usedSeconds: 0,
      blockedAttempts: 0,
      limitChanges: [],
    };
    if (usedSeconds <= domainUsage.usedSeconds) return;
    dayUsage[domain] = { ...domainUsage, usedSeconds };
    usage[dateKey] = dayUsage;
    selfWrites.mark();
    await writeStorage({ usage });
    cachedStorage = { ...cachedStorage, usage };
  }

  async function flushDomainUsage(
    domain: string,
    usedSeconds: number,
  ): Promise<void> {
    return withWriteLock(() => flushDomainUsageInner(domain, usedSeconds));
  }

  /** Inner increment — must be called within withWriteLock */
  async function incrementBlockedAttemptsInner(domain: string): Promise<void> {
    if (!cachedStorage) return;
    const dateKey = currentDateKey;
    const usage = { ...cachedStorage.usage };
    const dayUsage = { ...(usage[dateKey] ?? {}) };
    const domainUsage = dayUsage[domain] ?? {
      usedSeconds: 0,
      blockedAttempts: 0,
      limitChanges: [],
    };
    dayUsage[domain] = {
      ...domainUsage,
      blockedAttempts: domainUsage.blockedAttempts + 1,
    };
    usage[dateKey] = dayUsage;
    selfWrites.mark();
    await writeStorage({ usage });
    cachedStorage = { ...cachedStorage, usage };
  }

  // --- Blocking check (entire operation under write lock) ---

  async function checkAndBlockAll(): Promise<void> {
    if (!cachedStorage || cachedStorage.nuclearMode) return;

    return withWriteLock(async () => {
      if (!cachedStorage || cachedStorage.nuclearMode) return;

      // Check for manually hard-blocked domains (may not be in tracked sessions)
      const dayUsage = cachedStorage.usage[currentDateKey] ?? {};
      for (const site of cachedStorage.sites) {
        const du = dayUsage[site.domain];
        if (du?.hardBlockedAt && !blockedDomains.has(site.domain)) {
          try {
            await addSiteBlockRule(site);
          } catch {
            continue;
          }
          blockedDomains.add(site.domain);
          const session = trackedSessions.get(site.domain);
          if (session) {
            for (const tabId of session.tabIds) tabDomainMap.delete(tabId);
            trackedSessions.delete(site.domain);
          }
          await notifyAllTabsForDomain(site.domain, 'showBlockOverlay');
        }
      }

      const toBlock: Array<{ domain: string; usedSeconds: number }> = [];

      for (const [domain, session] of trackedSessions) {
        const site = cachedStorage.sites.find((s) => s.domain === domain);
        if (!site) continue;

        const currentUsed =
          session.baseUsedSeconds + getSessionElapsed(session);
        if (isDomainBlocked(site, currentUsed) && !blockedDomains.has(domain)) {
          toBlock.push({ domain, usedSeconds: currentUsed });
        }
      }

      for (const { domain, usedSeconds } of toBlock) {
        const site = cachedStorage.sites.find((s) => s.domain === domain);
        if (!site) continue;

        await flushDomainUsageInner(domain, usedSeconds);
        try {
          await addSiteBlockRule(site);
        } catch {
          continue; // Rule failed — don't mark as blocked
        }
        blockedDomains.add(domain);
        await incrementBlockedAttemptsInner(domain);
        await notifyAllTabsForDomain(domain, 'showBlockOverlay');

        // Remove all tabs for this domain from tracking
        const session = trackedSessions.get(domain);
        if (session) {
          for (const tabId of session.tabIds) {
            tabDomainMap.delete(tabId);
          }
          trackedSessions.delete(domain);
        }
      }
    });
  }

  // --- Nuclear expiry ---

  async function handleNuclearExpired(): Promise<void> {
    return withWriteLock(async () => {
      const sites = cachedStorage?.sites ?? [];
      selfWrites.mark();
      await writeStorage({ nuclearMode: null });
      if (cachedStorage) {
        cachedStorage = { ...cachedStorage, nuclearMode: null };
      }
      await removeNuclearRules(sites);
      if (cachedStorage) {
        await reconcileRules(cachedStorage);
        rebuildBlockedDomainsSet();
      }
    });
  }

  // --- Date rollover ---

  async function checkDateRollover(): Promise<void> {
    const newKey = getTodayKey();
    if (newKey !== currentDateKey) {
      // Flush all tracked domains before rolling over.
      // Use uncapped elapsed time so sleep periods before midnight
      // are correctly attributed to the previous day.
      await flushAllUsageUncapped();

      // Archive previous day's usage to history (30-day retention)
      if (cachedStorage) {
        const oldDateKey = currentDateKey;
        const oldDayUsage = cachedStorage.usage[oldDateKey];

        if (oldDayUsage && Object.keys(oldDayUsage).length > 0) {
          let history = { ...cachedStorage.history };
          history[oldDateKey] = oldDayUsage;

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const cutoffKey = getDateKey(cutoff);
          history = pruneHistory(history, cutoffKey);

          const usage = { ...cachedStorage.usage };
          delete usage[oldDateKey];

          selfWrites.mark();
          await writeStorage({ history, usage });
          cachedStorage = { ...cachedStorage, history, usage };
        }
      }

      currentDateKey = newKey;

      // Reset all sessions for the new day
      for (const [, session] of trackedSessions) {
        session.baseUsedSeconds = 0;
        session.sessionStart = Date.now();
      }

      // Remove all site block rules (new day = fresh limits)
      if (cachedStorage && !cachedStorage.nuclearMode) {
        for (const site of cachedStorage.sites) {
          await removeSiteBlockRule(site);
        }
        blockedDomains.clear();
        // Re-scan tabs to start tracking previously blocked domains
        await scanAllTabs();
      }
    }
  }

  // --- Tab notification helpers ---

  async function notifyAllTabsForDomain(
    domain: string,
    messageType: string,
  ): Promise<void> {
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        const tabDomain = extractDomain(tab.url, DOMAIN_ALIASES);
        if (
          tabDomain === domain ||
          (tabDomain && tabDomain.endsWith('.' + domain))
        ) {
          browser.tabs
            .sendMessage(tab.id, { type: messageType, domain })
            .catch(() => {});
        }
      }
    } catch {
      /* tabs query can fail */
    }
  }

  // --- Blocked attempts tracking ---

  async function incrementBlockedAttempts(domain: string): Promise<void> {
    return withWriteLock(() => incrementBlockedAttemptsInner(domain));
  }

  // --- Rebuild blockedDomains from storage state ---

  function rebuildBlockedDomainsSet(): void {
    blockedDomains.clear();
    if (!cachedStorage) return;
    const dayUsage = cachedStorage.usage[currentDateKey] ?? {};
    const rebuilt = buildBlockedDomainsSet(cachedStorage.sites, dayUsage);
    for (const domain of rebuilt) {
      blockedDomains.add(domain);
    }
  }

  // --- Main tick ---

  let tickInProgress = false;

  setInterval(() => {
    if (!cachedStorage || !cachedStorage.isEnabled) return;
    if (tickInProgress) return;
    tickCount++;

    tickInProgress = true;

    (async () => {
      await checkNuclearExpiry();

      if (trackedSessions.size > 0) {
        await checkAndBlockAll();
      }

      if (tickCount % FLUSH_INTERVAL_TICKS === 0) {
        await flushAllUsage();
      }

      if (tickCount % DATE_CHECK_INTERVAL_TICKS === 0) {
        await checkDateRollover();
      }
    })()
      .catch((err) => console.error('[SitesNuker] Tick error:', err))
      .finally(() => {
        tickInProgress = false;
      });
  }, 1000);

  // --- Event listeners ---

  browser.tabs.onActivated.addListener(({ tabId }) => {
    activeTabId = tabId;
    activeDomain = tabDomainMap.get(tabId) ?? null;

    // If tab not in our map, query its URL (might be non-tracked)
    if (activeDomain == null) {
      browser.tabs
        .get(tabId)
        .then((tab) => {
          if (!tab.url || !cachedStorage) return;
          const hostname = extractDomain(tab.url, DOMAIN_ALIASES);
          const matchedSite = hostname
            ? findMatchingSite(
                hostname,
                cachedStorage.sites,
                DOMAIN_ALIASES,
              )
            : null;
          activeDomain = matchedSite ? matchedSite.domain : null;
            })
        .catch(() => {});
    }
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      handleTabNavigation(tabId, changeInfo.url).catch(() => {});
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    stopTrackingTab(tabId).catch(() => {});
    if (tabId === activeTabId) {
      activeTabId = null;
      activeDomain = null;
    }
  });

  // --- Storage change sub-handlers ---

  async function handleSiteDeletion(
    prevStorage: StorageSchema,
  ): Promise<void> {
    if (!cachedStorage) return;
    const newDomains = new Set(cachedStorage.sites.map((s) => s.domain));
    for (const prevSite of prevStorage.sites) {
      if (!newDomains.has(prevSite.domain)) {
        await removeSiteBlockRule(prevSite);
        blockedDomains.delete(prevSite.domain);
        await notifyAllTabsForDomain(prevSite.domain, 'removeBlockOverlay');

        // Remove from tracking
        const session = trackedSessions.get(prevSite.domain);
        if (session) {
          for (const tabId of session.tabIds) {
            tabDomainMap.delete(tabId);
          }
          trackedSessions.delete(prevSite.domain);
        }
        if (activeDomain === prevSite.domain) {
          activeDomain = null;
        }
      }
    }
  }

  async function handleLimitChanges(
    prevStorage: StorageSchema,
  ): Promise<void> {
    if (!cachedStorage) return;
    for (const site of cachedStorage.sites) {
      const prevSite = prevStorage.sites.find((s) => s.id === site.id);
      if (!prevSite || site.dailyLimitMinutes === prevSite.dailyLimitMinutes)
        continue;

      const used = getUsedSeconds(site.domain);

      if (
        site.dailyLimitMinutes > prevSite.dailyLimitMinutes &&
        blockedDomains.has(site.domain)
      ) {
        if (used < site.dailyLimitMinutes * 60 && used < HARD_CAP_SECONDS) {
          await removeSiteBlockRule(site);
          blockedDomains.delete(site.domain);
          await notifyAllTabsForDomain(site.domain, 'removeBlockOverlay');
        }
      } else if (
        site.dailyLimitMinutes < prevSite.dailyLimitMinutes &&
        !blockedDomains.has(site.domain)
      ) {
        if (used >= site.dailyLimitMinutes * 60) {
          try {
            await addSiteBlockRule(site);
          } catch {
            continue;
          }
          blockedDomains.add(site.domain);
          await notifyAllTabsForDomain(site.domain, 'showBlockOverlay');

          // Remove from tracking
          const session = trackedSessions.get(site.domain);
          if (session) {
            for (const tabId of session.tabIds) {
              tabDomainMap.delete(tabId);
            }
            trackedSessions.delete(site.domain);
          }
        }
      }
    }
  }

  async function handleNuclearActivation(): Promise<void> {
    if (!cachedStorage) return;
    await addNuclearRules(cachedStorage.sites);
    rebuildBlockedDomainsSet();

    // Clear all tracking — everything is blocked
    tabDomainMap.clear();
    trackedSessions.clear();

    const nuclearDomains = new Set(
      cachedStorage.sites.map((s) => s.domain),
    );
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        const tabDomain = extractDomain(tab.url, DOMAIN_ALIASES);
        let matchesNuclear = false;
        if (tabDomain) {
          if (nuclearDomains.has(tabDomain)) {
            matchesNuclear = true;
          } else {
            for (const d of nuclearDomains) {
              if (tabDomain.endsWith('.' + d)) {
                matchesNuclear = true;
                break;
              }
            }
          }
        }
        if (matchesNuclear) {
          browser.tabs
            .sendMessage(tab.id, {
              type: 'showBlockOverlay',
              domain: tabDomain,
            })
            .catch(() => {});
        }
      }
    } catch {
      /* tabs query can fail */
    }
  }

  async function handleExtensionDisabled(): Promise<void> {
    // Remove overlays before clearing state
    for (const domain of blockedDomains) {
      await notifyAllTabsForDomain(domain, 'removeBlockOverlay');
    }

    await removeAllRules();
    blockedDomains.clear();

    // Clear all tracking
    tabDomainMap.clear();
    trackedSessions.clear();
  }

  async function handleExtensionEnabled(): Promise<void> {
    if (!cachedStorage) return;
    await reconcileRules(cachedStorage);
    rebuildBlockedDomainsSet();
    // Notify content scripts about currently blocked domains
    for (const domain of blockedDomains) {
      await notifyAllTabsForDomain(domain, 'showBlockOverlay');
    }
    await scanAllTabs();
  }

  // --- Storage change listener ---

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    if (selfWrites.consumeIfRecent()) return;

    try {
      const prevStorage = cachedStorage;
      cachedStorage = await readStorage();

      if (prevStorage && !cachedStorage.nuclearMode) {
        await handleSiteDeletion(prevStorage);
      }

      if (prevStorage && cachedStorage.isEnabled && !cachedStorage.nuclearMode) {
        await handleLimitChanges(prevStorage);
      }

      if (
        changes.nuclearMode?.newValue &&
        !changes.nuclearMode?.oldValue &&
        cachedStorage.nuclearMode
      ) {
        await handleNuclearActivation();
      }

      if (prevStorage?.isEnabled && !cachedStorage.isEnabled) {
        await handleExtensionDisabled();
      }

      if (!prevStorage?.isEnabled && cachedStorage.isEnabled) {
        await handleExtensionEnabled();
      }

      // Re-scan tabs in case sites were added/removed
      await scanAllTabs();
    } catch (err) {
      console.error('[SitesNuker] storage.onChanged handler error:', err);
    }
  });

  // --- Popup mutation handlers (all writes go through background's lock) ---

  async function handleUpdateSiteLimit(
    siteId: string,
    direction: 'extend' | 'reduce',
  ): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };

      const site = cachedStorage.sites.find((s) => s.id === siteId);
      if (!site) return { ok: false };

      const newLimit =
        direction === 'extend'
          ? Math.min(site.dailyLimitMinutes + LIMIT_STEP, LIMIT_MAX)
          : Math.max(site.dailyLimitMinutes - LIMIT_STEP, LIMIT_MIN);
      if (newLimit === site.dailyLimitMinutes) return { ok: true };

      const updatedSites = cachedStorage.sites.map((s) =>
        s.id === siteId ? { ...s, dailyLimitMinutes: newLimit } : s,
      );

      const dateKey = currentDateKey;
      const usage = { ...cachedStorage.usage };
      const dayUsage = { ...(usage[dateKey] ?? {}) };
      const domainUsage = dayUsage[site.domain] ?? {
        usedSeconds: 0,
        blockedAttempts: 0,
        limitChanges: [],
      };
      dayUsage[site.domain] = {
        ...domainUsage,
        limitChanges: [
          ...domainUsage.limitChanges,
          {
            timestamp: new Date().toISOString(),
            from: site.dailyLimitMinutes,
            to: newLimit,
          },
        ],
      };
      usage[dateKey] = dayUsage;

      selfWrites.mark();
      await writeStorage({ sites: updatedSites, usage });
      cachedStorage = { ...cachedStorage, sites: updatedSites, usage };

      // Unblock if limit was increased and site is currently blocked
      if (direction === 'extend' && blockedDomains.has(site.domain) && cachedStorage.isEnabled) {
        const used = getUsedSeconds(site.domain);
        if (used < newLimit * 60 && used < HARD_CAP_SECONDS) {
          const updatedSite = { ...site, dailyLimitMinutes: newLimit };
          await removeSiteBlockRule(updatedSite);
          blockedDomains.delete(site.domain);
          await notifyAllTabsForDomain(site.domain, 'removeBlockOverlay');
          // Restart tracking for tabs still open on this domain
          await scanAllTabs();
        }
      }

      // Block if limit was reduced and usage now exceeds new limit
      if (direction === 'reduce' && !blockedDomains.has(site.domain) && cachedStorage.isEnabled) {
        const used = getUsedSeconds(site.domain);
        if (used >= newLimit * 60) {
          const updatedSite = { ...site, dailyLimitMinutes: newLimit };
          try {
            await addSiteBlockRule(updatedSite);
          } catch {
            return { ok: true }; // Storage updated but rule failed
          }
          blockedDomains.add(site.domain);
          await flushDomainUsageInner(site.domain, used);
          await notifyAllTabsForDomain(site.domain, 'showBlockOverlay');

          const session = trackedSessions.get(site.domain);
          if (session) {
            for (const tabId of session.tabIds) tabDomainMap.delete(tabId);
            trackedSessions.delete(site.domain);
          }
        }
      }

      return { ok: true };
    });
  }

  async function handleDeleteSite(siteId: string): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      const updatedSites = cachedStorage.sites.filter((s) => s.id !== siteId);
      selfWrites.mark();
      await writeStorage({ sites: updatedSites });
      cachedStorage = { ...cachedStorage, sites: updatedSites };
      return { ok: true };
    });
  }

  async function handleAddSite(
    domain: string,
    limitMinutes: number,
  ): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      const newSite = {
        id: crypto.randomUUID(),
        domain,
        dailyLimitMinutes: limitMinutes,
        initialLimitMinutes: limitMinutes,
        isPreset: false,
        addedAt: new Date().toISOString(),
      };
      const updatedSites = [newSite, ...cachedStorage.sites];
      selfWrites.mark();
      await writeStorage({ sites: updatedSites });
      cachedStorage = { ...cachedStorage, sites: updatedSites };
      return { ok: true };
    });
  }

  async function handleHardBlockSite(
    domain: string,
  ): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      const dateKey = currentDateKey;
      const usage = { ...cachedStorage.usage };
      const dayUsage = { ...(usage[dateKey] ?? {}) };
      const domainUsage = dayUsage[domain] ?? {
        usedSeconds: 0,
        blockedAttempts: 0,
        limitChanges: [],
      };
      dayUsage[domain] = {
        ...domainUsage,
        hardBlockedAt: new Date().toISOString(),
      };
      usage[dateKey] = dayUsage;
      selfWrites.mark();
      await writeStorage({ usage });
      cachedStorage = { ...cachedStorage, usage };
      return { ok: true };
    });
  }

  async function handleActivateNuclear(
    durationMinutes: number,
  ): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      const now = new Date();
      const nuclearMode = {
        activatedAt: now.toISOString(),
        durationMinutes,
        expiresAt: new Date(
          now.getTime() + durationMinutes * 60 * 1000,
        ).toISOString(),
      };
      selfWrites.mark();
      await writeStorage({ nuclearMode });
      cachedStorage = { ...cachedStorage, nuclearMode };
      return { ok: true };
    });
  }

  async function handleClearNuclearMode(): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      selfWrites.mark();
      await writeStorage({ nuclearMode: null });
      cachedStorage = { ...cachedStorage, nuclearMode: null };
      return { ok: true };
    });
  }

  async function handleSetEnabled(isEnabled: boolean): Promise<{ ok: boolean }> {
    return withWriteLock(async () => {
      if (!cachedStorage) return { ok: false };
      selfWrites.mark();
      await writeStorage({ isEnabled });
      cachedStorage = { ...cachedStorage, isEnabled };

      if (isEnabled) {
        await handleExtensionEnabled();
      } else {
        await handleExtensionDisabled();
      }

      return { ok: true };
    });
  }

  // --- Messaging ---

  browser.runtime.onMessage.addListener((message, sender) => {
    // Validate sender for all mutation operations
    const isTrustedSender = sender?.id === browser.runtime.id;

    if (message?.type === 'getActiveState') {
      const trackedUsage: Record<string, number> = {};
      for (const [domain, session] of trackedSessions) {
        trackedUsage[domain] =
          session.baseUsedSeconds + getSessionElapsed(session);
      }
      return Promise.resolve({ activeDomain, trackedUsage });
    }

    if (message?.type === 'updateSiteLimit') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      const dir = message.direction;
      if (dir !== 'extend' && dir !== 'reduce') return Promise.resolve({ ok: false });
      if (typeof message.siteId !== 'string') return Promise.resolve({ ok: false });
      return handleUpdateSiteLimit(message.siteId, dir);
    }

    if (message?.type === 'deleteSite') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      if (typeof message.siteId !== 'string') return Promise.resolve({ ok: false });
      return handleDeleteSite(message.siteId);
    }

    if (message?.type === 'addSite') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      const validDomain = typeof message.domain === 'string'
        ? extractDomain(message.domain, DOMAIN_ALIASES)
        : null;
      if (!validDomain) return Promise.resolve({ ok: false });
      const limitMinutes = typeof message.limitMinutes === 'number'
        ? Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, message.limitMinutes))
        : LIMIT_MIN;
      return handleAddSite(validDomain, limitMinutes);
    }

    if (message?.type === 'hardBlockSite') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      const validDomain = typeof message.domain === 'string'
        ? extractDomain(message.domain, DOMAIN_ALIASES)
        : null;
      if (!validDomain) return Promise.resolve({ ok: false });
      return handleHardBlockSite(validDomain);
    }

    if (message?.type === 'activateNuclear') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      const dur = message.durationMinutes;
      if (typeof dur !== 'number' || !(NUCLEAR_TIME_OPTIONS as readonly number[]).includes(dur)) {
        return Promise.resolve({ ok: false });
      }
      return handleActivateNuclear(dur);
    }

    if (message?.type === 'clearNuclearMode') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      return handleClearNuclearMode();
    }

    if (message?.type === 'setEnabled') {
      if (!isTrustedSender) return Promise.resolve({ ok: false });
      if (typeof message.isEnabled !== 'boolean') return Promise.resolve({ ok: false });
      return handleSetEnabled(message.isEnabled);
    }

    if (message?.type === 'recordBlockedAttempt' && sender?.tab?.url) {
      const hostname = extractDomain(sender.tab.url, DOMAIN_ALIASES);
      const matchedSite =
        hostname && cachedStorage
          ? findMatchingSite(
              hostname,
              cachedStorage.sites,
              DOMAIN_ALIASES,
            )
          : null;
      if (matchedSite) {
        incrementBlockedAttempts(matchedSite.domain).catch(() => {});
      }
      return Promise.resolve({ ok: true });
    }

    if (message?.type === 'isCurrentSiteBlocked' && sender?.tab?.url) {
      const tabUrl = sender.tab.url;
      return initReady.then(() => {
        const hostname = extractDomain(tabUrl, DOMAIN_ALIASES);
        const matchedSite =
          hostname && cachedStorage
            ? findMatchingSite(
                hostname,
                cachedStorage.sites,
                DOMAIN_ALIASES,
              )
            : null;
        const blocked = matchedSite
          ? blockedDomains.has(matchedSite.domain)
          : false;
        const nuclearExpiry = cachedStorage?.nuclearMode
          ? new Date(cachedStorage.nuclearMode.expiresAt).getTime()
          : NaN;
        const nuclear =
          matchedSite != null &&
          !isNaN(nuclearExpiry) &&
          nuclearExpiry > Date.now();
        return { blocked: blocked || nuclear };
      });
    }

    if (message?.type) {
      console.warn('[SitesNuker] Unknown message type:', message.type);
    }
    return undefined;
  });

  // --- Init ---

  (async () => {
    try {
      cachedStorage = await readStorage();

      // Clear expired nuclear mode before reconciling rules
      if (cachedStorage.nuclearMode) {
        const expiresAt = new Date(
          cachedStorage.nuclearMode.expiresAt,
        ).getTime();
        if (isNaN(expiresAt) || expiresAt <= Date.now()) {
          selfWrites.mark();
          await writeStorage({ nuclearMode: null });
          cachedStorage = { ...cachedStorage, nuclearMode: null };
        }
      }

      await reconcileRules(cachedStorage);
      rebuildBlockedDomainsSet();
      await scanAllTabs();
    } catch (err) {
      console.error('[SitesNuker] Init error:', err);
    } finally {
      resolveInit();
    }
  })();
});
