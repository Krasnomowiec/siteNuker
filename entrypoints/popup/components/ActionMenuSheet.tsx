import { useState } from 'react';
import { t } from '@/shared/i18n';
import { TrashIcon, LockIcon } from './icons';
import { ConfirmationSheet } from './ConfirmationSheet';

interface ActionMenuSheetProps {
  domain: string;
  onDelete: () => void;
  onBlockConfirm: () => void;
}

export function ActionMenuSheet({
  domain,
  onDelete,
  onBlockConfirm,
}: ActionMenuSheetProps) {
  const [step, setStep] = useState<'menu' | 'blockConfirm'>('menu');

  if (step === 'blockConfirm') {
    return (
      <ConfirmationSheet
        title={t('blockNowConfirmTitle', domain)}
        description={t('blockNowConfirmDescription')}
        confirmLabel={t('blockNowConfirmBlock')}
        cancelLabel={t('blockNowConfirmCancel')}
        onConfirm={onBlockConfirm}
        onCancel={() => setStep('menu')}
      />
    );
  }

  return (
    <div>
      <p className="text-center text-text-secondary text-[0.875rem] mb-3">
        {domain}
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setStep('blockConfirm')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <LockIcon size={18} className="text-error shrink-0" />
          <span className="text-[0.875rem] font-medium">{t('menuBlockAction')}</span>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-left bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
        >
          <TrashIcon size={18} className="text-error shrink-0" />
          <span className="text-[0.875rem] font-medium">{t('menuDeleteAction')}</span>
        </button>
      </div>
    </div>
  );
}
