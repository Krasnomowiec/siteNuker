/** Persisted in browser.storage.local — source of truth */
export interface StorageSchema {
  /** Schema version for migration support */
  version: number;

  /** Global on/off state */
  isEnabled: boolean;

  /** Active nuclear mode state, or null if inactive */
  nuclearMode: NuclearModeState | null;

  /** Configured blocked sites */
  sites: SiteConfig[];

  /** Daily usage keyed by date string (YYYY-MM-DD) */
  usage: Record<string, DailyUsage>;

  /** Historical data for statistics (last 30 days) */
  history: Record<string, DailyUsage>;
}

export interface SiteConfig {
  /** UUID */
  id: string;

  /** Canonical domain (e.g. "youtube.com") */
  domain: string;

  /** Current daily limit in minutes (0–120, step 5) */
  dailyLimitMinutes: number;

  /** Limit set when first added (for badge calculation) */
  initialLimitMinutes: number;

  /** Was this a default preset site */
  isPreset: boolean;

  /** ISO timestamp of when site was added */
  addedAt: string;
}

/** Usage data for a single day, keyed by domain */
export type DailyUsage = Record<string, DomainUsage>;

export interface DomainUsage {
  /** Seconds spent on this domain today */
  usedSeconds: number;

  /** Times user tried to visit after limit reached */
  blockedAttempts: number;

  /** Log of limit changes made today */
  limitChanges: LimitChange[];
}

export interface LimitChange {
  /** ISO timestamp */
  timestamp: string;

  /** Previous limit in minutes */
  from: number;

  /** New limit in minutes */
  to: number;
}

export interface NuclearModeState {
  /** ISO timestamp of activation */
  activatedAt: string;

  /** Chosen duration in minutes */
  durationMinutes: number;

  /** ISO timestamp of expiry */
  expiresAt: string;
}

