import { useState, useEffect } from 'react';
import type { NuclearModeState } from '@/shared/types';
import { formatTimeCountdown } from '@/shared/utils';
import { t } from '@/shared/i18n';

interface NuclearCountdownProps {
  nuclearMode: NuclearModeState;
  onComplete: () => void;
}

const RING_RADIUS = 100;
const STROKE_WIDTH = 10;
const SVG_SIZE = (RING_RADIUS + STROKE_WIDTH) * 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function NuclearCountdown({
  nuclearMode,
  onComplete,
}: NuclearCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(
      0,
      Math.ceil(
        (new Date(nuclearMode.expiresAt).getTime() - Date.now()) / 1000,
      ),
    ),
  );
  const [completionPhase, setCompletionPhase] = useState<
    'none' | 'bloom' | 'settle'
  >('none');

  const totalSeconds = nuclearMode.durationMinutes * 60;
  const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const isComplete = remainingSeconds <= 0;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(nuclearMode.expiresAt).getTime() - Date.now()) / 1000,
        ),
      );
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nuclearMode.expiresAt]);

  // Completion sequence: bloom → settle → onComplete
  useEffect(() => {
    if (!isComplete || completionPhase !== 'none') return;

    // Defer setState to avoid synchronous update in effect body
    const bloomTimeout = setTimeout(() => setCompletionPhase('bloom'), 0);
    const settleTimeout = setTimeout(() => setCompletionPhase('settle'), 800);
    const completeTimeout = setTimeout(onComplete, 2800);

    return () => {
      clearTimeout(bloomTimeout);
      clearTimeout(settleTimeout);
      clearTimeout(completeTimeout);
    };
  }, [isComplete, completionPhase, onComplete]);

  const dashOffset = isComplete ? 0 : RING_CIRCUMFERENCE * (1 - progress);
  const isBloom = completionPhase === 'bloom';

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      {/* Header */}
      <div className="text-center shrink-0">
        <h1 className="font-headline font-semibold text-header text-accent-red">
          {t('nuclearCountdownTitle')}
        </h1>
        <p className="text-body text-text-tertiary mt-1.5 max-w-[340px] mx-auto leading-relaxed">
          {isComplete
            ? t('nuclearCountdownExpired')
            : t('nuclearCountdownActive')}
        </p>
      </div>

      {/* Timer ring */}
      <div className="flex justify-center relative">
        {/* Radial glow anchored to ring */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(254,85,74,0.06) 0%, transparent 60%)',
          }}
        />

        <div className="relative">
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className={`sn-ring-glow ${isBloom ? 'sn-ring-glow-bloom' : ''}`}
            role="timer"
            aria-live={remainingSeconds <= 60 ? 'assertive' : 'polite'}
            aria-atomic="true"
            aria-label={t('nuclearCountdownRemaining', formatTimeCountdown(remainingSeconds))}
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
                transition: isComplete
                  ? 'stroke-dashoffset 600ms ease-out'
                  : 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </svg>

          {/* Time display / completion text */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isComplete ? (
              <span className="font-headline font-medium text-[20px] text-text-secondary animate-completion-text">
                {t('nuclearCountdownDone')}
              </span>
            ) : (
              <span
                className="font-headline font-medium text-[48px] text-text-primary tracking-wide tabular-nums"
                style={{ opacity: 0.9 }}
              >
                {formatTimeCountdown(remainingSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
