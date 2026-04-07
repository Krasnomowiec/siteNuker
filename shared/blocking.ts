import type { StorageSchema, SiteConfig } from './types';
import { DOMAIN_ALIASES, HARD_CAP_SECONDS } from './constants';
import { getTodayKey } from './utils';

/**
 * Rule ID allocation:
 * - Each domain+alias combination gets a unique ID via FNV-1a hash
 * - Site blocks: IDs in range 1–49_999
 * - Nuclear blocks: IDs offset by +50_000
 * - Each alias gets its own FNV-1a hash-based ID
 *
 * FNV-1a 32-bit produces far fewer collisions than djb2 in a small range.
 * We mod by 49_999 (prime) to spread values evenly.
 */
const SITE_RULE_BASE = 1;
const NUCLEAR_RULE_OFFSET = 50_000;
const ID_RANGE = 49_999;
const BLOCKED_PAGE_PATH = '/blocked.html';

/** FNV-1a hash → stable numeric ID within range */
function domainToRuleId(domain: string, base: number): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < domain.length; i++) {
    hash ^= domain.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return base + ((hash >>> 0) % ID_RANGE);
}

/** Get all known URL patterns for a domain (including aliases) */
function getDomainPatterns(domain: string): string[] {
  const patterns = [domain];
  for (const [alias, canonical] of Object.entries(DOMAIN_ALIASES)) {
    if (canonical === domain) {
      patterns.push(alias);
    }
  }
  return patterns;
}

/** Build declarativeNetRequest redirect rules for a domain and its aliases */
function buildRedirectRules(
  domain: string,
  isNuclear: boolean,
): Browser.declarativeNetRequest.Rule[] {
  const patterns = getDomainPatterns(domain);
  const base = isNuclear
    ? SITE_RULE_BASE + NUCLEAR_RULE_OFFSET
    : SITE_RULE_BASE;

  return patterns.map((pattern, index) => ({
    // Each alias gets its own hash-based ID to avoid collisions
    id:
      index === 0
        ? domainToRuleId(domain, base)
        : domainToRuleId(pattern, base),
    priority: 1,
    action: {
      type: 'redirect' as Browser.declarativeNetRequest.RuleActionType,
      redirect: { extensionPath: BLOCKED_PAGE_PATH },
    },
    condition: {
      requestDomains: [pattern],
      resourceTypes: [
        'main_frame' as Browser.declarativeNetRequest.ResourceType,
      ],
    },
  }));
}

/** Add blocking rules for a single site that exceeded its limit */
export async function addSiteBlockRule(site: SiteConfig): Promise<void> {
  const rules = buildRedirectRules(site.domain, false);
  const ruleIds = rules.map((r) => r.id);

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
      addRules: rules,
    });
  } catch (error) {
    console.error(
      `[blocking] Failed to add site rule for ${site.domain}:`,
      error,
    );
    throw error;
  }
}

/** Remove blocking rules for a single site */
export async function removeSiteBlockRule(site: SiteConfig): Promise<void> {
  const rules = buildRedirectRules(site.domain, false);
  const ruleIds = rules.map((r) => r.id);

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds,
    });
  } catch (error) {
    console.error(
      `[blocking] Failed to remove site rule for ${site.domain}:`,
      error,
    );
  }
}

/** Add nuclear mode blocking rules for ALL sites */
export async function addNuclearRules(sites: SiteConfig[]): Promise<void> {
  const allRules: Browser.declarativeNetRequest.Rule[] = [];
  const allRemoveIds: number[] = [];

  for (const site of sites) {
    const rules = buildRedirectRules(site.domain, true);
    allRules.push(...rules);
    allRemoveIds.push(...rules.map((r) => r.id));
  }

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: allRemoveIds,
      addRules: allRules,
    });
  } catch (error) {
    console.error('[blocking] Failed to add nuclear rules:', error);
  }
}

/** Remove all nuclear mode blocking rules */
export async function removeNuclearRules(sites: SiteConfig[]): Promise<void> {
  const allRemoveIds: number[] = [];
  for (const site of sites) {
    const rules = buildRedirectRules(site.domain, true);
    allRemoveIds.push(...rules.map((r) => r.id));
  }

  try {
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: allRemoveIds,
    });
  } catch (error) {
    console.error('[blocking] Failed to remove nuclear rules:', error);
  }
}

/** Remove ALL dynamic rules (site + nuclear) */
export async function removeAllRules(): Promise<void> {
  try {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    if (existing.length > 0) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((r) => r.id),
      });
    }
  } catch (error) {
    console.error('[blocking] Failed to remove all rules:', error);
  }
}

/**
 * Reconcile dynamic rules with current storage state.
 * Called on startup / extension enable to ensure rules match reality.
 */
export async function reconcileRules(storage: StorageSchema): Promise<void> {
  await removeAllRules();

  if (!storage.isEnabled) return;

  // Nuclear mode takes priority
  if (storage.nuclearMode) {
    const expiresAt = new Date(storage.nuclearMode.expiresAt).getTime();
    if (expiresAt > Date.now()) {
      await addNuclearRules(storage.sites);
      return;
    }
  }

  // Re-add rules for sites that have exceeded their daily limit
  const today = getTodayKey();
  const dayUsage = storage.usage[today] ?? {};

  for (const site of storage.sites) {
    const du = dayUsage[site.domain];
    const usedSeconds = du?.usedSeconds ?? 0;
    if (usedSeconds >= site.dailyLimitMinutes * 60 || usedSeconds >= HARD_CAP_SECONDS || du?.hardBlockedAt) {
      await addSiteBlockRule(site);
    }
  }
}

/** Check if a domain is currently blocked (limit exceeded, hard cap, or manually hard-blocked) */
export function isDomainBlocked(
  site: SiteConfig,
  usedSeconds: number,
  hardBlockedAt?: string | null,
): boolean {
  if (hardBlockedAt) return true;
  if (usedSeconds >= HARD_CAP_SECONDS) return true;
  return usedSeconds >= site.dailyLimitMinutes * 60;
}
