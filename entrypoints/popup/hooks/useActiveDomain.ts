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

    const intervalId = setInterval(() => {
      if (domainsRef.current.length > 0) {
        setLiveUsage((prev) => {
          const next: Record<string, number> = {};
          for (const domain of domainsRef.current) {
            next[domain] = (prev[domain] ?? 0) + 1;
          }
          return next;
        });
      }
    }, 1000);

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
