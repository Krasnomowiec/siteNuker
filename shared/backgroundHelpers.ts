import type { StorageSchema, SiteConfig, DomainUsage } from './types';
import { isDomainBlocked } from './blocking';

/* ── Domain Session ── */

export interface DomainSession {
  tabIds: Set<number>;
  sessionStart: number;
  baseUsedSeconds: number;
}

/**
 * Elapsed seconds since session start, capped at maxElapsed to handle
 * system sleep (avoids counting hours of sleep as usage).
 */
export function getSessionElapsed(
  session: DomainSession,
  maxElapsed: number,
  now: number = Date.now(),
): number {
  if (session.sessionStart === 0) return 0;
  const raw = Math.floor((now - session.sessionStart) / 1000);
  return Math.min(raw, maxElapsed);
}

/**
 * Total used seconds for a domain, combining in-memory session
 * (if active) with persisted storage data.
 */
export function getUsedSeconds(
  domain: string,
  trackedSessions: Map<string, DomainSession>,
  cachedStorage: StorageSchema | null,
  currentDateKey: string,
  maxElapsed: number,
): number {
  const session = trackedSessions.get(domain);
  if (session) {
    return session.baseUsedSeconds + getSessionElapsed(session, maxElapsed);
  }
  const dayUsage = cachedStorage?.usage[currentDateKey] ?? {};
  return dayUsage[domain]?.usedSeconds ?? 0;
}

/* ── Write Lock ── */

export interface WriteLockHandle {
  withLock: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Promise-based mutex that serializes async storage writes
 * to prevent lost updates from concurrent operations.
 * Includes a safety timeout to prevent deadlocks.
 */
export function createWriteLock(timeoutMs: number = 10_000): WriteLockHandle {
  let lock: Promise<void> | null = null;

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (lock) {
      if (Date.now() > deadline) {
        console.error('[SitesNuker] Write lock timeout — forcing release');
        lock = null;
        break;
      }
      await lock;
    }
    let unlock: () => void;
    lock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    try {
      return await fn();
    } finally {
      lock = null;
      unlock!();
    }
  }

  return { withLock };
}

/* ── Self-Write Tracker ── */

export interface SelfWriteTracker {
  mark: () => void;
  consumeIfRecent: (now?: number) => boolean;
}

/**
 * Tracks timestamps of background's own storage writes so the
 * storage.onChanged listener can distinguish self-writes from
 * external changes (popup, other background operations).
 */
export function createSelfWriteTracker(
  maxEntries: number = 50,
  recentWindowMs: number = 2000,
  staleWindowMs: number = 5000,
): SelfWriteTracker {
  const timestamps: number[] = [];

  function mark(): void {
    if (timestamps.length >= maxEntries) timestamps.splice(0, Math.floor(maxEntries / 2));
    timestamps.push(Date.now());
  }

  function consumeIfRecent(now: number = Date.now()): boolean {
    const recentIndex = timestamps.findIndex((ts) => now - ts < recentWindowMs);
    if (recentIndex !== -1) {
      timestamps.splice(recentIndex, 1);
      return true;
    }
    // Prune stale entries
    while (timestamps.length > 0 && now - timestamps[0]! > staleWindowMs) {
      timestamps.shift();
    }
    return false;
  }

  return { mark, consumeIfRecent };
}

/* ── Blocked Domains Rebuild ── */

/**
 * Rebuild the set of currently blocked domains from storage state.
 * Pure function — no browser API calls.
 */
export function buildBlockedDomainsSet(
  sites: SiteConfig[],
  dayUsage: Record<string, DomainUsage>,
): Set<string> {
  const blocked = new Set<string>();
  for (const site of sites) {
    const usedSeconds = dayUsage[site.domain]?.usedSeconds ?? 0;
    if (isDomainBlocked(site, usedSeconds)) {
      blocked.add(site.domain);
    }
  }
  return blocked;
}

/* ── Usage Accumulation ── */

/**
 * Compute updated day usage by accumulating elapsed time from all
 * tracked sessions. Returns new dayUsage object and whether anything changed.
 */
export function accumulateSessionUsage(
  trackedSessions: Map<string, DomainSession>,
  dayUsage: Record<string, DomainUsage>,
  maxElapsed: number,
): { updatedDayUsage: Record<string, DomainUsage>; changed: boolean } {
  const updated = { ...dayUsage };
  let changed = false;

  for (const [domain, session] of trackedSessions) {
    const currentUsed = session.baseUsedSeconds + getSessionElapsed(session, maxElapsed);
    const domainUsage = updated[domain] ?? {
      usedSeconds: 0,
      blockedAttempts: 0,
      limitChanges: [],
    };

    if (currentUsed !== domainUsage.usedSeconds) {
      updated[domain] = { ...domainUsage, usedSeconds: currentUsed };
      changed = true;
    }
  }

  return { updatedDayUsage: updated, changed };
}

/* ── History Pruning ── */

/**
 * Prune history entries older than retentionDays.
 * Returns new history object without stale entries.
 */
export function pruneHistory(
  history: Record<string, Record<string, DomainUsage>>,
  cutoffKey: string,
): Record<string, Record<string, DomainUsage>> {
  const pruned = { ...history };
  for (const key of Object.keys(pruned)) {
    if (key < cutoffKey) {
      delete pruned[key];
    }
  }
  return pruned;
}
