/** Current storage schema version */
export const STORAGE_VERSION = 1;

/** Known domain aliases → canonical domain */
export const DOMAIN_ALIASES: Record<string, string> = {
  'x.com': 'twitter.com',
  'youtu.be': 'youtube.com',
  'old.reddit.com': 'reddit.com',
  'm.facebook.com': 'facebook.com',
  'fb.com': 'facebook.com',
  'vm.tiktok.com': 'tiktok.com',
};

/** Default preset sites added on first install (all set to 10 min) */
export const DEFAULT_PRESET_DOMAINS = [
  'youtube.com',
  'facebook.com',
  'reddit.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
] as const;

/** Default daily limit for new sites (minutes) */
export const DEFAULT_LIMIT_MINUTES = 10;

/** Slider constraints (minutes) */
export const LIMIT_MIN = 0;
export const LIMIT_MAX = 60;
export const LIMIT_STEP = 5;

/** Absolute daily maximum per site (seconds) — hard block, no override */
export const HARD_CAP_SECONDS = 3600;

/** Nuclear mode time options (minutes) */
export const NUCLEAR_TIME_OPTIONS = [
  5, 15, 30, 60, 120, 180, 240, 300,
] as const;

/** Site limits */
export const MAX_SITES = 20;

/** Popup dimensions */
export const POPUP_WIDTH = 380;
export const POPUP_MAX_HEIGHT = 580;

/** Estimated average session duration per domain (minutes) — for "saved time" calculation */
export const DEFAULT_SESSION_MINUTES: Record<string, number> = {
  'youtube.com': 12,
  'tiktok.com': 10,
  'twitch.tv': 15,
  'reddit.com': 8,
  'twitter.com': 7,
  'facebook.com': 8,
  'instagram.com': 7,
  'snapchat.com': 5,
};

/** Fallback session duration for domains not in DEFAULT_SESSION_MINUTES */
export const FALLBACK_SESSION_MINUTES = 7;

/** Usage ratio thresholds for progress bar color tiers */
export const USAGE_TIER_AMBER = 0.6;
export const USAGE_TIER_RED_SOFT = 0.85;
/** i18n day label keys (Mon–Sun) — resolved at runtime via t() */
export const DAY_LABEL_KEYS = [
  'dayMon',
  'dayTue',
  'dayWed',
  'dayThu',
  'dayFri',
  'daySat',
  'daySun',
] as const;
