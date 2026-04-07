import { useRef, useEffect } from 'react';
import type { SiteConfig } from '@/shared/types';
import { HARD_CAP_SECONDS, LIMIT_MAX, LIMIT_MIN } from '@/shared/constants';
import { formatTimeCompact } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { SiteFavicon } from '../SiteFavicon';
import { ChevronIcon, MoreIcon } from '../icons';

interface ExpandedCardProps {
  site: SiteConfig;
  usedSeconds: number;
  onCollapse: () => void;
  onExtend: () => void;
  onReduce: () => void;
  onMenu: () => void;
  isSoftLocked?: boolean;
}

export function ExpandedCard({
  site,
  usedSeconds,
  onCollapse,
  onExtend,
  onReduce,
  onMenu,
  isSoftLocked = false,
}: ExpandedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const limitSeconds = site.dailyLimitMinutes * 60;
  const isHardCapped = site.dailyLimitMinutes >= LIMIT_MAX;
  const isAtMin = site.dailyLimitMinutes <= LIMIT_MIN;

  useEffect(() => {
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const remaining = limitSeconds - usedSeconds;
  const isExceeded = remaining <= 0;

  // Progress bar segments (as percentage of HARD_CAP)
  const usedPct = Math.min((usedSeconds / HARD_CAP_SECONDS) * 100, 100);
  const remainingPct = isExceeded
    ? 0
    : ((limitSeconds - usedSeconds) / HARD_CAP_SECONDS) * 100;

  return (
    <div
      ref={cardRef}
      className="bg-bg-tertiary rounded-sm overflow-hidden transition-all duration-200 scroll-mb-5"
    >
      {/* Top row — same as collapsed */}
      <button
        type="button"
        onClick={onCollapse}
        className="w-full p-4 flex items-center gap-3 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
      >
        <SiteFavicon domain={site.domain} />
        <span className="font-headline font-bold text-[0.875rem] text-text-primary truncate flex-1 min-w-0 text-left">
          {site.domain}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isSoftLocked ? (
            <span className="text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-accent-amber bg-accent-amber/15">
              {t('siteRowTimeUsedUp')}
            </span>
          ) : (
            <span
              className={`text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-center min-w-[3.75rem] tabular-nums ${isExceeded ? 'text-accent-red bg-accent-red/15' : 'text-accent-red-soft bg-accent-red-soft/15'}`}
            >
              {formatTimeCompact(Math.max(0, remaining))}
            </span>
          )}
          <ChevronIcon
            size={22}
            className="text-accent-red rotate-180 shrink-0"
          />
        </div>
      </button>

      {/* Bottom — progress bar + actions */}
      <div className="px-4 pb-4 space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="relative w-full h-1.5 rounded-full bg-bg-secondary overflow-hidden">
            {/* Remaining (behind used — extends from 0 to limit) */}
            <div
              className="absolute inset-y-0 left-0 bg-accent-red-soft/40"
              style={{ width: `${usedPct + remainingPct}%` }}
            />
            {/* Used (on top — extends from 0 to used) */}
            <div
              className="absolute inset-y-0 left-0 bg-accent-red"
              style={{ width: `${usedPct}%` }}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-accent-red inline-block" />
              {t('progressUsed')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-accent-red-soft/40 inline-block" />
              {t('progressRemaining')}
            </span>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="w-10 h-10 flex items-center justify-center bg-error-bg/20 text-error rounded-sm hover:bg-error-bg/40 transition-colors"
          >
            <MoreIcon size={18} />
          </button>

          <button
            type="button"
            onClick={onReduce}
            disabled={isAtMin}
            className={`flex-1 h-10 rounded-sm font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center transition-all ${
              isAtMin
                ? 'bg-white/[0.06] text-text-tertiary cursor-not-allowed'
                : 'bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98]'
            }`}
          >
            {t('reduceFiveMin')}
          </button>

          <button
            type="button"
            onClick={onExtend}
            disabled={isHardCapped}
            className={`flex-1 h-10 rounded-sm font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center transition-all ${
              isHardCapped
                ? 'bg-white/[0.06] text-text-tertiary cursor-not-allowed'
                : 'bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98]'
            }`}
          >
            {isHardCapped ? t('extendMaxReached') : t('extendFiveMin')}
          </button>
        </div>
      </div>
    </div>
  );
}
