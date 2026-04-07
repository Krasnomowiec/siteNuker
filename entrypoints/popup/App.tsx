import { useState, useMemo, useCallback } from 'react';
import { POPUP_WIDTH, POPUP_MAX_HEIGHT } from '@/shared/constants';
import { t } from '@/shared/i18n';
import { useStorage } from './hooks/useStorage';
import { Header } from './components/Header';
import type { Page } from './components/Header';
import { MainList } from './pages/MainList';
import { NuclearSetup } from './pages/NuclearSetup';
import { NuclearCountdown } from './pages/NuclearCountdown';
import { Statistics } from './pages/Statistics';
import { BottomSheet } from './components/BottomSheet';
import { ConfirmationSheet } from './components/ConfirmationSheet';

function isNuclearActive(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export default function App() {
  const { storage, loading, setEnabled } = useStorage();
  const [page, setPage] = useState<Page>('main');
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [nuclearDismissed, setNuclearDismissed] = useState(false);

  const nuclearActive = useMemo(
    () => !nuclearDismissed && isNuclearActive(storage?.nuclearMode?.expiresAt),
    [storage?.nuclearMode?.expiresAt, nuclearDismissed],
  );

  const handleNuclearComplete = useCallback(async () => {
    setNuclearDismissed(true);
    try {
      await browser.runtime.sendMessage({ type: 'clearNuclearMode' });
    } catch (err) {
      console.error('[SitesNuker] handleNuclearComplete failed:', err);
    }
  }, []);

  if (loading || !storage) {
    return (
      <div
        className="bg-bg-primary flex items-center justify-center"
        style={{ width: POPUP_WIDTH, height: POPUP_MAX_HEIGHT }}
      >
        <div className="w-6 h-6 sn-gradient-cta rounded-sm animate-pulse" />
      </div>
    );
  }

  async function handleNuclearActivate(durationMinutes: number) {
    setNuclearDismissed(false);
    try {
      await browser.runtime.sendMessage({
        type: 'activateNuclear',
        durationMinutes,
      });
    } catch (err) {
      console.error('[SitesNuker] handleNuclearActivate failed:', err);
    }
    setPage('main');
  }

  if (nuclearActive && storage.nuclearMode) {
    return (
      <div
        className="bg-bg-primary text-text-primary font-sans flex flex-col animate-popup-enter"
        style={{ width: POPUP_WIDTH, height: POPUP_MAX_HEIGHT }}
      >
        <NuclearCountdown
          nuclearMode={storage.nuclearMode}
          onComplete={handleNuclearComplete}
        />
      </div>
    );
  }

  return (
    <div
      className="bg-bg-primary text-text-primary font-sans flex flex-col relative animate-popup-enter"
      style={{ width: POPUP_WIDTH, height: POPUP_MAX_HEIGHT }}
    >
      {page !== 'nuclear' && page !== 'statistics' && (
        <Header
          isEnabled={storage.isEnabled}
          onToggle={() => {
            if (storage.isEnabled) {
              if (storage.sites.length > 0) {
                setShowDisableConfirm(true);
              } else {
                setEnabled(false);
              }
            } else {
              setEnabled(true);
            }
          }}
          onNavigate={setPage}
          currentPage={page}
        />
      )}

      {page === 'main' && <MainList storage={storage} />}

      {page === 'statistics' && (
        <Statistics storage={storage} onBack={() => setPage('main')} />
      )}

      {page === 'nuclear' && (
        <NuclearSetup
          onBack={() => setPage('main')}
          onActivate={handleNuclearActivate}
          hasSites={storage.sites.length > 0}
        />
      )}

      <BottomSheet
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
      >
        <ConfirmationSheet
          title={t('disableConfirmTitle')}
          description={t('disableConfirmDescription')}
          confirmLabel={t('disableConfirmOff')}
          cancelLabel={t('disableConfirmKeep')}
          onConfirm={() => {
            setEnabled(false);
            setShowDisableConfirm(false);
          }}
          onCancel={() => setShowDisableConfirm(false)}
        />
      </BottomSheet>
    </div>
  );
}
