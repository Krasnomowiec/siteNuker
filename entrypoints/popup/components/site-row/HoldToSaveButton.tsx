import { useState, useRef, useEffect } from 'react';
import { t } from '@/shared/i18n';

const HOLD_DURATION = 1500;

interface HoldToSaveButtonProps {
  onSave: () => void;
  disabled: boolean;
}

export function HoldToSaveButton({ onSave, disabled }: HoldToSaveButtonProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref current + cleanup RAF on unmount
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function startHoldLoop() {
    function tick() {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_DURATION);
      setProgress(p);
      if (p >= 1) {
        onSaveRef.current();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function handlePointerDown() {
    if (disabled) return;
    startRef.current = performance.now();
    startHoldLoop();
  }

  function handlePointerUp() {
    cancelAnimationFrame(rafRef.current);
    setProgress(0);
  }

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      disabled={disabled}
      className={`
        relative flex-1 ml-4 py-2.5 rounded-sm font-headline font-bold uppercase tracking-widest overflow-hidden transition-transform flex items-center justify-center
        ${
          disabled
            ? 'bg-bg-elevated text-text-tertiary cursor-not-allowed'
            : 'sn-gradient-cta text-[#690005] cursor-pointer active:scale-95'
        }
      `}
    >
      {!disabled && (
        <div
          className="absolute inset-0 bg-white/15 rounded-sm transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      )}
      <span className="relative z-10 text-xs leading-tight">
        {t('siteRowHoldToSave')}
      </span>
    </button>
  );
}
