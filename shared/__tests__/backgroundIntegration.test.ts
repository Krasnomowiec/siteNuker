import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StorageSchema, SiteConfig, DomainUsage } from '../types';
import {
  type DomainSession,
  createWriteLock,
  createSelfWriteTracker,
  buildBlockedDomainsSet,
  accumulateSessionUsage,
  pruneHistory,
} from '../backgroundHelpers';
import { isDomainBlocked, reconcileRules } from '../blocking';
import { getTodayKey, extractDomain, findMatchingSite } from '../utils';
import { DOMAIN_ALIASES } from '../constants';

/* ── Test helpers ── */

function makeSite(
  domain: string,
  dailyLimitMinutes: number = 10,
): SiteConfig {
  return {
    id: crypto.randomUUID(),
    domain,
    dailyLimitMinutes,
    initialLimitMinutes: dailyLimitMinutes,
    isPreset: false,
    addedAt: new Date().toISOString(),
  };
}

function makeStorage(overrides: Partial<StorageSchema> = {}): StorageSchema {
  return {
    version: 1,
    isEnabled: true,
    nuclearMode: null,
    sites: [],
    usage: {},
    history: {},
    ...overrides,
  };
}

/* ── Integration: Full tracking → blocking flow ── */

describe('Background integration: tracking → flush → blocking', () => {
  it('accumulates usage from multiple sessions and detects when limit is exceeded', () => {
    const youtube = makeSite('youtube.com', 10); // 10 min = 600s
    const reddit = makeSite('reddit.com', 5); // 5 min = 300s
    const now = Date.now();

    // Simulate two active sessions
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1, 2]),
      sessionStart: now - 8 * 60 * 1000, // 8 minutes ago
      baseUsedSeconds: 120, // 2 minutes already accumulated
    });
    sessions.set('reddit.com', {
      tabIds: new Set([3]),
      sessionStart: now - 4 * 60 * 1000, // 4 minutes ago
      baseUsedSeconds: 60, // 1 minute already accumulated
    });

    // MAX_ELAPSED in real background is 12, but for integration test use higher cap
    const maxElapsed = 600;

    const dayUsage: Record<string, DomainUsage> = {};
    const { updatedDayUsage, changed } = accumulateSessionUsage(
      sessions,
      dayUsage,
      maxElapsed,
    );

    expect(changed).toBe(true);

    // youtube: baseUsed(120) + elapsed(~480) = ~600s → at limit
    const ytUsed = updatedDayUsage['youtube.com']!.usedSeconds;
    expect(ytUsed).toBeGreaterThanOrEqual(590); // allow small timing variance
    expect(isDomainBlocked(youtube, ytUsed)).toBe(true);

    // reddit: baseUsed(60) + elapsed(~240) = ~300s → at limit
    const rdUsed = updatedDayUsage['reddit.com']!.usedSeconds;
    expect(rdUsed).toBeGreaterThanOrEqual(290);
    expect(isDomainBlocked(reddit, rdUsed)).toBe(true);
  });

  it('does not block domains under their limit', () => {
    const site = makeSite('facebook.com', 30); // 30 min = 1800s
    const sessions = new Map<string, DomainSession>();
    sessions.set('facebook.com', {
      tabIds: new Set([1]),
      sessionStart: Date.now() - 5 * 60 * 1000, // 5 minutes
      baseUsedSeconds: 0,
    });

    const { updatedDayUsage } = accumulateSessionUsage(
      sessions,
      {},
      600,
    );

    const used = updatedDayUsage['facebook.com']!.usedSeconds;
    expect(used).toBeLessThan(1800);
    expect(isDomainBlocked(site, used)).toBe(false);
  });
});

/* ── Integration: Domain alias resolution → site matching ── */

describe('Background integration: alias resolution', () => {
  it('resolves youtu.be to youtube.com for tracking', () => {
    const sites = [makeSite('youtube.com')];
    const hostname = extractDomain('https://youtu.be/abc', DOMAIN_ALIASES);
    expect(hostname).toBe('youtube.com');

    const match = findMatchingSite(hostname!, sites, DOMAIN_ALIASES);
    expect(match).toBeDefined();
    expect(match!.domain).toBe('youtube.com');
  });

  it('resolves youtu.be to youtube.com', () => {
    const hostname = extractDomain('https://youtu.be/abc123', DOMAIN_ALIASES);
    expect(hostname).toBe('youtube.com');
  });

  it('matches subdomains to parent domain', () => {
    const sites = [makeSite('youtube.com')];
    const match = findMatchingSite(
      'music.youtube.com',
      sites,
      DOMAIN_ALIASES,
    );
    expect(match).toBeDefined();
    expect(match!.domain).toBe('youtube.com');
  });
});

/* ── Integration: buildBlockedDomainsSet ── */

describe('Background integration: blocked domains rebuild', () => {
  it('identifies all blocked domains from storage state', () => {
    const sites = [
      makeSite('youtube.com', 10),
      makeSite('reddit.com', 5),
      makeSite('facebook.com', 30),
    ];
    const dayUsage: Record<string, DomainUsage> = {
      'youtube.com': { usedSeconds: 700, blockedAttempts: 2, limitChanges: [] },
      'reddit.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] },
      'facebook.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] },
    };

    const blocked = buildBlockedDomainsSet(sites, dayUsage);

    expect(blocked.has('youtube.com')).toBe(true); // 700 >= 600
    expect(blocked.has('reddit.com')).toBe(true); // 300 >= 300
    expect(blocked.has('facebook.com')).toBe(false); // 100 < 1800
    expect(blocked.size).toBe(2);
  });

  it('returns empty set when no domains exceed limits', () => {
    const sites = [makeSite('youtube.com', 60)];
    const dayUsage: Record<string, DomainUsage> = {
      'youtube.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] },
    };

    const blocked = buildBlockedDomainsSet(sites, dayUsage);
    expect(blocked.size).toBe(0);
  });
});

/* ── Integration: Date rollover → history archival ── */

describe('Background integration: date rollover + history', () => {
  it('prunes history entries older than retention period', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2026-03-01': { 'youtube.com': { usedSeconds: 500, blockedAttempts: 1, limitChanges: [] } },
      '2026-03-15': { 'reddit.com': { usedSeconds: 200, blockedAttempts: 0, limitChanges: [] } },
      '2026-04-01': { 'facebook.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] } },
    };

    // Cutoff: 2026-03-05 — anything before should be pruned
    const pruned = pruneHistory(history, '2026-03-05');

    expect(pruned['2026-03-01']).toBeUndefined(); // pruned
    expect(pruned['2026-03-15']).toBeDefined(); // kept
    expect(pruned['2026-04-01']).toBeDefined(); // kept
  });

  it('preserves all entries when none are stale', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2026-04-01': { 'youtube.com': { usedSeconds: 500, blockedAttempts: 0, limitChanges: [] } },
      '2026-04-02': { 'reddit.com': { usedSeconds: 200, blockedAttempts: 0, limitChanges: [] } },
    };

    const pruned = pruneHistory(history, '2026-03-01');
    expect(Object.keys(pruned)).toHaveLength(2);
  });
});

/* ── Integration: Write lock serialization ── */

describe('Background integration: write lock', () => {
  it('serializes concurrent writes', async () => {
    const { withLock } = createWriteLock();
    const order: number[] = [];

    const p1 = withLock(async () => {
      await new Promise((r) => setTimeout(r, 50));
      order.push(1);
    });
    const p2 = withLock(async () => {
      order.push(2);
    });

    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('releases lock even after error', async () => {
    const { withLock } = createWriteLock();

    await expect(
      withLock(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Lock should be released — next operation should succeed
    const result = await withLock(async () => 'ok');
    expect(result).toBe('ok');
  });
});

/* ── Integration: Self-write tracker ── */

describe('Background integration: self-write tracker', () => {
  it('detects recent self-writes and consumes them', () => {
    const tracker = createSelfWriteTracker();
    tracker.mark();

    expect(tracker.consumeIfRecent()).toBe(true);
    // Consumed — second call should return false
    expect(tracker.consumeIfRecent()).toBe(false);
  });

  it('ignores stale writes', () => {
    const tracker = createSelfWriteTracker(50, 100, 200);
    tracker.mark();

    // Simulate time passing beyond recentWindowMs
    const future = Date.now() + 150;
    expect(tracker.consumeIfRecent(future)).toBe(false);
  });
});

/* ── Integration: Limit change → unblock scenario ── */

describe('Background integration: limit change scenarios', () => {
  it('site becomes blocked when limit is lowered below usage', () => {
    const site = makeSite('youtube.com', 5); // 5 min = 300s
    const usedSeconds = 350;

    expect(isDomainBlocked(site, usedSeconds)).toBe(true);
  });

  it('site becomes unblocked when limit is raised above usage', () => {
    const site = makeSite('youtube.com', 15); // 15 min = 900s
    const usedSeconds = 350;

    expect(isDomainBlocked(site, usedSeconds)).toBe(false);
  });

  it('zero-limit blocks immediately', () => {
    const site = makeSite('youtube.com', 0);
    expect(isDomainBlocked(site, 0)).toBe(true);
  });
});

/* ── Integration: Nuclear mode + reconcile rules ── */

describe('Background integration: nuclear mode reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconcileRules adds nuclear rules when nuclear mode is active', async () => {
    const updateDynamicRules = vi.mocked(browser.declarativeNetRequest.updateDynamicRules);
    const getDynamicRules = browser.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>;
    getDynamicRules.mockResolvedValue([]);

    const storage = makeStorage({
      isEnabled: true,
      sites: [makeSite('youtube.com'), makeSite('reddit.com')],
      nuclearMode: {
        activatedAt: new Date().toISOString(),
        durationMinutes: 60,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });

    await reconcileRules(storage);

    // Should have called updateDynamicRules to add nuclear rules
    const addCalls = updateDynamicRules.mock.calls.filter(
      (call) => call[0].addRules && call[0].addRules.length > 0,
    );
    expect(addCalls.length).toBeGreaterThan(0);
  });

  it('reconcileRules does nothing when extension is disabled', async () => {
    const updateDynamicRules = vi.mocked(browser.declarativeNetRequest.updateDynamicRules);
    const getDynamicRules = browser.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>;
    getDynamicRules.mockResolvedValue([]);

    const storage = makeStorage({ isEnabled: false });
    await reconcileRules(storage);

    // Should only have removed all rules (cleanup), no additions
    const addCalls = updateDynamicRules.mock.calls.filter(
      (call) => call[0].addRules && call[0].addRules.length > 0,
    );
    expect(addCalls).toHaveLength(0);
  });

  it('reconcileRules adds block rules for over-limit sites', async () => {
    const updateDynamicRules = vi.mocked(browser.declarativeNetRequest.updateDynamicRules);
    const getDynamicRules = browser.declarativeNetRequest.getDynamicRules as ReturnType<typeof vi.fn>;
    getDynamicRules.mockResolvedValue([]);

    const today = getTodayKey();
    const storage = makeStorage({
      isEnabled: true,
      sites: [makeSite('youtube.com', 10)],
      usage: {
        [today]: {
          'youtube.com': { usedSeconds: 700, blockedAttempts: 1, limitChanges: [] },
        },
      },
    });

    await reconcileRules(storage);

    // Should have added a blocking rule for youtube.com
    const addCalls = updateDynamicRules.mock.calls.filter(
      (call) => call[0].addRules && call[0].addRules.length > 0,
    );
    expect(addCalls.length).toBeGreaterThan(0);
  });
});
