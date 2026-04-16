const RING_RADIUS = 36;
const STROKE_WIDTH = 4;
const SVG_SIZE = (RING_RADIUS + STROKE_WIDTH) * 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const TICK_MS = 50;

interface CountdownRingProps {
  msLeft: number;
  durationMs: number;
  secondsLeft: number;
}

export function CountdownRing({
  msLeft,
  durationMs,
  secondsLeft,
}: CountdownRingProps) {
  const dashOffset = RING_CIRCUMFERENCE * (msLeft / durationMs);

  return (
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
          <circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(42, 42, 46, 0.5)"
            strokeWidth={STROKE_WIDTH}
          />
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
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-headline font-bold text-xl text-text-primary tabular-nums">
            {secondsLeft}
          </span>
        </div>
      </div>
    </div>
  );
}
