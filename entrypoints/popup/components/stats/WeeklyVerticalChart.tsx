import type { WeeklyTrend } from '@/shared/statsComputation';
import { formatMinutesShort } from '@/shared/utils';
import { t } from '@/shared/i18n';

const CHART_WIDTH = 316;
const CHART_HEIGHT = 110;
const PAD_X = 16;
const PAD_TOP = 18;
const PAD_BOTTOM = 4;
const PLOT_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
const BAR_WIDTH = 24;

interface WeeklyVerticalChartProps {
  trend: WeeklyTrend;
}

export function WeeklyVerticalChart({ trend }: WeeklyVerticalChartProps) {
  const hasAnyData = trend.days.some((d) => !d.isFuture && d.totalMinutes > 0);
  const maxMinutes = Math.max(1, ...trend.days.map((d) => d.totalMinutes));
  const ceilStep = maxMinutes <= 120 ? 30 : 60;
  const ceilMax = Math.ceil(maxMinutes / ceilStep) * ceilStep;

  function getX(index: number): number {
    return PAD_X + index * ((CHART_WIDTH - PAD_X * 2) / 6);
  }

  function getBarHeight(minutes: number): number {
    return ceilMax > 0 ? (minutes / ceilMax) * PLOT_HEIGHT : 0;
  }

  if (!hasAnyData) {
    return (
      <div
        className="bg-bg-secondary rounded-sm p-3.5 flex items-center justify-center"
        style={{ minHeight: CHART_HEIGHT }}
      >
        <p className="text-xs text-text-tertiary">{t('statsEmpty')}</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-secondary rounded-sm p-3.5">
      <svg
        width={CHART_WIDTH}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
      >
        {trend.days.map((day, i) => {
          const x = getX(i);
          const barH = getBarHeight(day.totalMinutes);
          const barY = PAD_TOP + PLOT_HEIGHT - barH;
          const barX = x - BAR_WIDTH / 2;

          if (day.isFuture) {
            return (
              <rect
                key={day.dateKey}
                x={barX}
                y={PAD_TOP + PLOT_HEIGHT - 2}
                width={BAR_WIDTH}
                height={2}
                rx={1}
                fill="#2a2a2e"
              />
            );
          }

          const showLabel = day.totalMinutes > 0;

          return (
            <g key={day.dateKey}>
              <rect
                x={barX}
                y={barH > 0 ? barY : PAD_TOP + PLOT_HEIGHT - 2}
                width={BAR_WIDTH}
                height={barH > 0 ? barH : 2}
                rx={1}
                fill="rgba(254,85,74,0.5)"
              />
              {showLabel && (
                <text
                  x={x}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-family-headline)"
                  fontWeight="600"
                  fill="#aa8985"
                >
                  {formatMinutesShort(day.totalMinutes)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Day labels */}
      <div className="flex justify-between px-1 mt-1">
        {trend.days.map((day) => (
          <span
            key={day.dateKey}
            className="text-xs text-text-tertiary"
            style={{ width: `${BAR_WIDTH}px`, textAlign: 'center' }}
          >
            {day.dayLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
