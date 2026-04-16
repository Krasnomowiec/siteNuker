import { useState, useEffect, useRef } from 'react';
import { t } from '@/shared/i18n';
import { CountdownRing } from './CountdownRing';

interface ExtendCountdownSheetProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const COUNTDOWN_SECONDS = 20;
const TICK_MS = 50;

export function ExtendCountdownSheet({
  onConfirm,
  onCancel,
}: ExtendCountdownSheetProps) {
  const [msLeft, setMsLeft] = useState(COUNTDOWN_SECONDS * 1000);
  const prevTime = useRef(0);

  useEffect(() => {
    prevTime.current = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - prevTime.current;
      prevTime.current = now;
      setMsLeft((prev) => Math.max(0, prev - elapsed));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, []);

  const secondsLeft = Math.ceil(msLeft / 1000);
  const isReady = msLeft <= 0;

  return (
    <div className="space-y-5">
      <CountdownRing
        msLeft={msLeft}
        durationMs={COUNTDOWN_SECONDS * 1000}
        secondsLeft={secondsLeft}
      />

      <div className="space-y-2 text-center">
        <h2 className="text-header font-headline font-bold text-text-primary leading-snug">
          {t('extendCountdownTitle')}
        </h2>
        <p className="text-[0.875rem] text-text-secondary">
          {t('extendCountdownDescription')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('extendCountdownCancel')}
        </button>
        <button
          type="button"
          onClick={isReady ? onConfirm : undefined}
          disabled={!isReady}
          className={
            isReady
              ? 'btn-cta'
              : 'flex-1 py-2.5 rounded-[1px] font-headline font-bold text-xs uppercase tracking-widest bg-white/[0.06] text-text-tertiary cursor-not-allowed'
          }
        >
          {t('extendCountdownConfirm')}
        </button>
      </div>
    </div>
  );
}
