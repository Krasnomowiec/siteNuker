import type { SiteConfig } from '@/shared/types';
import { formatTimeCompact } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { SiteFavicon } from '../SiteFavicon';

interface LockedCardProps {
  site: SiteConfig;
}

export function LockedCard({ site }: LockedCardProps) {
  return (
    <div className="opacity-60">
      <div className="bg-bg-secondary p-4 rounded-sm">
        <div className="flex items-center gap-3">
          <SiteFavicon domain={site.domain} />
          <span className="font-headline font-semibold text-text-primary/80 truncate flex-1">
            {site.domain}
          </span>
          <span className="text-xs text-accent-red font-medium">
            {formatTimeCompact(0)}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-tight text-accent-amber">
          {t('siteRowLimitExhausted')}
        </p>
      </div>
    </div>
  );
}
