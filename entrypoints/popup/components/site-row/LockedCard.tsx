import { useState, useEffect } from 'react';
import type { SiteConfig } from '@/shared/types';
import { getSecondsUntilMidnight, formatCountdown } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { SiteFavicon } from '../SiteFavicon';

interface LockedCardProps {
  site: SiteConfig;
}

export function LockedCard({ site }: LockedCardProps) {
  const [remaining, setRemaining] = useState(getSecondsUntilMidnight);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(getSecondsUntilMidnight());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="opacity-60">
      <div className="bg-bg-secondary p-4 rounded-sm">
        <div className="flex items-center gap-3">
          <SiteFavicon domain={site.domain} />
          <span className="font-headline font-bold text-[0.875rem] text-text-primary/80 truncate flex-1 min-w-0">
            {site.domain}
          </span>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-accent-red bg-accent-red/15">
              {t('siteRowSoftBlocked')}
            </span>
            <span className="text-[10px] text-text-tertiary tabular-nums pr-0.5">
              {t('siteRowUnlocksIn', formatCountdown(remaining))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
