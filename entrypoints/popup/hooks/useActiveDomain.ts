import { useState, useEffect, useRef } from 'react';

interface ActiveState {
  activeDomain: string | null;
  trackedUsage: Record<string, number>;
}

async function fetchActiveState(): Promise<ActiveState> {
  try {
    return await browser.runtime.sendMessage({ type: 'getActiveState' });
  } catch {
    return { activeDomain: null, trackedUsage: {} };
  }
}

export function useActiveDomain() {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [liveUsage, setLiveUsage] = useState<Record<string, number>>({});
  const domainsRef = useRef<string[]>([]);

  useEffect(() => {
    async function sync() {
      const state = await fetchActiveState();
      domainsRef.current = Object.keys(state.trackedUsage);
      setActiveDomain(state.activeDomain);
      setLiveUsage(state.trackedUsage);
    }

    sync();

    // Poll background every second for accurate timestamp-based values.
    // This replaces the old blind +1 increment which raced with storage syncs.
    const intervalId = setInterval(sync, 1000);

    // Immediate sync on storage changes (site added/removed, limit changed, etc.)
    const handleStorageChange = () => {
      sync();
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      clearInterval(intervalId);
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return { activeDomain, liveUsage };
}
