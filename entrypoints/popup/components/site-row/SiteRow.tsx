import { memo } from 'react';
import type { SiteConfig } from '@/shared/types';
import { HARD_CAP_SECONDS } from '@/shared/constants';

import { CollapsedCard } from './CollapsedCard';
import { ExpandedCard } from './ExpandedCard';
import { LockedCard } from './LockedCard';

interface SiteRowProps {
  site: SiteConfig;
  usedSeconds: number;
  isManuallyBlocked: boolean;
  isExpanded: boolean;
  onToggleExpand: (siteId: string) => void;
  onExtend: (siteId: string) => void;
  onReduce: (siteId: string) => void;
  onMenu: (siteId: string) => void;
}

export const SiteRow = memo(function SiteRow({
  site,
  usedSeconds,
  isManuallyBlocked,
  isExpanded,
  onToggleExpand,
  onExtend,
  onReduce,
  onMenu,
}: SiteRowProps) {
  const isHardLocked = usedSeconds >= HARD_CAP_SECONDS || isManuallyBlocked;
  const isSoftLocked =
    !isHardLocked && usedSeconds >= site.dailyLimitMinutes * 60;

  if (isHardLocked) {
    return <LockedCard site={site} />;
  }

  if (isExpanded) {
    return (
      <ExpandedCard
        site={site}
        usedSeconds={usedSeconds}
        onCollapse={() => onToggleExpand(site.id)}
        onExtend={() => onExtend(site.id)}
        onReduce={() => onReduce(site.id)}
        onMenu={() => onMenu(site.id)}
        isSoftLocked={isSoftLocked}
      />
    );
  }

  return (
    <CollapsedCard
      site={site}
      usedSeconds={usedSeconds}
      onExpand={() => onToggleExpand(site.id)}
      isSoftLocked={isSoftLocked}
    />
  );
});
