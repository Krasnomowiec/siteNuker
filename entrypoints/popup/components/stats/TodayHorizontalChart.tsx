import type { SiteUsageBar } from '@/shared/statsComputation';
import { formatMinutesShort } from '@/shared/utils';
import { SiteFavicon } from '../SiteFavicon';

const ROW_H = 28;
const BAR_H = 14;
const LABEL_W = 80;
const VALUE_W = 48;

interface TodayHorizontalChartProps {
  bars: SiteUsageBar[];
}

export function TodayHorizontalChart({ bars }: TodayHorizontalChartProps) {
  const maxSeconds = Math.max(1, ...bars.map((b) => b.usedSeconds));

  return (
    <div className="bg-bg-secondary rounded-sm px-3.5 py-3">
      <div className="flex flex-col gap-1">
        {bars.map((bar) => {
          const barPercent = Math.round((bar.usedSeconds / maxSeconds) * 100);
          const usedMin = Math.round(bar.usedSeconds / 60);
          return (
            <div
              key={bar.domain}
              className="flex items-center"
              style={{ height: `${ROW_H}px` }}
            >
              {/* Domain label */}
              <div
                className="flex items-center gap-1.5 shrink-0"
                style={{ width: `${LABEL_W}px` }}
              >
                <SiteFavicon domain={bar.domain} size="sm" />
                <span className="text-xs text-text-tertiary truncate">
                  {bar.domain.replace(/\.\w+$/, '')}
                </span>
              </div>

              {/* Bar track */}
              <div className="flex-1 mx-2">
                <div
                  className="rounded-sm bg-bg-tertiary overflow-hidden"
                  style={{ height: `${BAR_H}px` }}
                >
                  {barPercent > 0 && (
                    <div
                      className="h-full rounded-sm animate-bar-grow bg-accent-red/50"
                      style={{ width: `${barPercent}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Value */}
              <span
                className="text-xs font-headline font-semibold tabular-nums text-right shrink-0 text-text-tertiary"
                style={{ width: `${VALUE_W}px` }}
              >
                {formatMinutesShort(usedMin)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
