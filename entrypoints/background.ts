import type { StorageSchema } from '@/shared/types';
import { readStorage, writeStorage } from '@/shared/storage';
import { DOMAIN_ALIASES, HARD_CAP_SECONDS } from '@/shared/constants';
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

const FLUSH_INTERVAL_TICKS = 5;
const DATE_CHECK_INTERVAL_TICKS = 60;
/** If elapsed time since last session start exceeds this, system likely slept */
const MAX_ELAPSED_SECONDS = FLUSH_INTERVAL_TICKS * 2 + 2;

export default defineBackground(() => {
  // --- Per-domain session tracking ---

  interface DomainSession {
    tabIds: Set<number>;
    sessionStart: number;
    baseUsedSeconds: number;
  }

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

  const pendingSelfWrites: number[] = [];
  function markSelfWrite(): void {
    if (pendingSelfWrites.length >= 50) pendingSelfWrites.splice(0, 25);
    pendingSelfWrites.push(Date.now());
  }

  /** Domains blocked by site-level rules (limit exceeded) */
  const blockedDomains = new Set<string>();
  /** Lock for storage writes to prevent lost updates */
  let writeLock: Promise<void> | null = null;
  /** Resolves when background init is complete (storage loaded, rules reconciled) */
  let resolveInit!: () => void;
  const initReady: Promise<void> = new Promise((r) => {
    resolveInit = r;
  });

  // --- Helpers ---

  function getSessionElapsed(session: DomainSession): number {
    if (session.sessionStart === 0) return 0;
    const raw = Math.floor((Date.now() - session.sessionStart) / 1000);
    return Math.min(raw, MAX_ELAPSED_SECONDS);
  }

  function getUsedSeconds(domain: string): number {
    const session = trackedSessions.get(domain);
    if (session) {
      return session.baseUsedSeconds + getSessionElapsed(session);
    }
    const dayUsage = cachedStorage?.usage[currentDateKey] ?? {};
    return dayUsage[domain]?.usedSeconds ?? 0;
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

  async function handleTabNavigation(
    tabId: number,
    url: string,
  ): Promise<void> {
    if (!cachedStorage) return;

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
    if (!cachedStorage) return;

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

  function checkNuclearExpiry(): void {
    if (!cachedStorage?.isEnabled || !cachedStorage.nuclearMode) return;
    const expiresAt = new Date(
      cachedStorage.nuclearMode.expiresAt,
    ).getTime();
    if (isNaN(expiresAt) || Math.ceil((expiresAt - Date.now()) / 1000) <= 0) {
      handleNuclearExpired().catch(() => {});
    }
  }

  // --- Storage flush ---

  async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    while (writeLock) await writeLock;
    let unlock: () => void;
    writeLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    try {
      return await fn();
    } finally {
      writeLock = null;
      unlock!();
    }
  }

  async function flushAllUsage(): Promise<void> {
    return withWriteLock(flushAllUsageInner);
  }

  async function flushAllUsageInner(): Promise<void> {
    if (!cachedStorage || trackedSessions.size === 0) return;

    const dateKey = currentDateKey;
    const usage = { ...cachedStorage.usage };
    const dayUsage = { ...(usage[dateKey] ?? {}) };
    let changed = false;

    for (const [domain, session] of trackedSessions) {
      const currentUsed =
        session.baseUsedSeconds + getSessionElapsed(session);
      const domainUsage = dayUsage[domain] ?? {
        usedSeconds: 0,
        blockedAttempts: 0,
        limitChanges: [],
      };

      if (currentUsed !== domainUsage.usedSeconds) {
        dayUsage[domain] = { ...domainUsage, usedSeconds: currentUsed };
        changed = true;
      }

      session.baseUsedSeconds = currentUsed;
      session.sessionStart = Date.now();
    }

    if (changed) {
      usage[dateKey] = dayUsage;
      markSelfWrite();
      await writeStorage({ usage });
      cachedStorage = { ...cachedStorage, usage };
    }
  }

  async function flushDomainUsage(
    domain: string,
    usedSeconds: number,
  ): Promise<void> {
    return withWriteLock(async () => {
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
      markSelfWrite();
      await writeStorage({ usage });
      cachedStorage = { ...cachedStorage, usage };
    });
  }

  // --- Blocking check ---

  async function checkAndBlockAll(): Promise<void> {
    if (!cachedStorage || cachedStorage.nuclearMode) return;

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

      await flushDomainUsage(domain, usedSeconds);
      await addSiteBlockRule(site);
      blockedDomains.add(domain);
      await incrementBlockedAttempts(domain);
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
  }

  // --- Nuclear expiry ---

  async function handleNuclearExpired(): Promise<void> {
    return withWriteLock(async () => {
      const sites = cachedStorage?.sites ?? [];
      markSelfWrite();
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
      // Flush all tracked domains before rolling over
      await flushAllUsage();

      // Archive previous day's usage to history (30-day retention)
      if (cachedStorage) {
        const oldDateKey = currentDateKey;
        const oldDayUsage = cachedStorage.usage[oldDateKey];

        if (oldDayUsage && Object.keys(oldDayUsage).length > 0) {
          const history = { ...cachedStorage.history };
          history[oldDateKey] = oldDayUsage;

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const cutoffKey = getDateKey(cutoff);
          for (const key of Object.keys(history)) {
            if (key < cutoffKey) {
              delete history[key];
            }
          }

          const usage = { ...cachedStorage.usage };
          delete usage[oldDateKey];

          markSelfWrite();
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
    return withWriteLock(async () => {
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
      markSelfWrite();
      await writeStorage({ usage });
      cachedStorage = { ...cachedStorage, usage };
    });
  }

  // --- Rebuild blockedDomains from storage state ---

  function rebuildBlockedDomainsSet(): void {
    blockedDomains.clear();
    if (!cachedStorage) return;
    const today = currentDateKey;
    const dayUsage = cachedStorage.usage[today] ?? {};
    for (const site of cachedStorage.sites) {
      const usedSeconds = dayUsage[site.domain]?.usedSeconds ?? 0;
      if (isDomainBlocked(site, usedSeconds)) {
        blockedDomains.add(site.domain);
      }
    }
  }

  // --- Main tick ---

  setInterval(() => {
    if (!cachedStorage) return;
    tickCount++;

    checkNuclearExpiry();

    if (trackedSessions.size > 0) {
      checkAndBlockAll().catch(() => {});
    }

    if (tickCount % FLUSH_INTERVAL_TICKS === 0) {
      flushAllUsage().catch(() => {});
    }

    if (tickCount % DATE_CHECK_INTERVAL_TICKS === 0) {
      checkDateRollover().catch(() => {});
    }
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
    const newDomains = new Set(cachedStorage!.sites.map((s) => s.domain));
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
    for (const site of cachedStorage!.sites) {
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
          await addSiteBlockRule(site);
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
    await addNuclearRules(cachedStorage!.sites);
    rebuildBlockedDomainsSet();

    // Clear all tracking — everything is blocked
    tabDomainMap.clear();
    trackedSessions.clear();

    const nuclearDomains = new Set(
      cachedStorage!.sites.map((s) => s.domain),
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
    await removeAllRules();
    blockedDomains.clear();

    // Clear all tracking
    tabDomainMap.clear();
    trackedSessions.clear();
  }

  async function handleExtensionEnabled(): Promise<void> {
    await reconcileRules(cachedStorage!);
    rebuildBlockedDomainsSet();
    await scanAllTabs();
  }

  // --- Storage change listener ---

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    const now = Date.now();
    const recentIndex = pendingSelfWrites.findIndex((ts) => now - ts < 2000);
    if (recentIndex !== -1) {
      pendingSelfWrites.splice(recentIndex, 1);
      return;
    }
    while (
      pendingSelfWrites.length > 0 &&
      now - pendingSelfWrites[0]! > 5000
    ) {
      pendingSelfWrites.shift();
    }

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
  });

  // --- Messaging ---

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'getActiveState') {
      const trackedUsage: Record<string, number> = {};
      for (const [domain, session] of trackedSessions) {
        trackedUsage[domain] =
          session.baseUsedSeconds + getSessionElapsed(session);
      }
      return Promise.resolve({ activeDomain, trackedUsage });
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
        const nuclear =
          cachedStorage?.nuclearMode != null &&
          new Date(cachedStorage.nuclearMode.expiresAt).getTime() >
            Date.now();
        return { blocked: blocked || nuclear };
      });
    }

    return undefined;
  });

  // --- Init ---

  (async () => {
    cachedStorage = await readStorage();

    // Clear expired nuclear mode before reconciling rules
    if (cachedStorage.nuclearMode) {
      const expiresAt = new Date(
        cachedStorage.nuclearMode.expiresAt,
      ).getTime();
      if (isNaN(expiresAt) || expiresAt <= Date.now()) {
        markSelfWrite();
        await writeStorage({ nuclearMode: null });
        cachedStorage = { ...cachedStorage, nuclearMode: null };
      }
    }

    await reconcileRules(cachedStorage);
    rebuildBlockedDomainsSet();
    await scanAllTabs();
    resolveInit();
  })();
});
