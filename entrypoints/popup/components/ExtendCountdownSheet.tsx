import { useState, useEffect, useRef } from 'react';
import { t } from '@/shared/i18n';

interface ExtendCountdownSheetProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const RING_RADIUS = 36;
const STROKE_WIDTH = 4;
const SVG_SIZE = (RING_RADIUS + STROKE_WIDTH) * 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
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
  const dashOffset = RING_CIRCUMFERENCE * (msLeft / (COUNTDOWN_SECONDS * 1000));

  return (
    <div className="space-y-5">
      {/* Ring countdown */}
      <div className="flex justify-center">
        <div className="relative">
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            role="timer"
            aria-live={secondsLeft <= 5 ? 'assertive' : 'polite'}
            aria-atomic="true"
            aria-label={`${secondsLeft}s`}
          >
            {/* Background ring */}
            <circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(42, 42, 46, 0.5)"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Progress ring */}
            <circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-accent-red)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${SVG_SIZE / 2} ${SVG_SIZE / 2})`}
              style={{
                transition: `stroke-dashoffset ${TICK_MS}ms linear`,
              }}
            />
          </svg>

          {/* Seconds display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-headline font-bold text-xl text-text-primary tabular-nums">
              {secondsLeft}
            </span>
          </div>
        </div>
      </div>

      {/* Copy */}
      <div className="space-y-2 text-center">
        <h2 className="text-header font-headline font-bold text-text-primary leading-snug">
          {t('extendCountdownTitle')}
        </h2>
        <p className="text-[0.875rem] text-text-secondary">
          {t('extendCountdownDescription')}
        </p>
      </div>

      {/* Buttons */}
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
