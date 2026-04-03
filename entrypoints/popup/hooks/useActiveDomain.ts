import { useState, useEffect, useRef } from 'react';

interface ActiveState {
  activeDomain: string | null;
  usedSeconds: number;
}

async function fetchActiveState(): Promise<ActiveState> {
  try {
    return await browser.runtime.sendMessage({ type: 'getActiveState' });
  } catch {
    return { activeDomain: null, usedSeconds: 0 };
  }
}

export function useActiveDomain() {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [liveUsedSeconds, setLiveUsedSeconds] = useState(0);
  const domainRef = useRef<string | null>(null);

  useEffect(() => {
    async function sync() {
      const state = await fetchActiveState();
      domainRef.current = state.activeDomain;
      setActiveDomain(state.activeDomain);
      setLiveUsedSeconds(state.usedSeconds);
    }

    sync();

    const intervalId = setInterval(() => {
      if (domainRef.current) {
        setLiveUsedSeconds((prev) => prev + 1);
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

  return { activeDomain, liveUsedSeconds };
}
