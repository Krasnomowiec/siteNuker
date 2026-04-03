import { MAX_SITES } from '@/shared/constants';
import { t } from '@/shared/i18n';

import { Toggle } from './Toggle';
import { IconButton } from './IconButton';
import { ChartIcon, NuclearIcon } from './icons';

export type Page = 'main' | 'nuclear' | 'statistics';

interface HeaderProps {
  siteCount: number;
  isEnabled: boolean;
  onToggle: () => void;
  onNavigate: (page: Page) => void;
  currentPage: Page;
}

export function Header({
  siteCount,
  isEnabled,
  onToggle,
  onNavigate,
  currentPage,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 pt-3.5 pb-3 bg-bg-primary shrink-0">
      <div className="flex items-center gap-3.5">
        <div className="w-7 h-7 sn-gradient-cta rounded-sm flex items-center justify-center">
          <svg
            width="21"
            height="21"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2.97785 13.0075C2.57374 12.1846 2.43618 11.2561 2.58431 10.3513C2.73243 9.44654 3.15888 8.61045 3.80429 7.95943L5.26985 6.48248C5.45563 6.29618 5.67633 6.14838 5.9193 6.04753C6.16228 5.94669 6.42276 5.89478 6.68582 5.89478C6.94888 5.89478 7.20936 5.94669 7.45234 6.04753C7.69531 6.14838 7.91601 6.29618 8.10179 6.48248L9.51776 7.89881C9.70401 8.08464 9.85177 8.30539 9.9526 8.54843C10.0534 8.79147 10.1053 9.05201 10.1053 9.31514C10.1053 9.57827 10.0534 9.83882 9.9526 10.0819C9.85177 10.3249 9.70401 10.5456 9.51776 10.7315L8.06873 12.1809C7.41445 12.836 6.57057 13.2684 5.65679 13.4167C4.743 13.5651 3.80571 13.422 2.97785 13.0075Z"
              stroke="#131317"
              strokeWidth="1.2"
              strokeMiterlimit="10"
            />
            <path
              d="M7.57918 12.6315L3.36865 8.42102"
              stroke="#131317"
              strokeWidth="1.2"
              strokeMiterlimit="10"
            />
            <path
              d="M5.05273 6.73682L9.26326 10.9473"
              stroke="#131317"
              strokeWidth="1.2"
              strokeMiterlimit="10"
            />
            <path
              d="M11.6344 7.579L9.34048 6.65942L8.4209 4.36552L10.2247 2.52637L10.3611 2.83963L11.1998 4.80005L13.4735 5.77521L11.6344 7.579Z"
              stroke="#131317"
              strokeWidth="1.2"
              strokeMiterlimit="10"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-headline font-bold tracking-tight text-xl text-accent-red leading-none">
            SitesNuker
          </h1>
          <span className="text-[10px] font-headline tracking-widest text-text-tertiary uppercase">
            {t('headerSiteCount', String(siteCount), String(MAX_SITES))}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton
          onClick={() => onNavigate('statistics')}
          active={currentPage === 'statistics'}
        >
          <ChartIcon size={18} />
        </IconButton>
        <IconButton
          onClick={() => onNavigate('nuclear')}
          active={currentPage === 'nuclear'}
        >
          <NuclearIcon size={18} />
        </IconButton>
        <Toggle isOn={isEnabled} onToggle={onToggle} />
      </div>
    </header>
  );
}
