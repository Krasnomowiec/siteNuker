import { useState, useEffect } from 'react';
import type { StorageSchema } from '@/shared/types';
import { readStorage } from '@/shared/storage';

export function useStorage() {
  const [storage, setStorage] = useState<StorageSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readStorage()
      .then((data) => {
        setStorage(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[SitesNuker] useStorage init failed:', err);
        setLoading(false);
      });

    const handleChange = () => {
      readStorage()
        .then(setStorage)
        .catch((err) => {
          console.error('[SitesNuker] useStorage sync failed:', err);
        });
    };

    browser.storage.onChanged.addListener(handleChange);
    return () => browser.storage.onChanged.removeListener(handleChange);
  }, []);

  async function setEnabled(isEnabled: boolean): Promise<void> {
    try {
      await browser.runtime.sendMessage({ type: 'setEnabled', isEnabled });
    } catch (err) {
      console.error('[SitesNuker] setEnabled failed:', err);
    }
  }

  return { storage, loading, setEnabled };
}
