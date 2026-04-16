import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  type DomainSession,
  getSessionElapsed,
  getUsedSeconds,
  createWriteLock,
  createSelfWriteTracker,
  buildBlockedDomainsSet,
  accumulateSessionUsage,
  pruneHistory,
} from '../backgroundHelpers';
import type { StorageSchema, DomainUsage } from '../types';

/* ── getSessionElapsed ── */

describe('getSessionElapsed', () => {
  it('returns 0 when sessionStart is 0', () => {
    const session: DomainSession = {
      tabIds: new Set([1]),
      sessionStart: 0,
      baseUsedSeconds: 100,
    };
    expect(getSessionElapsed(session, 12)).toBe(0);
  });

  it('returns elapsed seconds since session start', () => {
    const now = Date.now();
    const session: DomainSession = {
      tabIds: new Set([1]),
      sessionStart: now - 5000, // 5 seconds ago
      baseUsedSeconds: 0,
    };
    expect(getSessionElapsed(session, 12, now)).toBe(5);
  });

  it('caps elapsed at maxElapsed to handle system sleep', () => {
    const now = Date.now();
    const session: DomainSession = {
      tabIds: new Set([1]),
      sessionStart: now - 60_000, // 60 seconds ago (way over max)
      baseUsedSeconds: 0,
    };
    expect(getSessionElapsed(session, 12, now)).toBe(12);
  });

  it('floors fractional seconds', () => {
    const now = Date.now();
    const session: DomainSession = {
      tabIds: new Set([1]),
      sessionStart: now - 3500, // 3.5 seconds
      baseUsedSeconds: 0,
    };
    expect(getSessionElapsed(session, 12, now)).toBe(3);
  });
});

/* ── getUsedSeconds ── */

describe('getUsedSeconds', () => {
  const MAX_ELAPSED = 12;

  it('returns in-memory session value when actively tracked', () => {
    const now = Date.now();
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1]),
      sessionStart: now - 3000,
      baseUsedSeconds: 100,
    });

    const result = getUsedSeconds('youtube.com', sessions, null, '2025-01-01', MAX_ELAPSED);
    expect(result).toBe(103); // 100 base + 3 elapsed
  });

  it('returns stored value when no active session', () => {
    const sessions = new Map<string, DomainSession>();
    const storage: StorageSchema = {
      version: 1,
      isEnabled: true,
      nuclearMode: null,
      sites: [],
      usage: { '2025-01-01': { 'youtube.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] } } },
      history: {},
    };

    const result = getUsedSeconds('youtube.com', sessions, storage, '2025-01-01', MAX_ELAPSED);
    expect(result).toBe(300);
  });

  it('returns 0 when no session and no stored data', () => {
    const sessions = new Map<string, DomainSession>();
    const result = getUsedSeconds('unknown.com', sessions, null, '2025-01-01', MAX_ELAPSED);
    expect(result).toBe(0);
  });
});

/* ── createWriteLock ── */

describe('createWriteLock', () => {
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
    expect(order).toEqual([1, 2]); // p2 waits for p1
  });

  it('releases lock even on error', async () => {
    const { withLock } = createWriteLock();

    await expect(
      withLock(async () => {
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');

    // Lock should be released — next operation should succeed
    const result = await withLock(async () => 42);
    expect(result).toBe(42);
  });

  it('returns the value from the locked function', async () => {
    const { withLock } = createWriteLock();
    const result = await withLock(async () => 'hello');
    expect(result).toBe('hello');
  });
});

/* ── createSelfWriteTracker ── */

describe('createSelfWriteTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('consumes a recent write', () => {
    const tracker = createSelfWriteTracker();
    tracker.mark();
    expect(tracker.consumeIfRecent()).toBe(true);
    // Second consume should return false (already consumed)
    expect(tracker.consumeIfRecent()).toBe(false);
  });

  it('does not consume when no writes exist', () => {
    const tracker = createSelfWriteTracker();
    expect(tracker.consumeIfRecent()).toBe(false);
  });

  it('does not consume stale writes', () => {
    const tracker = createSelfWriteTracker(50, 2000, 5000);
    tracker.mark();
    vi.advanceTimersByTime(3000); // Past the 2s recent window
    expect(tracker.consumeIfRecent(Date.now())).toBe(false);
  });

  it('prunes stale entries on consume check', () => {
    const tracker = createSelfWriteTracker(50, 2000, 5000);
    tracker.mark();
    vi.advanceTimersByTime(6000); // Past the 5s stale window
    // Should prune and return false
    expect(tracker.consumeIfRecent(Date.now())).toBe(false);
  });

  it('caps entries and splices when exceeding max', () => {
    const tracker = createSelfWriteTracker(4, 2000, 5000);
    tracker.mark();
    tracker.mark();
    tracker.mark();
    tracker.mark(); // At max
    tracker.mark(); // Should trigger splice (removes first 2)
    // Should still have recent entries
    expect(tracker.consumeIfRecent()).toBe(true);
  });
});

/* ── buildBlockedDomainsSet ── */

describe('buildBlockedDomainsSet', () => {
  it('returns empty set when no sites exceed limits', () => {
    const sites = [
      { id: '1', domain: 'youtube.com', dailyLimitMinutes: 10, baseLimitMinutes: 10, isPreset: true, addedAt: '' },
    ];
    const dayUsage = { 'youtube.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] } };

    const result = buildBlockedDomainsSet(sites, dayUsage);
    expect(result.size).toBe(0);
  });

  it('includes domains that exceed their limit', () => {
    const sites = [
      { id: '1', domain: 'youtube.com', dailyLimitMinutes: 10, baseLimitMinutes: 10, isPreset: true, addedAt: '' },
      { id: '2', domain: 'reddit.com', dailyLimitMinutes: 5, baseLimitMinutes: 5, isPreset: true, addedAt: '' },
    ];
    const dayUsage: Record<string, DomainUsage> = {
      'youtube.com': { usedSeconds: 600, blockedAttempts: 0, limitChanges: [] }, // exactly at limit
      'reddit.com': { usedSeconds: 200, blockedAttempts: 0, limitChanges: [] }, // under limit
    };

    const result = buildBlockedDomainsSet(sites, dayUsage);
    expect(result.has('youtube.com')).toBe(true);
    expect(result.has('reddit.com')).toBe(false);
  });

  it('handles empty usage', () => {
    const sites = [
      { id: '1', domain: 'youtube.com', dailyLimitMinutes: 10, baseLimitMinutes: 10, isPreset: true, addedAt: '' },
    ];
    const result = buildBlockedDomainsSet(sites, {});
    expect(result.size).toBe(0);
  });

  it('blocks domain with 0-minute limit', () => {
    const sites = [
      { id: '1', domain: 'youtube.com', dailyLimitMinutes: 0, baseLimitMinutes: 0, isPreset: true, addedAt: '' },
    ];
    const result = buildBlockedDomainsSet(sites, {});
    expect(result.has('youtube.com')).toBe(true);
  });
});

/* ── accumulateSessionUsage ── */

describe('accumulateSessionUsage', () => {
  it('accumulates elapsed time into day usage', () => {
    const now = Date.now();
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1]),
      sessionStart: now - 5000,
      baseUsedSeconds: 100,
    });

    const { updatedDayUsage, changed } = accumulateSessionUsage(sessions, {}, 12);

    expect(changed).toBe(true);
    expect(updatedDayUsage['youtube.com']?.usedSeconds).toBe(105);
  });

  it('returns changed=false when no new usage', () => {
    const now = Date.now();
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1]),
      sessionStart: now,
      baseUsedSeconds: 300,
    });

    const existing: Record<string, DomainUsage> = {
      'youtube.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] },
    };

    const { changed } = accumulateSessionUsage(sessions, existing, 12);
    expect(changed).toBe(false);
  });

  it('preserves existing blockedAttempts and limitChanges', () => {
    const now = Date.now();
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1]),
      sessionStart: now - 10_000,
      baseUsedSeconds: 0,
    });

    const existing: Record<string, DomainUsage> = {
      'youtube.com': {
        usedSeconds: 5,
        blockedAttempts: 3,
        limitChanges: [{ timestamp: '', from: 10, to: 15 }],
      },
    };

    const { updatedDayUsage } = accumulateSessionUsage(sessions, existing, 12);
    expect(updatedDayUsage['youtube.com']?.blockedAttempts).toBe(3);
    expect(updatedDayUsage['youtube.com']?.limitChanges).toHaveLength(1);
  });

  it('handles multiple domains', () => {
    const now = Date.now();
    const sessions = new Map<string, DomainSession>();
    sessions.set('youtube.com', {
      tabIds: new Set([1]),
      sessionStart: now - 3000,
      baseUsedSeconds: 10,
    });
    sessions.set('reddit.com', {
      tabIds: new Set([2]),
      sessionStart: now - 7000,
      baseUsedSeconds: 20,
    });

    const { updatedDayUsage, changed } = accumulateSessionUsage(sessions, {}, 12);
    expect(changed).toBe(true);
    expect(updatedDayUsage['youtube.com']?.usedSeconds).toBe(13);
    expect(updatedDayUsage['reddit.com']?.usedSeconds).toBe(27);
  });
});

/* ── pruneHistory ── */

describe('pruneHistory', () => {
  it('removes entries older than cutoff', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2025-01-01': { 'youtube.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] } },
      '2025-01-15': { 'youtube.com': { usedSeconds: 200, blockedAttempts: 0, limitChanges: [] } },
      '2025-02-01': { 'youtube.com': { usedSeconds: 300, blockedAttempts: 0, limitChanges: [] } },
    };

    const result = pruneHistory(history, '2025-01-10');
    expect(Object.keys(result)).toEqual(['2025-01-15', '2025-02-01']);
  });

  it('keeps all entries when none are older than cutoff', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2025-03-01': { 'youtube.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] } },
      '2025-03-02': { 'youtube.com': { usedSeconds: 200, blockedAttempts: 0, limitChanges: [] } },
    };

    const result = pruneHistory(history, '2025-02-01');
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('returns empty when all entries are pruned', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2024-01-01': { 'youtube.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] } },
    };

    const result = pruneHistory(history, '2025-01-01');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('does not mutate original object', () => {
    const history: Record<string, Record<string, DomainUsage>> = {
      '2025-01-01': { 'youtube.com': { usedSeconds: 100, blockedAttempts: 0, limitChanges: [] } },
    };
    const original = { ...history };
    pruneHistory(history, '2025-02-01');
    expect(Object.keys(history)).toEqual(Object.keys(original));
  });
});
