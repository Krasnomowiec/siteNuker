import { useState, useEffect } from 'react';
import type { StorageSchema } from '@/shared/types';
import { readStorage, writeStorage } from '@/shared/storage';

export function useStorage() {
  const [storage, setStorage] = useState<StorageSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readStorage()
      .then((data) => {
        setStorage(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const handleChange = () => {
      readStorage().then(setStorage).catch(() => {});
    };

    browser.storage.onChanged.addListener(handleChange);
    return () => browser.storage.onChanged.removeListener(handleChange);
  }, []);

  async function setEnabled(isEnabled: boolean): Promise<void> {
    await writeStorage({ isEnabled });
  }

  return { storage, loading, setEnabled };
}
