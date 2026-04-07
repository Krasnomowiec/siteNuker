import { describe, it, expect } from 'vitest';
import { isDomainBlocked } from '../blocking';
import type { SiteConfig } from '../types';

function makeSite(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    id: 'test-id',
    domain: 'youtube.com',
    dailyLimitMinutes: 10,
    initialLimitMinutes: 10,
    isPreset: true,
    addedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('isDomainBlocked', () => {
  it('returns false when under limit', () => {
    const site = makeSite({ dailyLimitMinutes: 10 });
    expect(isDomainBlocked(site, 599)).toBe(false);
  });

  it('returns true when exactly at limit', () => {
    const site = makeSite({ dailyLimitMinutes: 10 });
    expect(isDomainBlocked(site, 600)).toBe(true);
  });

  it('returns true when over limit', () => {
    const site = makeSite({ dailyLimitMinutes: 10 });
    expect(isDomainBlocked(site, 601)).toBe(true);
  });

  it('returns true when limit is 0 and any usage', () => {
    const site = makeSite({ dailyLimitMinutes: 0 });
    expect(isDomainBlocked(site, 0)).toBe(true);
  });

  it('handles large limits (capped by HARD_CAP_SECONDS = 3600)', () => {
    const site = makeSite({ dailyLimitMinutes: 120 });
    // Under both limit and hard cap
    expect(isDomainBlocked(site, 3599)).toBe(false);
    // At hard cap — blocked even though under 120min limit
    expect(isDomainBlocked(site, 3600)).toBe(true);
    // Over both
    expect(isDomainBlocked(site, 7200)).toBe(true);
  });

  it('returns true when hardBlockedAt is set, regardless of usage', () => {
    const site = makeSite({ dailyLimitMinutes: 60 });
    expect(isDomainBlocked(site, 0, '2026-04-07T12:00:00Z')).toBe(true);
    expect(isDomainBlocked(site, 100, '2026-04-07T12:00:00Z')).toBe(true);
  });

  it('ignores null/undefined hardBlockedAt', () => {
    const site = makeSite({ dailyLimitMinutes: 10 });
    expect(isDomainBlocked(site, 599, null)).toBe(false);
    expect(isDomainBlocked(site, 599, undefined)).toBe(false);
    expect(isDomainBlocked(site, 599)).toBe(false);
  });
});
