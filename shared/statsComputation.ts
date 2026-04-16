import type { StorageSchema, DailyUsage, SiteConfig } from './types';
import {
  USAGE_TIER_AMBER,
  USAGE_TIER_RED_SOFT,
  DAY_LABEL_KEYS,
} from './constants';
import { t } from './i18n';
import { getTodayKey, getDateKey, getWeekDateKeys } from './utils';

/* ── Types ── */

export type ColorTier = 'green' | 'amber' | 'red-soft' | 'red';

export interface SiteUsageBar {
  domain: string;
  usedSeconds: number;
  limitMinutes: number;
  ratio: number;
  colorTier: ColorTier;
}

export interface DayPoint {
  dateKey: string;
  dayLabel: string;
  totalMinutes: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeeklyTrend {
  days: DayPoint[];
  percentChange: number | null;
  changeDirection: 'down' | 'up' | 'none' | null;
  dailyAverageMinutes: number;
}

export interface NorthStarStats {
  avgDailyMinutes: number;
  prevAvgDailyMinutes: number;
  percentChange: number | null;
  changeDirection: 'down' | 'up' | 'none' | null;
}

export interface AllStats {
  northStar: NorthStarStats;
  todayBars: SiteUsageBar[];
  totalTodayMinutes: number;
  weeklyTrend: WeeklyTrend;
  netLimitDrift: number;
}

/* ── Helpers ── */

function getColorTier(ratio: number): ColorTier {
  if (ratio >= 1.0) return 'red';
  if (ratio >= USAGE_TIER_RED_SOFT) return 'red-soft';
  if (ratio >= USAGE_TIER_AMBER) return 'amber';
  return 'green';
}

function getUsageForDate(
  dateKey: string,
  usage: Record<string, DailyUsage>,
  history: Record<string, DailyUsage>,
): DailyUsage {
  return usage[dateKey] ?? history[dateKey] ?? {};
}

function sumDaySeconds(dayUsage: DailyUsage): number {
  let total = 0;
  for (const domain of Object.keys(dayUsage)) {
    const entry = dayUsage[domain];
    if (entry) total += entry.usedSeconds;
  }
  return total;
}

function sumDayMinutes(dayUsage: DailyUsage): number {
  return Math.round(sumDaySeconds(dayUsage) / 60);
}

/* ── North Star: 7-day rolling avg daily minutes ── */

function computeNorthStar(
  usage: Record<string, DailyUsage>,
  history: Record<string, DailyUsage>,
): NorthStarStats {
  const now = new Date();

  function avgForPeriod(startDaysAgo: number, endDaysAgo: number): number {
    let total = 0;
    let daysWithData = 0;
    for (let i = startDaysAgo; i <= endDaysAgo; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayUsage = getUsageForDate(getDateKey(d), usage, history);
      const mins = sumDayMinutes(dayUsage);
      if (mins > 0) {
        total += mins;
        daysWithData++;
      }
    }
    return daysWithData > 0 ? Math.round(total / daysWithData) : 0;
  }

  // Last 7 days (today inclusive through 6 days ago)
  const avgDailyMinutes = avgForPeriod(0, 6);
  // Previous 7 days (7-13 days ago)
  const prevAvgDailyMinutes = avgForPeriod(7, 13);

  let percentChange: number | null = null;
  let changeDirection: 'down' | 'up' | 'none' | null = null;

  if (prevAvgDailyMinutes >= 5) {
    percentChange = Math.round(
      ((avgDailyMinutes - prevAvgDailyMinutes) / prevAvgDailyMinutes) * 100,
    );
    if (percentChange < 0) changeDirection = 'down';
    else if (percentChange > 0) changeDirection = 'up';
    else changeDirection = 'none';
  }

  return {
    avgDailyMinutes,
    prevAvgDailyMinutes,
    percentChange,
    changeDirection,
  };
}

/* ── Today's Usage Bars ── */

function computeTodayBars(
  usage: Record<string, DailyUsage>,
  sites: SiteConfig[],
): SiteUsageBar[] {
  const todayKey = getTodayKey();
  const todayUsage = usage[todayKey] ?? {};

  const siteLimits = new Map<string, number>();
  for (const site of sites) {
    siteLimits.set(site.domain, site.dailyLimitMinutes);
  }

  const bars: SiteUsageBar[] = [];

  for (const domain of Object.keys(todayUsage)) {
    const entry = todayUsage[domain];
    if (!entry || entry.usedSeconds <= 0) continue;

    const limitMinutes = siteLimits.get(domain) ?? 0;
    const limitSeconds = limitMinutes * 60;
    const ratio = limitSeconds > 0 ? entry.usedSeconds / limitSeconds : 1;

    bars.push({
      domain,
      usedSeconds: entry.usedSeconds,
      limitMinutes,
      ratio,
      colorTier: getColorTier(ratio),
    });
  }

  // Sort by ratio descending (most urgent first)
  bars.sort((a, b) => b.ratio - a.ratio);

  return bars;
}

/* ── Weekly Trend ── */

function computeWeeklyTrend(
  usage: Record<string, DailyUsage>,
  history: Record<string, DailyUsage>,
): WeeklyTrend {
  const now = new Date();
  const todayKey = getTodayKey();
  const currentWeekKeys = getWeekDateKeys(now);

  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeekKeys = getWeekDateKeys(lastWeekDate);

  const todayIndex = currentWeekKeys.indexOf(todayKey);

  const days: DayPoint[] = currentWeekKeys.map((dateKey, i) => ({
    dateKey,
    dayLabel: t(DAY_LABEL_KEYS[i]!),
    totalMinutes: sumDayMinutes(getUsageForDate(dateKey, usage, history)),
    isToday: dateKey === todayKey,
    isFuture: i > todayIndex && todayIndex >= 0,
  }));

  let percentChange: number | null = null;
  let changeDirection: 'down' | 'up' | 'none' | null = null;

  if (todayIndex >= 0) {
    let currentTotal = 0;
    let lastTotal = 0;

    for (let i = 0; i <= todayIndex; i++) {
      const currentKey = currentWeekKeys[i];
      const lastKey = lastWeekKeys[i];
      if (currentKey) {
        currentTotal += sumDayMinutes(
          getUsageForDate(currentKey, usage, history),
        );
      }
      if (lastKey) {
        lastTotal += sumDayMinutes(getUsageForDate(lastKey, usage, history));
      }
    }

    if (lastTotal >= 5) {
      percentChange = Math.round(
        ((currentTotal - lastTotal) / lastTotal) * 100,
      );
      if (percentChange < 0) changeDirection = 'down';
      else if (percentChange > 0) changeDirection = 'up';
      else changeDirection = 'none';
    }
  }

  let daysWithData = 0;
  let totalMinutes = 0;
  for (let i = 0; i <= Math.max(0, todayIndex); i++) {
    const day = days[i];
    if (day && day.totalMinutes > 0) {
      daysWithData++;
      totalMinutes += day.totalMinutes;
    }
  }
  const dailyAverageMinutes =
    daysWithData > 0 ? Math.round(totalMinutes / daysWithData) : 0;

  return { days, percentChange, changeDirection, dailyAverageMinutes };
}

/* ── Net Limit Drift (across all sites) ── */

function computeNetLimitDrift(sites: SiteConfig[]): number {
  let drift = 0;
  for (const site of sites) {
    drift += site.dailyLimitMinutes - site.baseLimitMinutes;
  }
  return drift;
}

/* ── Aggregate ── */

export function computeAllStats(storage: StorageSchema): AllStats {
  const todayBars = computeTodayBars(storage.usage, storage.sites);
  const totalTodayMinutes = todayBars.reduce(
    (sum, bar) => sum + Math.round(bar.usedSeconds / 60),
    0,
  );
  return {
    northStar: computeNorthStar(storage.usage, storage.history),
    todayBars,
    totalTodayMinutes,
    weeklyTrend: computeWeeklyTrend(storage.usage, storage.history),
    netLimitDrift: computeNetLimitDrift(storage.sites),
  };
}
