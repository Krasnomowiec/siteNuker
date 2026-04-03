import { useState } from 'react';

const SIZE_MAP = {
  sm: { box: 'w-4 h-4', text: 'text-[8px]' },
  md: { box: 'w-6 h-6', text: 'text-[10px]' },
} as const;

interface SiteFaviconProps {
  domain: string;
  size?: 'sm' | 'md';
}

export function SiteFavicon({ domain, size = 'md' }: SiteFaviconProps) {
  const [failed, setFailed] = useState(false);
  const { box, text } = SIZE_MAP[size];

  // Privacy note: favicons are fetched from Google's service, which means
  // Google can see which domains the user tracks. Accepted trade-off for UX.
  if (failed) {
    return (
      <div
        className={`${box} rounded-sm bg-bg-elevated flex items-center justify-center shrink-0`}
      >
        <span className={`${text} font-bold text-text-tertiary uppercase`}>
          {domain[0]}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className={`${box} rounded-sm shrink-0`}
      onError={() => setFailed(true)}
    />
  );
}
