import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StorageSchema } from '@/shared/types';

// Mock storage module
vi.mock('@/shared/storage', () => ({
  readStorage: vi.fn(),
}));

// Mock useActiveDomain hook (used by MainList)
vi.mock('../hooks/useActiveDomain', () => ({
  useActiveDomain: () => ({ activeDomain: null, liveUsage: {} }),
}));

import { readStorage } from '@/shared/storage';
import App from '../App';

const mockSendMessage = vi.fn().mockResolvedValue({ ok: true });
// Patch the WXT-provided browser global with our mock
const _browser = browser as typeof browser & { runtime: { sendMessage: typeof mockSendMessage } };
_browser.runtime.sendMessage = mockSendMessage;

function makeStorage(overrides: Partial<StorageSchema> = {}): StorageSchema {
  return {
    version: 1,
    isEnabled: true,
    nuclearMode: null,
    sites: [],
    usage: {},
    history: {},
    ...overrides,
  };
}

function makeSite(domain: string = 'youtube.com') {
  return {
    id: crypto.randomUUID(),
    domain,
    dailyLimitMinutes: 10,
    initialLimitMinutes: 10,
    isPreset: true,
    addedAt: new Date().toISOString(),
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ ok: true });
  });

  it('shows loading state initially', () => {
    vi.mocked(readStorage).mockReturnValue(new Promise(() => {})); // never resolves
    render(<App />);
    // loading spinner should be rendered (pulsing div)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders header on main page after loading', async () => {
    const storage = makeStorage({ sites: [makeSite()] });
    vi.mocked(readStorage).mockResolvedValue(storage);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('SitesNuker')).toBeInTheDocument();
  });

  describe('disable toggle — empty sites list', () => {
    it('disables immediately without showing confirmation bottom-sheet', async () => {
      const user = userEvent.setup();
      const storage = makeStorage({ isEnabled: true, sites: [] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      // Toggle is ON
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');

      // Click toggle — should disable without confirmation
      await user.click(toggle);

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'setEnabled', isEnabled: false });
      // Confirmation sheet should NOT appear
      expect(screen.queryByText('disableConfirmTitle')).not.toBeInTheDocument();
    });
  });

  describe('disable toggle — sites present', () => {
    it('shows confirmation bottom-sheet when sites exist', async () => {
      const user = userEvent.setup();
      const storage = makeStorage({ isEnabled: true, sites: [makeSite()] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      const toggle = screen.getByRole('switch');
      await user.click(toggle);

      // Confirmation sheet should appear
      expect(screen.getByText('disableConfirmTitle')).toBeInTheDocument();
      expect(screen.getByText('disableConfirmDescription')).toBeInTheDocument();

      // sendMessage should NOT have been called yet
      expect(mockSendMessage).not.toHaveBeenCalledWith({ type: 'setEnabled', isEnabled: false });
    });

    it('disables after confirming in bottom-sheet', async () => {
      const user = userEvent.setup();
      const storage = makeStorage({ isEnabled: true, sites: [makeSite()] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      // Open confirmation
      await user.click(screen.getByRole('switch'));
      expect(screen.getByText('disableConfirmTitle')).toBeInTheDocument();

      // Confirm disable
      await user.click(screen.getByText('disableConfirmOff'));
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'setEnabled', isEnabled: false });
    });

    it('keeps enabled when canceling confirmation', async () => {
      const user = userEvent.setup();
      const storage = makeStorage({ isEnabled: true, sites: [makeSite()] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByText('disableConfirmKeep'));

      expect(mockSendMessage).not.toHaveBeenCalledWith({ type: 'setEnabled', isEnabled: false });
    });
  });

  describe('enable toggle', () => {
    it('enables immediately without confirmation', async () => {
      const user = userEvent.setup();
      const storage = makeStorage({ isEnabled: false, sites: [makeSite()] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      await user.click(toggle);
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'setEnabled', isEnabled: true });
    });
  });

  describe('nuclear mode', () => {
    it('shows countdown when nuclear mode is active', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const storage = makeStorage({
        nuclearMode: {
          activatedAt: new Date().toISOString(),
          durationMinutes: 60,
          expiresAt: future,
        },
      });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      // NuclearCountdown should be rendered — it uses the nuclearCountdownTitle key
      expect(screen.getByText('nuclearCountdownTitle')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty list message when no sites', async () => {
      const storage = makeStorage({ sites: [] });
      vi.mocked(readStorage).mockResolvedValue(storage);

      await act(async () => {
        render(<App />);
      });

      expect(screen.getByText('mainListEmpty')).toBeInTheDocument();
    });
  });
});
