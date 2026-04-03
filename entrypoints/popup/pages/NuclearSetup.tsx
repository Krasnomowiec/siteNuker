import { useState } from 'react';
import { NUCLEAR_TIME_OPTIONS } from '@/shared/constants';
import { t } from '@/shared/i18n';
import { PageHeader } from '../components/PageHeader';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmationSheet } from '../components/ConfirmationSheet';

interface NuclearSetupProps {
  onBack: () => void;
  onActivate: (durationMinutes: number) => void;
}

const TIME_LABEL_KEYS: Record<number, string> = {
  5: 'nuclearTimeLabel5',
  15: 'nuclearTimeLabel15',
  30: 'nuclearTimeLabel30',
  60: 'nuclearTimeLabel60',
  120: 'nuclearTimeLabel120',
  180: 'nuclearTimeLabel180',
  240: 'nuclearTimeLabel240',
  300: 'nuclearTimeLabel300',
};

export function NuclearSetup({ onBack, onActivate }: NuclearSetupProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <PageHeader title={t('nuclearTitle')} onBack={onBack} />

      {/* Description */}
      <div className="px-4 pt-2 pb-6 shrink-0">
        <p className="text-body text-text-tertiary leading-relaxed">
          {t('nuclearDescription')}
        </p>
      </div>

      {/* Time grid — 2 columns */}
      <div className="px-4 grid grid-cols-2 gap-2.5 shrink-0">
        {NUCLEAR_TIME_OPTIONS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setSelected(minutes)}
            className={`
              rounded-sm px-3.5 py-3 text-left transition-all
              ${
                selected === minutes
                  ? 'bg-bg-tertiary ring-1 ring-accent-red-soft'
                  : 'bg-bg-secondary hover:bg-bg-tertiary'
              }
            `}
          >
            <span
              className={`
              block text-[10px] font-headline font-bold uppercase tracking-widest mb-0.5
              ${selected === minutes ? 'text-accent-red-soft' : 'text-text-tertiary'}
            `}
            >
              {t(TIME_LABEL_KEYS[minutes] ?? '')}
            </span>
            <span
              className={`
              block font-headline font-bold text-header
              ${selected === minutes ? 'text-text-primary' : 'text-text-secondary'}
            `}
            >
              {minutes} {t('unitMin')}
            </span>
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-4" />

      {/* CTA */}
      <div className="px-4 pb-4 shrink-0">
        <button
          type="button"
          disabled={selected === null}
          onClick={() => setShowConfirm(true)}
          className={`
            w-full py-3 rounded-sm font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center transition-all
            ${
              selected !== null
                ? 'sn-gradient-cta text-on-primary active:scale-[0.98]'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
            }
          `}
        >
          {t('nuclearActivate')}
        </button>
      </div>

      {/* Confirmation bottom sheet */}
      <BottomSheet isOpen={showConfirm} onClose={() => setShowConfirm(false)}>
        <ConfirmationSheet
          title={t('nuclearConfirmTitle', String(selected ?? 0))}
          description={t('nuclearConfirmDescription')}
          confirmLabel={t('nuclearConfirmLaunch')}
          cancelLabel={t('nuclearConfirmCancel')}
          variant="cta"
          onConfirm={() => {
            setShowConfirm(false);
            if (selected !== null) onActivate(selected);
          }}
          onCancel={() => setShowConfirm(false)}
        />
      </BottomSheet>
    </div>
  );
}
