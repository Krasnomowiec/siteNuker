import { vi } from 'vitest';

// Mock browser.i18n for test environment
const globalAny = globalThis as Record<string, unknown>;
globalAny.browser = {
  i18n: {
    getMessage: vi.fn((key: string) => key),
  },
};
