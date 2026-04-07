import type { SiteConfig } from '@/shared/types';
import { formatTimeCompact } from '@/shared/utils';
import { t } from '@/shared/i18n';

import { SiteFavicon } from '../SiteFavicon';
import { ChevronIcon } from '../icons';

interface CollapsedCardProps {
  site: SiteConfig;
  usedSeconds: number;
  onExpand: () => void;
  isSoftLocked?: boolean;
}

export function CollapsedCard({
  site,
  usedSeconds,
  onExpand,
  isSoftLocked = false,
}: CollapsedCardProps) {
  const remaining = site.dailyLimitMinutes * 60 - usedSeconds;
  const isExceeded = remaining <= 0;

  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full bg-bg-secondary p-4 rounded-sm flex items-center gap-3 group hover:bg-bg-tertiary active:scale-[0.98] transition-colors cursor-pointer"
    >
      <SiteFavicon domain={site.domain} />
      <span className="font-headline font-bold text-[0.875rem] text-text-primary/80 group-hover:text-text-primary truncate flex-1 min-w-0 text-left">
        {site.domain}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {isSoftLocked ? (
          <span className="text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-accent-amber bg-accent-amber/15 group-hover:bg-accent-amber/25">
            {t('siteRowTimeUsedUp')}
          </span>
        ) : (
          <span
            className={`text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-center min-w-[3.75rem] tabular-nums ${isExceeded ? 'text-accent-red bg-accent-red/15 group-hover:bg-accent-red/25' : 'text-accent-red-soft bg-accent-red-soft/15 group-hover:bg-accent-red-soft/25'}`}
          >
            {formatTimeCompact(Math.max(0, remaining))}
          </span>
        )}
        <ChevronIcon
          size={22}
          className="text-text-tertiary group-hover:text-accent-red-soft transition-colors shrink-0"
        />
      </div>
    </button>
  );
}
