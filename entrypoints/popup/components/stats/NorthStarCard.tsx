import type { NorthStarStats } from '@/shared/statsComputation';
import { formatMinutesShort } from '@/shared/utils';
import { t } from '@/shared/i18n';

interface NorthStarCardProps {
  stats: NorthStarStats;
}

export function NorthStarCard({ stats }: NorthStarCardProps) {
  const isDown = stats.changeDirection === 'down';
  const isUp = stats.changeDirection === 'up';

  const arrow = isDown ? '↑' : isUp ? '↓' : null;

  const pillBg = isDown
    ? 'bg-accent-green/15 text-accent-green'
    : isUp
      ? 'bg-accent-red/15 text-accent-red-soft'
      : 'bg-bg-tertiary text-text-tertiary';

  const isEmpty = stats.avgDailyMinutes === 0 && stats.percentChange === null;

  if (isEmpty) {
    return (
      <div className="bg-bg-secondary rounded-sm px-3.5 py-5 flex items-center justify-center">
        <p className="text-xs text-text-tertiary">{t('statsEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-sm px-3.5 py-3">
      <div className="flex items-baseline gap-1">
        <span className="font-headline font-bold text-[24px] leading-none tracking-tight text-text-primary">
          {formatMinutesShort(stats.avgDailyMinutes)}
        </span>
        <span className="text-xs font-medium text-text-tertiary">{t('statsPerDay')}</span>
      </div>
      {stats.percentChange !== null && (
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 leading-[18px] rounded-sm text-xs font-semibold ${pillBg}`}
          >
            {arrow && <span>{arrow}</span>}
            {Math.abs(stats.percentChange)}%
          </span>
          <span className="text-xs font-medium text-text-tertiary">
            {t('statsVsAverage')}
          </span>
        </div>
      )}
    </div>
  );
}
