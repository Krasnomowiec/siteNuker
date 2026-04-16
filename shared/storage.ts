import type { StorageSchema } from './types';
import {
  STORAGE_VERSION,
  DEFAULT_PRESET_DOMAINS,
  DEFAULT_LIMIT_MINUTES,
} from './constants';

/** Default storage state for fresh install */
function getDefaultStorage(): StorageSchema {
  return {
    version: STORAGE_VERSION,
    isEnabled: true,
    nuclearMode: null,
    sites: DEFAULT_PRESET_DOMAINS.map((domain, index) => ({
      id: crypto.randomUUID(),
      domain,
      dailyLimitMinutes: DEFAULT_LIMIT_MINUTES,
      baseLimitMinutes: DEFAULT_LIMIT_MINUTES,
      isPreset: true,
      addedAt: new Date(Date.now() + index).toISOString(),
    })),
    usage: {},
    history: {},
  };
}

/** Minimal runtime check that a site entry has required fields */
function isValidSiteConfig(site: unknown): boolean {
  if (typeof site !== 'object' || site === null) return false;
  const s = site as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.domain === 'string' &&
    typeof s.dailyLimitMinutes === 'number'
  );
}

/** Minimal runtime check that loaded data looks like a StorageSchema */
function isValidStorageSchema(data: Record<string, unknown>): boolean {
  return (
    typeof data.version === 'number' &&
    typeof data.isEnabled === 'boolean' &&
    Array.isArray(data.sites) &&
    data.sites.every(isValidSiteConfig) &&
    typeof data.usage === 'object' &&
    data.usage !== null &&
    typeof data.history === 'object' &&
    data.history !== null
  );
}

/**
 * Incremental migration functions keyed by target version.
 * Each function receives the raw storage object and mutates it in place.
 * To add a new migration: bump STORAGE_VERSION in constants.ts,
 * then add an entry here: `[newVersion]: (data) => { ... }`.
 */
const migrations: Record<
  number,
  (data: Record<string, unknown>) => void
> = {
  2: (data) => {
    const sites = data.sites as Array<Record<string, unknown>>;
    for (const site of sites) {
      site.baseLimitMinutes = site.initialLimitMinutes ?? site.baseLimitMinutes ?? 10;
      delete site.initialLimitMinutes;
    }
  },
};

/** Apply all pending migrations from data.version → STORAGE_VERSION */
function migrateStorage(data: Record<string, unknown>): void {
  let v = data.version as number;
  while (v < STORAGE_VERSION) {
    v++;
    const migrate = migrations[v];
    if (migrate) migrate(data);
  }
  data.version = STORAGE_VERSION;
}

/** Read full storage state from browser.storage.local */
export async function readStorage(): Promise<StorageSchema> {
  let data: Record<string, unknown>;
  try {
    data = await browser.storage.local.get(null);
  } catch (err) {
    console.error('[SitesNuker] Failed to read storage, resetting to defaults:', err);
    const defaults = getDefaultStorage();
    await browser.storage.local.set(defaults);
    return defaults;
  }

  if (!data.version || !isValidStorageSchema(data)) {
    const defaults = getDefaultStorage();
    await browser.storage.local.set(defaults);
    return defaults;
  }

  if ((data.version as number) < STORAGE_VERSION) {
    migrateStorage(data);
    await browser.storage.local.set(data);
  }

  return data as unknown as StorageSchema;
}

/** Write partial storage update — throws on failure so callers can react */
export async function writeStorage(
  partial: Partial<StorageSchema>,
): Promise<void> {
  try {
    await browser.storage.local.set(partial);
  } catch (error) {
    console.error('[storage] Write failed (quota exceeded?):', error);
    throw error;
  }
}

