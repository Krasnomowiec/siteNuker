const SIZE_MAP = {
  sm: { box: 'w-4 h-4', text: 'text-[8px]' },
  md: { box: 'w-6 h-6', text: 'text-[10px]' },
} as const;

/**
 * Muted badge colors that match the app's dark, low-saturation palette.
 * Intensity kept close to bg-elevated (#353439) and text-tertiary (#aa8985).
 */
const BADGE_COLORS = [
  { bg: '#3E2C2B', fg: '#C49A94' }, // warm red
  { bg: '#3B3024', fg: '#C4A88E' }, // sienna
  { bg: '#38342A', fg: '#BFB08A' }, // olive gold
  { bg: '#2B3629', fg: '#99B48E' }, // sage
  { bg: '#263634', fg: '#8FB5AB' }, // teal
  { bg: '#272F38', fg: '#8EA8BE' }, // slate blue
  { bg: '#2E2C3A', fg: '#9D98BE' }, // lavender
  { bg: '#372C38', fg: '#B498B0' }, // mauve
  { bg: '#3A2B30', fg: '#BE98A4' }, // rose
  { bg: '#33302B', fg: '#B5A898' }, // sand
] as const;

/** Simple hash to deterministically pick a color per domain */
function domainColorIndex(domain: string): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % BADGE_COLORS.length;
}

interface SiteFaviconProps {
  domain: string;
  size?: 'sm' | 'md';
}

export function SiteFavicon({ domain, size = 'md' }: SiteFaviconProps) {
  const { box, text } = SIZE_MAP[size];
  const color = BADGE_COLORS[domainColorIndex(domain)]!;

  return (
    <div
      className={`${box} rounded-sm flex items-center justify-center shrink-0`}
      style={{ backgroundColor: color.bg }}
    >
      <span className={`${text} font-bold uppercase`} style={{ color: color.fg }}>
        {domain[0]}
      </span>
    </div>
  );
}
