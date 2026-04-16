import { t } from '@/shared/i18n';
import { TrashIcon, LockIcon, ClockIcon } from './icons';

interface ActionMenuSheetProps {
  domain: string;
  baseLimitMinutes: number;
  onDelete: () => void;
  onRequestBlock: () => void;
  onRequestBaseLimit: () => void;
}

export function ActionMenuSheet({
  domain,
  baseLimitMinutes,
  onDelete,
  onRequestBlock,
  onRequestBaseLimit,
}: ActionMenuSheetProps) {
  return (
    <div>
      <p className="text-center text-text-secondary text-[0.875rem] mb-3">
        {domain}
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onRequestBaseLimit}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <ClockIcon size={18} className="text-text-secondary shrink-0" />
          <span className="text-[0.875rem] font-medium">
            {t('menuBaseLimitAction')}
          </span>
          <span className="ml-auto text-[0.8125rem] text-text-tertiary tabular-nums">
            {baseLimitMinutes} {t('baseLimitUnit')}
          </span>
        </button>
        <button
          type="button"
          onClick={onRequestBlock}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <LockIcon size={18} className="text-error shrink-0" />
          <span className="text-[0.875rem] font-medium">
            {t('menuBlockAction')}
          </span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <TrashIcon size={18} className="text-error shrink-0" />
          <span className="text-[0.875rem] font-medium">
            {t('menuDeleteAction')}
          </span>
        </button>
      </div>
    </div>
  );
}
