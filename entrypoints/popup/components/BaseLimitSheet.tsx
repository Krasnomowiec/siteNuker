import { useState, useEffect, useRef } from 'react';
import { t } from '@/shared/i18n';
import { LIMIT_MIN, LIMIT_MAX, LIMIT_STEP } from '@/shared/constants';
import { CountdownRing } from './CountdownRing';

interface BaseLimitSheetProps {
  baseLimitMinutes: number;
  onSave: (newLimit: number) => void;
  onCancel: () => void;
}

const COUNTDOWN_SECONDS = 20;
const TICK_MS = 50;

function buildPresets(): number[] {
  const presets: number[] = [];
  for (let v = LIMIT_MIN + LIMIT_STEP; v <= LIMIT_MAX; v += LIMIT_STEP) {
    presets.push(v);
  }
  return presets;
}

const PRESETS = buildPresets();

export function BaseLimitSheet({
  baseLimitMinutes,
  onSave,
  onCancel,
}: BaseLimitSheetProps) {
  const [selectedLimit, setSelectedLimit] = useState<number | null>(null);
  const [msLeft, setMsLeft] = useState(COUNTDOWN_SECONDS * 1000);
  const prevTime = useRef(0);

  const isConfirming = selectedLimit !== null;

  useEffect(() => {
    if (!isConfirming) return;
    prevTime.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - prevTime.current;
      prevTime.current = now;
      setMsLeft((prev) => Math.max(0, prev - elapsed));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isConfirming]);

  const secondsLeft = Math.ceil(msLeft / 1000);
  const isReady = msLeft <= 0;

  function handlePresetClick(value: number) {
    if (value === baseLimitMinutes) return;
    if (value < baseLimitMinutes) {
      onSave(value);
      return;
    }
    setMsLeft(COUNTDOWN_SECONDS * 1000);
    setSelectedLimit(value);
  }

  if (isConfirming) {
    return (
      <div className="space-y-5">
        <CountdownRing
          msLeft={msLeft}
          durationMs={COUNTDOWN_SECONDS * 1000}
          secondsLeft={secondsLeft}
        />

        <div className="space-y-2 text-center">
          <h2 className="text-header font-headline font-bold text-text-primary leading-snug">
            {t('baseLimitConfirmTitle', String(selectedLimit))}
          </h2>
          <p className="text-[0.875rem] text-text-secondary">
            {t('baseLimitConfirmDescription')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedLimit(null)}
            className="btn-secondary"
          >
            {t('baseLimitCancel')}
          </button>
          <button
            type="button"
            onClick={isReady ? () => onSave(selectedLimit) : undefined}
            disabled={!isReady}
            className={
              isReady
                ? 'btn-cta'
                : 'flex-1 py-2.5 rounded-[1px] font-headline font-bold text-xs uppercase tracking-widest bg-white/[0.06] text-text-tertiary cursor-not-allowed'
            }
          >
            {t('baseLimitSave')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-center text-text-secondary text-[0.875rem] mb-4">
        {t('baseLimitTitle')} ({t('unitMin')})
      </p>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {PRESETS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handlePresetClick(value)}
            className={`
              rounded-sm py-2.5 text-center font-headline font-bold tabular-nums transition-all
              ${
                value === baseLimitMinutes
                  ? 'bg-bg-tertiary ring-1 ring-accent-red-soft text-text-primary'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary active:scale-[0.97]'
              }
            `}
          >
            <span className="text-[0.875rem]">{value}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="w-full h-10 rounded-sm font-headline font-bold text-xs uppercase tracking-widest bg-white/[0.06] text-text-primary hover:bg-white/[0.12] active:scale-[0.98] transition-all"
      >
        {t('baseLimitCancel')}
      </button>
    </div>
  );
}
