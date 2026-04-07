import { describe, it, expect } from 'vitest';
import {
  getDateKey,
  getTodayKey,
  getWeekDateKeys,
  formatTimeCompact,
  formatTimeCountdown,
  extractDomain,
  formatMinutesShort,
} from '../utils';

describe('getDateKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(getDateKey(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(getDateKey(new Date(2025, 11, 31))).toBe('2025-12-31');
  });

  it('zero-pads single-digit months and days', () => {
    expect(getDateKey(new Date(2025, 2, 3))).toBe('2025-03-03');
  });
});

describe('getTodayKey', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const now = new Date();
    const expected = getDateKey(now);
    expect(getTodayKey()).toBe(expected);
  });
});

describe('getWeekDateKeys', () => {
  it('returns 7 keys starting from Monday', () => {
    // Wednesday 2025-03-05
    const wed = new Date(2025, 2, 5);
    const keys = getWeekDateKeys(wed);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2025-03-03'); // Monday
    expect(keys[6]).toBe('2025-03-09'); // Sunday
  });

  it('handles Sunday correctly (start of ISO week is previous Monday)', () => {
    // Sunday 2025-03-09
    const sun = new Date(2025, 2, 9);
    const keys = getWeekDateKeys(sun);
    expect(keys[0]).toBe('2025-03-03');
    expect(keys[6]).toBe('2025-03-09');
  });

  it('handles Monday correctly', () => {
    const mon = new Date(2025, 2, 3);
    const keys = getWeekDateKeys(mon);
    expect(keys[0]).toBe('2025-03-03');
  });

  it('handles week crossing month boundary', () => {
    // Friday 2025-01-31 → week starts Mon 2025-01-27, ends Sun 2025-02-02
    const fri = new Date(2025, 0, 31);
    const keys = getWeekDateKeys(fri);
    expect(keys[0]).toBe('2025-01-27');
    expect(keys[6]).toBe('2025-02-02');
  });
});

describe('formatTimeCompact', () => {
  it('formats zero seconds', () => {
    expect(formatTimeCompact(0)).toBe('00:00');
  });

  it('formats seconds only', () => {
    expect(formatTimeCompact(45)).toBe('00:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimeCompact(90)).toBe('01:30');
  });

  it('formats larger values', () => {
    expect(formatTimeCompact(600)).toBe('10:00');
    expect(formatTimeCompact(3661)).toBe('61:01');
  });
});

describe('formatTimeCountdown', () => {
  it('returns "0:00" for zero or negative', () => {
    expect(formatTimeCountdown(0)).toBe('0:00');
    expect(formatTimeCountdown(-10)).toBe('0:00');
  });

  it('formats without padded minutes', () => {
    expect(formatTimeCountdown(90)).toBe('1:30');
    expect(formatTimeCountdown(5)).toBe('0:05');
  });

  it('formats larger values', () => {
    expect(formatTimeCountdown(600)).toBe('10:00');
  });
});

describe('extractDomain', () => {
  const aliases: Record<string, string> = {
    'youtu.be': 'youtube.com',
    'old.reddit.com': 'reddit.com',
    'fb.com': 'facebook.com',
  };

  it('extracts domain from full URL', () => {
    expect(extractDomain('https://youtube.com/watch?v=123', aliases)).toBe(
      'youtube.com',
    );
  });

  it('extracts domain from http URL', () => {
    expect(extractDomain('http://reddit.com/r/cats', aliases)).toBe(
      'reddit.com',
    );
  });

  it('handles bare domain input', () => {
    expect(extractDomain('youtube.com', aliases)).toBe('youtube.com');
  });

  it('handles domain with path', () => {
    expect(extractDomain('reddit.com/r/cats', aliases)).toBe('reddit.com');
  });

  it('strips www prefix', () => {
    expect(extractDomain('www.youtube.com', aliases)).toBe('youtube.com');
  });

  it('resolves known aliases', () => {
    expect(extractDomain('https://youtu.be/abc', aliases)).toBe('youtube.com');
    expect(extractDomain('fb.com', aliases)).toBe('facebook.com');
  });

  it('returns null for empty input', () => {
    expect(extractDomain('', aliases)).toBeNull();
    expect(extractDomain('   ', aliases)).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(extractDomain('not a domain', aliases)).toBeNull();
    expect(extractDomain('ftp://something.com', aliases)).toBeNull();
  });

  it('lowercases the result', () => {
    expect(extractDomain('YouTube.COM', aliases)).toBe('youtube.com');
  });
});

describe('formatMinutesShort', () => {
  it('returns "0m" for zero or negative', () => {
    expect(formatMinutesShort(0)).toBe('0m');
    expect(formatMinutesShort(-5)).toBe('0m');
  });

  it('formats minutes only', () => {
    expect(formatMinutesShort(42)).toBe('42m');
  });

  it('formats hours only', () => {
    expect(formatMinutesShort(60)).toBe('1h');
    expect(formatMinutesShort(120)).toBe('2h');
  });

  it('formats hours and minutes', () => {
    expect(formatMinutesShort(90)).toBe('1h 30m');
  });
});
