import { useMemo } from 'react';
import type { StorageSchema } from '@/shared/types';
import { t } from '@/shared/i18n';
import { computeAllStats } from '@/shared/statsComputation';
import { PageHeader } from '../components/PageHeader';
import { NorthStarCard } from '../components/stats/NorthStarCard';
import { TodayHorizontalChart } from '../components/stats/TodayHorizontalChart';
import { WeeklyVerticalChart } from '../components/stats/WeeklyVerticalChart';

interface StatisticsProps {
  storage: StorageSchema;
  onBack: () => void;
}

export function Statistics({ storage, onBack }: StatisticsProps) {
  const stats = useMemo(
    () => computeAllStats(storage),
    [storage],
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <PageHeader title={t('statsTitle')} onBack={onBack} />

      <div className="flex flex-col gap-4 px-4 pt-3 pb-4 shrink-0">
        {/* North Star */}
        <div>
          <div className="pb-1.5 flex items-center">
            <span className="font-headline font-semibold text-xs uppercase tracking-widest text-text-secondary">
              {t('statsTimeOnBlocked')}
            </span>
          </div>
          <NorthStarCard stats={stats.northStar} />
        </div>

        {/* Today's usage */}
        <div>
          <div className="pb-1.5 flex items-center">
            <span className="font-headline font-semibold text-xs uppercase tracking-widest text-text-secondary">
              {t('statsToday')}
            </span>
          </div>
          {stats.todayBars.length > 0 ? (
            <TodayHorizontalChart bars={stats.todayBars} />
          ) : (
            <div className="bg-bg-secondary rounded-sm px-3.5 py-5 flex items-center justify-center">
              <p className="text-xs text-text-tertiary">{t('statsEmpty')}</p>
            </div>
          )}
        </div>

        {/* Weekly trend */}
        <div>
          <div className="pb-1.5 flex items-center">
            <span className="font-headline font-semibold text-xs uppercase tracking-widest text-text-secondary">
              {t('statsWeeklyTrend')}
            </span>
          </div>
          <WeeklyVerticalChart trend={stats.weeklyTrend} />
        </div>
      </div>
    </div>
  );
}
