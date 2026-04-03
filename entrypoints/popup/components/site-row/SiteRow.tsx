import type { SiteConfig } from '@/shared/types';
import { LIMIT_MAX } from '@/shared/constants';
import { CollapsedCard } from './CollapsedCard';
import { ExpandedCard } from './ExpandedCard';
import { LockedCard } from './LockedCard';

interface SiteRowProps {
  site: SiteConfig;
  usedSeconds: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSave: (siteId: string, newLimit: number) => void;
  onDelete: (siteId: string) => void;
}

export function SiteRow({
  site,
  usedSeconds,
  isExpanded,
  onToggleExpand,
  onSave,
  onDelete,
}: SiteRowProps) {
  const isLocked = usedSeconds >= LIMIT_MAX * 60;

  if (isLocked) {
    return <LockedCard site={site} />;
  }

  if (isExpanded) {
    return (
      <ExpandedCard
        site={site}
        usedSeconds={usedSeconds}
        onCollapse={onToggleExpand}
        onSave={(newLimit) => onSave(site.id, newLimit)}
        onDelete={() => onDelete(site.id)}
      />
    );
  }

  return (
    <CollapsedCard
      site={site}
      usedSeconds={usedSeconds}
      onExpand={onToggleExpand}
    />
  );
}
