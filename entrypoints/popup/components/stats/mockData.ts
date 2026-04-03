import type { AllStats, SiteUsageBar } from '@/shared/statsComputation';
import { getTodayKey, getWeekDateKeys } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { DAY_LABEL_KEYS } from '@/shared/constants';

export const USE_MOCK_DATA = false;

export function getMockStats(): AllStats {
  const now = new Date();
  const weekKeys = getWeekDateKeys(now);
  const todayKey = getTodayKey();
  const todayIndex = weekKeys.indexOf(todayKey);

  const weekMinutes = [128, 97, 145, 82, 110, 63, 0];

  const todayBars: SiteUsageBar[] = [
    {
      domain: 'reddit.com',
      usedSeconds: 1980,
      limitMinutes: 30,
      ratio: 1.1,
      colorTier: 'red',
    },
    {
      domain: 'youtube.com',
      usedSeconds: 2280,
      limitMinutes: 45,
      ratio: 0.84,
      colorTier: 'amber',
    },
    {
      domain: 'twitter.com',
      usedSeconds: 720,
      limitMinutes: 20,
      ratio: 0.6,
      colorTier: 'green',
    },
    {
      domain: 'instagram.com',
      usedSeconds: 420,
      limitMinutes: 15,
      ratio: 0.47,
      colorTier: 'green',
    },
    {
      domain: 'tiktok.com',
      usedSeconds: 180,
      limitMinutes: 10,
      ratio: 0.3,
      colorTier: 'green',
    },
  ];

  return {
    northStar: {
      avgDailyMinutes: 94,
      prevAvgDailyMinutes: 115,
      percentChange: -18,
      changeDirection: 'down',
    },
    hero: {
      reclaimedMinutes: 136,
      totalBlockedAttempts: 12,
    },
    todayBars,
    totalTodayMinutes: todayBars.reduce(
      (s, b) => s + Math.round(b.usedSeconds / 60),
      0,
    ),
    weeklyTrend: {
      days: weekKeys.map((dateKey, i) => ({
        dateKey,
        dayLabel: t(DAY_LABEL_KEYS[i] ?? ''),
        totalMinutes: i <= todayIndex ? (weekMinutes[i] ?? 0) : 0,
        isToday: i === todayIndex,
        isFuture: i > todayIndex,
      })),
      percentChange: -18,
      changeDirection: 'down',
      dailyAverageMinutes: 104,
    },
    netLimitDrift: -25,
  };
}
