import { describe, it, expect } from 'vitest';
import { computeAllStats } from '../statsComputation';
import type { StorageSchema, DailyUsage } from '../types';
import { getDateKey } from '../utils';

function makeStorage(
  overrides: Partial<StorageSchema> = {},
): StorageSchema {
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateKey(d);
}

function makeDayUsage(
  entries: Record<string, { usedSeconds: number; blockedAttempts?: number }>,
): DailyUsage {
  const result: DailyUsage = {};
  for (const [domain, data] of Object.entries(entries)) {
    result[domain] = {
      usedSeconds: data.usedSeconds,
      blockedAttempts: data.blockedAttempts ?? 0,
      limitChanges: [],
    };
  }
  return result;
}

describe('computeAllStats', () => {
  describe('with empty storage', () => {
    it('returns zeroed stats', () => {
      const stats = computeAllStats(makeStorage());

      expect(stats.northStar.avgDailyMinutes).toBe(0);
      expect(stats.northStar.percentChange).toBeNull();
      expect(stats.hero.reclaimedMinutes).toBe(0);
      expect(stats.hero.totalBlockedAttempts).toBe(0);
      expect(stats.todayBars).toHaveLength(0);
      expect(stats.totalTodayMinutes).toBe(0);
      expect(stats.weeklyTrend.days).toHaveLength(7);
      expect(stats.netLimitDrift).toBe(0);
    });
  });

  describe('todayBars', () => {
    it('computes bars for sites with usage today', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'youtube.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
            {
              id: '2',
              domain: 'reddit.com',
              dailyLimitMinutes: 20,
              initialLimitMinutes: 20,
              isPreset: true,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'youtube.com': { usedSeconds: 600 }, // 10min / 10min = 100%
              'reddit.com': { usedSeconds: 300 }, // 5min / 20min = 25%
            }),
          },
        }),
      );

      expect(stats.todayBars).toHaveLength(2);
      // Sorted by ratio descending — youtube (1.0) before reddit (0.25)
      expect(stats.todayBars[0]!.domain).toBe('youtube.com');
      expect(stats.todayBars[0]!.ratio).toBe(1.0);
      expect(stats.todayBars[0]!.colorTier).toBe('red');

      expect(stats.todayBars[1]!.domain).toBe('reddit.com');
      expect(stats.todayBars[1]!.colorTier).toBe('green');
    });

    it('skips sites with zero usage', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'youtube.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'youtube.com': { usedSeconds: 0 },
            }),
          },
        }),
      );

      expect(stats.todayBars).toHaveLength(0);
    });
  });

  describe('color tiers', () => {
    it('assigns green for ratio < 0.6', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'test.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: false,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'test.com': { usedSeconds: 300 }, // 5min / 10min = 0.5
            }),
          },
        }),
      );

      expect(stats.todayBars[0]!.colorTier).toBe('green');
    });

    it('assigns amber for ratio 0.6-0.85', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'test.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: false,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'test.com': { usedSeconds: 420 }, // 7min / 10min = 0.7
            }),
          },
        }),
      );

      expect(stats.todayBars[0]!.colorTier).toBe('amber');
    });

    it('assigns red-soft for ratio 0.85-1.0', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'test.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: false,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'test.com': { usedSeconds: 540 }, // 9min / 10min = 0.9
            }),
          },
        }),
      );

      expect(stats.todayBars[0]!.colorTier).toBe('red-soft');
    });

    it('assigns red for ratio >= 1.0', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'test.com',
              dailyLimitMinutes: 10,
              initialLimitMinutes: 10,
              isPreset: false,
              addedAt: '',
            },
          ],
          usage: {
            [todayKey]: makeDayUsage({
              'test.com': { usedSeconds: 660 }, // 11min / 10min = 1.1
            }),
          },
        }),
      );

      expect(stats.todayBars[0]!.colorTier).toBe('red');
    });
  });

  describe('hero stats (time reclaimed)', () => {
    it('calculates reclaimed minutes from blocked attempts', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          usage: {
            [todayKey]: makeDayUsage({
              'youtube.com': { usedSeconds: 600, blockedAttempts: 3 },
              'reddit.com': { usedSeconds: 300, blockedAttempts: 1 },
            }),
          },
        }),
      );

      // youtube: 3 * 12min = 36min, reddit: 1 * 8min = 8min
      expect(stats.hero.totalBlockedAttempts).toBe(4);
      expect(stats.hero.reclaimedMinutes).toBe(44);
    });

    it('returns zero when no blocked attempts', () => {
      const todayKey = daysAgo(0);
      const stats = computeAllStats(
        makeStorage({
          usage: {
            [todayKey]: makeDayUsage({
              'youtube.com': { usedSeconds: 300 },
            }),
          },
        }),
      );

      expect(stats.hero.totalBlockedAttempts).toBe(0);
      expect(stats.hero.reclaimedMinutes).toBe(0);
    });
  });

  describe('northStar', () => {
    it('computes 7-day rolling average', () => {
      const usage: Record<string, DailyUsage> = {};
      // 60 seconds per day for the last 7 days = 1 minute average
      for (let i = 0; i <= 6; i++) {
        usage[daysAgo(i)] = makeDayUsage({
          'youtube.com': { usedSeconds: 60 },
        });
      }

      const stats = computeAllStats(makeStorage({ usage }));
      expect(stats.northStar.avgDailyMinutes).toBe(1);
    });

    it('computes percent change vs previous period', () => {
      const usage: Record<string, DailyUsage> = {};
      const history: Record<string, DailyUsage> = {};

      // Current period: 10 min/day
      for (let i = 0; i <= 6; i++) {
        usage[daysAgo(i)] = makeDayUsage({
          'youtube.com': { usedSeconds: 600 },
        });
      }
      // Previous period: 20 min/day
      for (let i = 7; i <= 13; i++) {
        history[daysAgo(i)] = makeDayUsage({
          'youtube.com': { usedSeconds: 1200 },
        });
      }

      const stats = computeAllStats(makeStorage({ usage, history }));
      expect(stats.northStar.avgDailyMinutes).toBe(10);
      expect(stats.northStar.prevAvgDailyMinutes).toBe(20);
      expect(stats.northStar.percentChange).toBe(-50);
      expect(stats.northStar.changeDirection).toBe('down');
    });

    it('returns null percentChange when previous period too small', () => {
      const usage: Record<string, DailyUsage> = {};
      usage[daysAgo(0)] = makeDayUsage({
        'youtube.com': { usedSeconds: 600 },
      });

      const stats = computeAllStats(makeStorage({ usage }));
      expect(stats.northStar.percentChange).toBeNull();
      expect(stats.northStar.changeDirection).toBeNull();
    });
  });

  describe('weeklyTrend', () => {
    it('returns 7 days with correct structure', () => {
      const stats = computeAllStats(makeStorage());
      expect(stats.weeklyTrend.days).toHaveLength(7);

      for (const day of stats.weeklyTrend.days) {
        expect(day).toHaveProperty('dateKey');
        expect(day).toHaveProperty('dayLabel');
        expect(day).toHaveProperty('totalMinutes');
        expect(day).toHaveProperty('isToday');
        expect(day).toHaveProperty('isFuture');
      }
    });

    it('marks today correctly', () => {
      const stats = computeAllStats(makeStorage());
      const todayDays = stats.weeklyTrend.days.filter((d) => d.isToday);
      expect(todayDays).toHaveLength(1);
    });
  });

  describe('netLimitDrift', () => {
    it('calculates positive drift (increased limits)', () => {
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'youtube.com',
              dailyLimitMinutes: 20,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
          ],
        }),
      );
      expect(stats.netLimitDrift).toBe(10);
    });

    it('calculates negative drift (decreased limits)', () => {
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'youtube.com',
              dailyLimitMinutes: 5,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
          ],
        }),
      );
      expect(stats.netLimitDrift).toBe(-5);
    });

    it('sums drift across all sites', () => {
      const stats = computeAllStats(
        makeStorage({
          sites: [
            {
              id: '1',
              domain: 'youtube.com',
              dailyLimitMinutes: 20,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
            {
              id: '2',
              domain: 'reddit.com',
              dailyLimitMinutes: 5,
              initialLimitMinutes: 10,
              isPreset: true,
              addedAt: '',
            },
          ],
        }),
      );
      // +10 + (-5) = +5
      expect(stats.netLimitDrift).toBe(5);
    });
  });
});
