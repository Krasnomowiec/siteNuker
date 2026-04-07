import { t } from '@/shared/i18n';

import { Toggle } from './Toggle';
import { IconButton } from './IconButton';
import { ChartIcon, NuclearIcon } from './icons';

export type Page = 'main' | 'nuclear' | 'statistics';

interface HeaderProps {
  isEnabled: boolean;
  onToggle: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

export function Header({
  isEnabled,
  onToggle,
  onNavigate,
  currentPage,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 pt-3.5 pb-3 bg-bg-primary shrink-0">
      <h1 className="font-headline font-bold tracking-tight text-xl text-accent-red leading-none">
        SitesNuker
      </h1>

      <div className="flex items-center gap-1.5">
        <IconButton
          onClick={() => onNavigate('statistics')}
          active={currentPage === 'statistics'}
          aria-label={t('statsTitle')}
        >
          <ChartIcon size={18} />
        </IconButton>
        <IconButton
          onClick={() => onNavigate('nuclear')}
          active={currentPage === 'nuclear'}
          aria-label={t('nuclearTitle')}
        >
          <NuclearIcon size={18} />
        </IconButton>
        <Toggle isOn={isEnabled} onToggle={onToggle} />
      </div>
    </header>
  );
}
