import { useState, useEffect } from 'react';
import type { SiteConfig } from '@/shared/types';
import { t } from '@/shared/i18n';
import { SiteFavicon } from '../SiteFavicon';

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
