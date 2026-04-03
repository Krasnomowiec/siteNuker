import type { StorageSchema } from '@/shared/types';
import { readStorage, writeStorage } from '@/shared/storage';
import { DOMAIN_ALIASES } from '@/shared/constants';
import { extractDomain, getTodayKey, getDateKey } from '@/shared/utils';
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
const IDLE_THRESHOLD_SECONDS = 60;
const ICON_SIZE = 64;

const DEFAULT_ICON: Record<number, string> = {
  16: '/icon/16.png',
  32: '/icon/32.png',
  48: '/icon/48.png',
  96: '/icon/96.png',
  128: '/icon/128.png',
};

export default defineBackground(() => {
  // --- In-memory state ---
  let activeTabId: number | null = null;
  let activeDomain: string | null = null;
  let isWindowFocused = true;
  let isUserActive = true;
  let domainSessionStart = 0;
  let baseUsedSeconds = 0;
  let tickCount = 0;
  let cachedStorage: StorageSchema | null = null;
  let currentDateKey = getTodayKey();
  /**
   * Track own writes by timestamp. Each self-write adds Date.now().
   * When onChanged fires, if a recent self-write exists (<2s), consume it.
   * This avoids the counter desync when events arrive out of order.
   */
  const pendingSelfWrites: number[] = [];
  /** Domains blocked by site-level rules (limit exceeded) */
  const blockedDomains = new Set<string>();
  /** Simple async lock to prevent overlapping evaluateActiveTab calls */
  let evaluateLock: Promise<void> | null = null;
  /** Lock for storage writes to prevent lost updates */
  let writeLock: Promise<void> | null = null;

  // --- Helpers ---

  function getElapsed(): number {
    if (domainSessionStart === 0) return 0;
    return Math.floor((Date.now() - domainSessionStart) / 1000);
  }

  function isTracking(): boolean {
    return (
      activeDomain !== null &&
      isWindowFocused &&
      isUserActive &&
      cachedStorage?.isEnabled === true
    );
  }

  function pauseTracking(): void {
    if (activeDomain && domainSessionStart > 0) {
      baseUsedSeconds += getElapsed();
      domainSessionStart = 0;
    }
  }

  function resumeTracking(): void {
    if (
      activeDomain &&
      isWindowFocused &&
      isUserActive &&
      cachedStorage?.isEnabled
    ) {
      domainSessionStart = Date.now();
    }
  }

  // --- Hybrid countdown: icon (minutes) + badge (seconds) ---

  const iconCanvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const iconCtx = iconCanvas.getContext('2d');
  if (!iconCtx) {
    console.error('[background] OffscreenCanvas 2d context unavailable');
  }
  let lastIconKey = '';
  let iconActive = false;

  function renderMinutesIcon(
    minutes: number,
    bgColor: string,
    tabId?: number,
  ): void {
    if (!iconCtx) return;
    const key = `${minutes}|${bgColor}|${tabId ?? ''}`;
    if (key === lastIconKey) return;
    lastIconKey = key;

    const s = ICON_SIZE;
    iconCtx.clearRect(0, 0, s, s);

    iconCtx.beginPath();
    iconCtx.roundRect(0, 0, s, s, 8);
    iconCtx.fillStyle = bgColor;
    iconCtx.fill();

    const text = String(minutes);
    const fontSize = text.length <= 2 ? 34 : 26;
    iconCtx.fillStyle = '#ffffff';
    iconCtx.textAlign = 'center';
    iconCtx.textBaseline = 'middle';
    iconCtx.font = `bold ${fontSize}px system-ui, sans-serif`;
    iconCtx.fillText(text, s / 2, s / 2);

    const imageData = iconCtx.getImageData(0, 0, s, s);
    const args =
      tabId != null
        ? { imageData: imageData as unknown as ImageData, tabId }
        : { imageData: imageData as unknown as ImageData };
    browser.action.setIcon(args).catch(() => {});
    iconActive = true;
  }

  function updateSecondsLabel(
    seconds: number,
    bgColor: string,
    tabId?: number,
  ): void {
    const text = String(seconds).padStart(2, '0');
    const tabArg = tabId != null ? { tabId } : {};
    browser.action.setBadgeText({ text, ...tabArg }).catch(() => {});
    browser.action
      .setBadgeBackgroundColor({ color: bgColor, ...tabArg })
      .catch(() => {});
    browser.action
      .setBadgeTextColor({ color: '#ffffff', ...tabArg })
      .catch(() => {});
  }

  function clearCountdown(tabId?: number): void {
    const tabArg = tabId != null ? { tabId } : {};
    if (iconActive) {
      browser.action
        .setIcon({ path: DEFAULT_ICON, ...tabArg })
        .catch(() => {});
      iconActive = false;
      lastIconKey = '';
    }
    browser.action.setBadgeText({ text: '', ...tabArg }).catch(() => {});
  }

  function updateBadge(): void {
    if (!cachedStorage || !cachedStorage.isEnabled) {
      clearCountdown();
      return;
    }

    // Nuclear mode takes priority (global)
    if (cachedStorage.nuclearMode) {
      const expiresAt = new Date(cachedStorage.nuclearMode.expiresAt).getTime();
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      if (remaining <= 0) {
        clearCountdown();
        handleNuclearExpired().catch(() => {});
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      renderMinutesIcon(mins, '#fe554a');
      updateSecondsLabel(secs, '#fe554a');
      return;
    }

    // Normal per-domain countdown
    if (!activeDomain || activeTabId == null) {
      clearCountdown();
      return;
    }

    const site = cachedStorage.sites.find((s) => s.domain === activeDomain);
    if (!site) {
      clearCountdown(activeTabId);
      return;
    }

    const limitSeconds = site.dailyLimitMinutes * 60;
    const currentUsed = baseUsedSeconds + getElapsed();
    const remaining = Math.max(0, limitSeconds - currentUsed);

    if (remaining <= 0) {
      renderMinutesIcon(0, '#fe554a', activeTabId);
      updateSecondsLabel(0, '#fe554a', activeTabId);
      return;
    }

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    renderMinutesIcon(mins, '#ffb874', activeTabId);
    updateSecondsLabel(secs, '#ffb874', activeTabId);
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

  async function flushUsage(): Promise<void> {
    return withWriteLock(flushUsageInner);
  }

  async function flushUsageInner(): Promise<void> {
    if (!activeDomain || !cachedStorage) return;

    const currentUsed = baseUsedSeconds + getElapsed();
    const dateKey = currentDateKey;
    const usage = { ...cachedStorage.usage };
    const dayUsage = { ...(usage[dateKey] ?? {}) };
    const domainUsage = dayUsage[activeDomain] ?? {
      usedSeconds: 0,
      blockedAttempts: 0,
      limitChanges: [],
    };

    dayUsage[activeDomain] = { ...domainUsage, usedSeconds: currentUsed };
    usage[dateKey] = dayUsage;

    pendingSelfWrites.push(Date.now());
    await writeStorage({ usage });
    cachedStorage = { ...cachedStorage, usage };

    baseUsedSeconds = currentUsed;
    if (domainSessionStart > 0) {
      domainSessionStart = Date.now();
    }
  }

  // --- Tab evaluation ---

  async function evaluateActiveTab(): Promise<void> {
    // Serialize concurrent calls to prevent state corruption
    while (evaluateLock) await evaluateLock;
    let unlock: () => void;
    evaluateLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    try {
      await evaluateActiveTabInner();
    } finally {
      evaluateLock = null;
      unlock!();
    }
  }

  async function evaluateActiveTabInner(): Promise<void> {
    if (!cachedStorage) return;

    let tabs;
    try {
      tabs = await browser.tabs.query({ active: true, currentWindow: true });
    } catch {
      return;
    }

    const tab = tabs[0];
    if (!tab?.id || !tab.url) {
      if (activeDomain) {
        await flushUsage();
        activeDomain = null;
        activeTabId = null;
      }
      clearCountdown();
      return;
    }

    const domain = extractDomain(tab.url, DOMAIN_ALIASES);
    const matchedSite = domain
      ? cachedStorage.sites.find((s) => s.domain === domain)
      : null;
    const newDomain = matchedSite ? matchedSite.domain : null;

    if (newDomain === activeDomain && tab.id === activeTabId) {
      return;
    }

    if (activeDomain) {
      await flushUsage();
    }

    activeTabId = tab.id;
    activeDomain = newDomain;

    if (activeDomain) {
      const dateKey = currentDateKey;
      const dayUsage = cachedStorage.usage[dateKey] ?? {};
      const domainUsage = dayUsage[activeDomain];
      baseUsedSeconds = domainUsage?.usedSeconds ?? 0;
      domainSessionStart = isWindowFocused && isUserActive ? Date.now() : 0;
    } else {
      baseUsedSeconds = 0;
      domainSessionStart = 0;
    }

    updateBadge();
  }

  // --- Nuclear expiry ---

  async function handleNuclearExpired(): Promise<void> {
    return withWriteLock(async () => {
      const sites = cachedStorage?.sites ?? [];
      pendingSelfWrites.push(Date.now());
      await writeStorage({ nuclearMode: null });
      if (cachedStorage) {
        cachedStorage = { ...cachedStorage, nuclearMode: null };
      }
      await removeNuclearRules(sites);
      // Re-add site-level rules for domains still over limit
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
      if (activeDomain) {
        await flushUsage();
      }

      // Archive previous day's usage to history (30-day retention)
      if (cachedStorage) {
        const oldDateKey = currentDateKey;
        const oldDayUsage = cachedStorage.usage[oldDateKey];

        if (oldDayUsage && Object.keys(oldDayUsage).length > 0) {
          const history = { ...cachedStorage.history };
          history[oldDateKey] = oldDayUsage;

          // Prune entries older than 30 days
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

          pendingSelfWrites.push(Date.now());
          await writeStorage({ history, usage });
          cachedStorage = { ...cachedStorage, history, usage };
        }
      }

      currentDateKey = newKey;
      baseUsedSeconds = 0;
      if (domainSessionStart > 0) {
        domainSessionStart = Date.now();
      }
      // Remove all site block rules (new day = fresh limits)
      if (cachedStorage && !cachedStorage.nuclearMode) {
        for (const site of cachedStorage.sites) {
          await removeSiteBlockRule(site);
        }
        blockedDomains.clear();
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
        if (tabDomain === domain) {
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
    pendingSelfWrites.push(Date.now());
    await writeStorage({ usage });
    cachedStorage = { ...cachedStorage, usage };
  }

  // --- Blocking check ---

  async function checkAndBlock(): Promise<void> {
    if (!cachedStorage || !activeDomain || !activeTabId) return;
    if (cachedStorage.nuclearMode) return;

    const site = cachedStorage.sites.find((s) => s.domain === activeDomain);
    if (!site) return;

    const currentUsed = baseUsedSeconds + getElapsed();

    if (
      isDomainBlocked(site, currentUsed) &&
      !blockedDomains.has(site.domain)
    ) {
      await flushUsage();
      await addSiteBlockRule(site);
      blockedDomains.add(site.domain);

      // Record the first blocked attempt for stats
      await incrementBlockedAttempts(site.domain);

      await notifyAllTabsForDomain(site.domain, 'showBlockOverlay');

      activeDomain = null;
      baseUsedSeconds = 0;
      domainSessionStart = 0;
      clearCountdown();
    }
  }

  // --- Rebuild blockedDomains from storage state (not rules) ---

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

  // --- Main tick (H2: all async calls wrapped with .catch) ---

  setInterval(() => {
    tickCount++;

    updateBadge();

    if (isTracking()) {
      checkAndBlock().catch(() => {});

      if (tickCount % FLUSH_INTERVAL_TICKS === 0) {
        flushUsage().catch(() => {});
      }
    }

    if (tickCount % DATE_CHECK_INTERVAL_TICKS === 0) {
      checkDateRollover().catch(() => {});
    }
  }, 1000);

  // --- Event listeners ---

  browser.tabs.onActivated.addListener(() => {
    evaluateActiveTab().catch(() => {});
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url && tabId === activeTabId) {
      evaluateActiveTab().catch(() => {});
    }
  });

  browser.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      isWindowFocused = false;
      if (activeDomain) flushUsage().catch(() => {});
      pauseTracking();
      updateBadge();
    } else {
      isWindowFocused = true;
      resumeTracking();
      evaluateActiveTab().catch(() => {});
    }
  });

  browser.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  browser.idle.onStateChanged.addListener((state) => {
    if (state === 'active') {
      isUserActive = true;
      resumeTracking();
    } else {
      isUserActive = false;
      if (activeDomain) flushUsage().catch(() => {});
      pauseTracking();
    }
    updateBadge();
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

      const used =
        cachedStorage!.usage[currentDateKey]?.[site.domain]?.usedSeconds ?? 0;

      if (
        site.dailyLimitMinutes > prevSite.dailyLimitMinutes &&
        blockedDomains.has(site.domain)
      ) {
        if (used < site.dailyLimitMinutes * 60) {
          await removeSiteBlockRule(site);
          blockedDomains.delete(site.domain);
        }
      } else if (
        site.dailyLimitMinutes < prevSite.dailyLimitMinutes &&
        !blockedDomains.has(site.domain)
      ) {
        if (used >= site.dailyLimitMinutes * 60) {
          await addSiteBlockRule(site);
          blockedDomains.add(site.domain);
          await notifyAllTabsForDomain(site.domain, 'showBlockOverlay');
          if (activeDomain === site.domain) {
            activeDomain = null;
            baseUsedSeconds = 0;
            domainSessionStart = 0;
            clearCountdown();
          }
        }
      }
    }
  }

  async function handleNuclearActivation(): Promise<void> {
    await addNuclearRules(cachedStorage!.sites);
    rebuildBlockedDomainsSet();

    const nuclearDomains = new Set(
      cachedStorage!.sites.map((s) => s.domain),
    );
    try {
      const tabs = await browser.tabs.query({});
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        const tabDomain = extractDomain(tab.url, DOMAIN_ALIASES);
        if (tabDomain && nuclearDomains.has(tabDomain)) {
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
    pauseTracking();
    clearCountdown();
  }

  async function handleExtensionEnabled(): Promise<void> {
    await reconcileRules(cachedStorage!);
    rebuildBlockedDomainsSet();
  }

  // --- Storage change listener ---

  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;

    // Consume a recent self-write (within 2s) if one exists
    const now = Date.now();
    const recentIndex = pendingSelfWrites.findIndex((ts) => now - ts < 2000);
    if (recentIndex !== -1) {
      pendingSelfWrites.splice(recentIndex, 1);
      return;
    }
    while (pendingSelfWrites.length > 0 && now - pendingSelfWrites[0] > 5000) {
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

    await evaluateActiveTab();
  });

  // --- Messaging: expose live state to popup AND block page ---

  browser.runtime.onMessage.addListener((message, sender) => {
    if (message?.type === 'getActiveState') {
      const usedSeconds = activeDomain ? baseUsedSeconds + getElapsed() : 0;
      return Promise.resolve({ activeDomain, usedSeconds });
    }

    // Content script reports a blocked visit attempt (repeat navigation)
    if (message?.type === 'recordBlockedAttempt' && sender?.tab?.url) {
      const domain = extractDomain(sender.tab.url, DOMAIN_ALIASES);
      if (domain && cachedStorage) {
        incrementBlockedAttempts(domain).catch(() => {});
      }
      return Promise.resolve({ ok: true });
    }

    // Content script asks if current domain is blocked
    if (message?.type === 'isCurrentSiteBlocked' && sender?.tab?.url) {
      const domain = extractDomain(sender.tab.url, DOMAIN_ALIASES);
      const blocked = domain ? blockedDomains.has(domain) : false;
      const nuclear =
        cachedStorage?.nuclearMode != null &&
        new Date(cachedStorage.nuclearMode.expiresAt).getTime() > Date.now();
      return Promise.resolve({ blocked: blocked || nuclear });
    }

    return undefined;
  });

  // --- Init ---

  (async () => {
    cachedStorage = await readStorage();
    clearCountdown();

    // Clear expired nuclear mode before reconciling rules
    if (cachedStorage.nuclearMode) {
      const expiresAt = new Date(
        cachedStorage.nuclearMode.expiresAt,
      ).getTime();
      if (expiresAt <= Date.now()) {
        pendingSelfWrites.push(Date.now());
        await writeStorage({ nuclearMode: null });
        cachedStorage = { ...cachedStorage, nuclearMode: null };
      }
    }

    // Reconcile blocking rules with current storage state
    await reconcileRules(cachedStorage);

    // Populate blockedDomains from storage state after reconcile
    rebuildBlockedDomainsSet();

    await evaluateActiveTab();
  })();
});
