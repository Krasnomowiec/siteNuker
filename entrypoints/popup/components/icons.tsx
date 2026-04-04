interface IconProps {
  className?: string;
  size?: number;
}

export function ChartIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <rect x="2" y="10" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="7.5" y="4" width="3" height="12" rx="0.5" fill="currentColor" />
      <rect x="13" y="7" width="3" height="9" rx="0.5" fill="currentColor" />
    </svg>
  );
}

export function NuclearIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <circle cx="9" cy="9" r="2" fill="currentColor" />
      <path
        d="M9 1.5a7.5 7.5 0 0 0-6.5 3.75L5.5 7A4.5 4.5 0 0 1 9 5V1.5z"
        fill="currentColor"
      />
      <path
        d="M2.5 5.25A7.5 7.5 0 0 0 2.5 12.75L5.5 11A4.5 4.5 0 0 1 4.5 9 4.5 4.5 0 0 1 5.5 7L2.5 5.25z"
        fill="currentColor"
      />
      <path
        d="M15.5 5.25 12.5 7A4.5 4.5 0 0 1 13.5 9a4.5 4.5 0 0 1-1 2l3 1.75a7.5 7.5 0 0 0 0-7.5z"
        fill="currentColor"
      />
      <path
        d="M9 16.5a7.5 7.5 0 0 0 6.5-3.75L12.5 11A4.5 4.5 0 0 1 9 13v3.5z"
        fill="currentColor"
      />
      <path
        d="M9 16.5a7.5 7.5 0 0 1-6.5-3.75L5.5 11A4.5 4.5 0 0 0 9 13v3.5z"
        fill="currentColor"
      />
      <path
        d="M15.5 5.25A7.5 7.5 0 0 0 9 1.5V5a4.5 4.5 0 0 1 3.5 2l3-1.75z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChevronIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <path
        d="M6 7l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertCircleIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M9 6v3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="9" cy="12.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon({ className, size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      className={className}
    >
      <path
        d="M3.5 5h11M7 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5m1.5 0v9a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 14V5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
