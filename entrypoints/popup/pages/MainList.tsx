import { useState, useCallback } from 'react';
import type { StorageSchema, SiteConfig, DailyUsage } from '@/shared/types';
import { getTodayUsage } from '@/shared/utils';
import { t } from '@/shared/i18n';

import { SiteRow } from '../components/site-row';
import { AddSiteBar } from '../components/AddSiteBar';
import { useActiveDomain } from '../hooks/useActiveDomain';
import { BottomSheet, AnimatedBackdrop } from '../components/BottomSheet';
import { ActionMenuSheet } from '../components/ActionMenuSheet';
import { ConfirmationSheet } from '../components/ConfirmationSheet';
import { BaseLimitSheet } from '../components/BaseLimitSheet';
import { ExtendCountdownSheet } from '../components/ExtendCountdownSheet';

interface MainListProps {
  storage: StorageSchema;
}

function getUsedSeconds(todayUsage: DailyUsage, domain: string): number {
  return todayUsage[domain]?.usedSeconds ?? 0;
}

export function MainList({ storage }: MainListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<SiteConfig | null>(null);
  const [blockTarget, setBlockTarget] = useState<SiteConfig | null>(null);
  const [baseLimitTarget, setBaseLimitTarget] = useState<SiteConfig | null>(
    null,
  );
  const [extendTarget, setExtendTarget] = useState<string | null>(null);
  const todayUsage = getTodayUsage(storage.usage);
  const { liveUsage } = useActiveDomain();

  const anySheetOpen =
    menuTarget !== null ||
    blockTarget !== null ||
    baseLimitTarget !== null ||
    extendTarget !== null;

  const handleToggleExpand = useCallback((siteId: string) => {
    setExpandedId((prev) => (prev === siteId ? null : siteId));
  }, []);

  const handleExtend = useCallback((siteId: string) => {
    setExtendTarget(siteId);
  }, []);

  async function handleExtendConfirm() {
    if (!extendTarget) return;
    try {
      await browser.runtime.sendMessage({
        type: 'updateSiteLimit',
        siteId: extendTarget,
        direction: 'extend',
      });
    } catch (err) {
      console.error('[SitesNuker] handleExtend failed:', err);
    }
    setExtendTarget(null);
  }

  const handleReduce = useCallback(async (siteId: string) => {
    try {
      await browser.runtime.sendMessage({
        type: 'updateSiteLimit',
        siteId,
        direction: 'reduce',
      });
    } catch (err) {
      console.error('[SitesNuker] handleReduce failed:', err);
    }
  }, []);

  const handleMenuRequest = useCallback(
    (siteId: string) => {
      const site = storage.sites.find((s) => s.id === siteId);
      if (site) setMenuTarget(site);
    },
    [storage.sites],
  );

  async function handleMenuDelete() {
    if (!menuTarget) return;
    try {
      await browser.runtime.sendMessage({
        type: 'deleteSite',
        siteId: menuTarget.id,
      });
      setMenuTarget(null);
      setExpandedId(null);
    } catch (err) {
      console.error('[SitesNuker] handleMenuDelete failed:', err);
    }
  }

  async function handleBaseLimitSave(newLimit: number) {
    if (!baseLimitTarget) return;
    try {
      await browser.runtime.sendMessage({
        type: 'updateBaseLimit',
        siteId: baseLimitTarget.id,
        baseLimitMinutes: newLimit,
      });
      setBaseLimitTarget(null);
    } catch (err) {
      console.error('[SitesNuker] handleBaseLimitSave failed:', err);
    }
  }

  async function handleBlockConfirm() {
    if (!blockTarget) return;
    try {
      await browser.runtime.sendMessage({
        type: 'hardBlockSite',
        domain: blockTarget.domain,
      });
      setBlockTarget(null);
      setExpandedId(null);
    } catch (err) {
      console.error('[SitesNuker] handleBlockConfirm failed:', err);
    }
  }

  async function handleAdd(domain: string, limitMinutes: number) {
    try {
      await browser.runtime.sendMessage({
        type: 'addSite',
        domain,
        limitMinutes,
      });
    } catch (err) {
      console.error('[SitesNuker] handleAdd failed:', err);
    }
  }

  function handleBackdropClose() {
    if (menuTarget) setMenuTarget(null);
    else if (blockTarget) setBlockTarget(null);
    else if (baseLimitTarget) setBaseLimitTarget(null);
    else if (extendTarget) setExtendTarget(null);
  }

  if (storage.sites.length === 0) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <p className="text-text-tertiary text-[0.875rem] text-center">
            {t('mainListEmpty')}
          </p>
        </div>
        <AddSiteBar existingDomains={[]} onAdd={handleAdd} />
      </>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-3">
        {storage.sites.map((site) => (
          <SiteRow
            key={site.id}
            site={site}
            usedSeconds={
              storage.isEnabled
                ? (liveUsage[site.domain] ??
                    getUsedSeconds(todayUsage, site.domain))
                : getUsedSeconds(todayUsage, site.domain)
            }
            isManuallyBlocked={!!todayUsage[site.domain]?.hardBlockedAt}
            isExpanded={expandedId === site.id}
            onToggleExpand={handleToggleExpand}
            onExtend={handleExtend}
            onReduce={handleReduce}
            onMenu={handleMenuRequest}
          />
        ))}
      </div>
      <AddSiteBar
        existingDomains={storage.sites.map((s) => s.domain)}
        onAdd={handleAdd}
      />

      {/* Shared backdrop — stays visible during sheet-to-sheet transitions */}
      <AnimatedBackdrop isVisible={anySheetOpen} onClick={handleBackdropClose} />

      {/* Action menu */}
      <BottomSheet
        isOpen={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
        hideBackdrop
      >
        {menuTarget && (
          <ActionMenuSheet
            key={menuTarget.id}
            domain={menuTarget.domain}
            baseLimitMinutes={menuTarget.baseLimitMinutes}
            onDelete={handleMenuDelete}
            onRequestBlock={() => {
              const site = menuTarget;
              setMenuTarget(null);
              setBlockTarget(site);
            }}
            onRequestBaseLimit={() => {
              const site = menuTarget;
              setMenuTarget(null);
              setBaseLimitTarget(site);
            }}
          />
        )}
      </BottomSheet>

      {/* Block confirmation */}
      <BottomSheet
        isOpen={blockTarget !== null}
        onClose={() => setBlockTarget(null)}
        hideBackdrop
      >
        {blockTarget && (
          <ConfirmationSheet
            title={t('blockNowConfirmTitle', blockTarget.domain)}
            description={t('blockNowConfirmDescription')}
            confirmLabel={t('blockNowConfirmBlock')}
            cancelLabel={t('blockNowConfirmCancel')}
            onConfirm={handleBlockConfirm}
            onCancel={() => setBlockTarget(null)}
          />
        )}
      </BottomSheet>

      {/* Base limit */}
      <BottomSheet
        isOpen={baseLimitTarget !== null}
        onClose={() => setBaseLimitTarget(null)}
        hideBackdrop
      >
        {baseLimitTarget && (
          <BaseLimitSheet
            key={baseLimitTarget.id}
            baseLimitMinutes={baseLimitTarget.baseLimitMinutes}
            onSave={handleBaseLimitSave}
            onCancel={() => setBaseLimitTarget(null)}
          />
        )}
      </BottomSheet>

      {/* Extend countdown */}
      <BottomSheet
        isOpen={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        hideBackdrop
      >
        <ExtendCountdownSheet
          onConfirm={handleExtendConfirm}
          onCancel={() => setExtendTarget(null)}
        />
      </BottomSheet>
    </>
  );
}
