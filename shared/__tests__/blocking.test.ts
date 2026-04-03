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

  it('handles large limits', () => {
    const site = makeSite({ dailyLimitMinutes: 120 });
    expect(isDomainBlocked(site, 7199)).toBe(false);
    expect(isDomainBlocked(site, 7200)).toBe(true);
  });
});
