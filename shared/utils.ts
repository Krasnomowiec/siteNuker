import type { DailyUsage } from './types';

/** Format a Date to YYYY-MM-DD */
export function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get today's date key in YYYY-MM-DD format */
export function getTodayKey(): string {
  return getDateKey(new Date());
}

/** Extract today's usage data from the usage record */
export function getTodayUsage(usage: Record<string, DailyUsage>): DailyUsage {
  return usage[getTodayKey()] ?? {};
}

/** Get 7 YYYY-MM-DD keys for Mon–Sun of the week containing `date` */
export function getWeekDateKeys(date: Date): string[] {
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return getDateKey(d);
  });
}

/** Format seconds to "MM:SS" with zero-padded minutes (for compact badges) */
export function formatTimeCompact(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format seconds to "M:SS" without padded minutes (for countdown timers) */
export function formatTimeCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Domain regex for validation */
export const DOMAIN_REGEX =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

/** Extract and validate a domain from user input (full URL or bare domain). */
export function extractDomain(
  input: string,
  aliases: Record<string, string>,
): string | null {
  let str = input.trim();
  if (!str) return null;

  if (/^https?:\/\//i.test(str)) {
    try {
      str = new URL(str).hostname;
    } catch {
      return null;
    }
  } else if (str.includes('://')) {
    return null;
  }

  // Strip path/query if user pasted domain with path (e.g. "reddit.com/r/cats")
  str = str.split('/')[0] ?? str;

  str = str.replace(/^www\./, '');
  str = aliases[str] ?? str;

  if (!DOMAIN_REGEX.test(str)) return null;
  return str.toLowerCase();
}

/**
 * Match a hostname against tracked sites using suffix matching.
 * Handles subdomains: "music.youtube.com" matches site "youtube.com".
 * Returns the matching SiteConfig or undefined.
 */
export function findMatchingSite<T extends { domain: string }>(
  hostname: string,
  sites: T[],
  aliases: Record<string, string>,
): T | undefined {
  // Normalize: strip www, resolve aliases
  let normalized = hostname.replace(/^www\./, '').toLowerCase();
  normalized = aliases[normalized] ?? normalized;

  // Exact match first
  const exact = sites.find((s) => s.domain === normalized);
  if (exact) return exact;

  // Suffix match: "music.youtube.com" ends with ".youtube.com"
  return sites.find((s) => normalized.endsWith('.' + s.domain));
}

/** Short format for chart labels: "42m", "1h 42m" */
export function formatMinutesShort(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
