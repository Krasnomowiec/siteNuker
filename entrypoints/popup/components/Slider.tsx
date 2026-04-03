import { useRef, useCallback, type KeyboardEvent } from 'react';
import { LIMIT_MIN, LIMIT_MAX, LIMIT_STEP } from '@/shared/constants';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

function snap(raw: number, min: number, max: number, step: number): number {
  return Math.min(max, Math.max(min, Math.round(raw / step) * step));
}

export function Slider({
  value,
  onChange,
  min = LIMIT_MIN,
  max = LIMIT_MAX,
  step = LIMIT_STEP,
  disabled = false,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const percentage = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const resolveValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      const rawValue = snap(min + (max - min) * fraction, min, max, step);
      if (rawValue !== value) onChange(rawValue);
    },
    [min, max, step, value, onChange],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      resolveValue(event.clientX);
    },
    [disabled, resolveValue],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (
        disabled ||
        !(event.target as HTMLElement).hasPointerCapture(event.pointerId)
      )
        return;
      resolveValue(event.clientX);
    },
    [disabled, resolveValue],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;
      let newValue = value;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        newValue = Math.min(max, value + step);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        newValue = Math.max(min, value - step);
      } else if (event.key === 'Home') {
        newValue = min;
      } else if (event.key === 'End') {
        newValue = max;
      } else {
        return;
      }
      event.preventDefault();
      if (newValue !== value) onChange(newValue);
    },
    [disabled, value, min, max, step, onChange],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className={`sn-slider-track group relative flex-1 h-6 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* Track background */}
      <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 rounded-full bg-bg-secondary" />

      {/* Fill — min width so thumb doesn't fully cover it at low values */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-accent-red"
        style={{ width: `max(${percentage}%, ${value > min ? 12 : 0}px)` }}
      />

      {/* Thumb */}
      <div
        className="sn-slider-thumb absolute w-4 h-4 rounded-full bg-accent-red-soft"
        style={{
          left: `${percentage}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
}
