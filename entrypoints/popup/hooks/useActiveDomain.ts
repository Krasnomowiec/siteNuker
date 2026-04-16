import { useState, useEffect } from 'react';

interface ActiveState {
  activeDomain: string | null;
  trackedUsage: Record<string, number>;
}

async function fetchActiveState(): Promise<ActiveState> {
  try {
    return await browser.runtime.sendMessage({ type: 'getActiveState' });
  } catch (err) {
    console.error('[SitesNuker] fetchActiveState failed:', err);
    return { activeDomain: null, trackedUsage: {} };
  }
}

export function useActiveDomain() {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [liveUsage, setLiveUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    async function sync() {
      const state = await fetchActiveState();
      setActiveDomain(state.activeDomain);
      setLiveUsage(state.trackedUsage);
    }

    sync();

    // Poll background every second for accurate timestamp-based values.
    // This replaces the old blind +1 increment which raced with storage syncs.
    const intervalId = setInterval(sync, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return { activeDomain, liveUsage };
}
