import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock browser.i18n for test environment
const globalAny = globalThis as Record<string, unknown>;

const storageMock = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

globalAny.browser = {
  i18n: {
    getMessage: vi.fn((key: string) => key),
  },
  storage: storageMock,
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({}),
    sendMessage: vi.fn().mockResolvedValue({}),
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({ activeDomain: null, trackedUsage: {} }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    getURL: vi.fn((path: string) => `moz-extension://test${path}`),
  },
  declarativeNetRequest: {
    updateDynamicRules: vi.fn().mockResolvedValue(undefined),
    getDynamicRules: vi.fn().mockResolvedValue([]),
  },
};
