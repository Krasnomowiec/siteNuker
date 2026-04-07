import { useState, useCallback } from 'react';
import type { StorageSchema, SiteConfig, DailyUsage } from '@/shared/types';
import { getTodayUsage } from '@/shared/utils';
import { t } from '@/shared/i18n';

import { SiteRow } from '../components/site-row';
import { AddSiteBar } from '../components/AddSiteBar';
import { useActiveDomain } from '../hooks/useActiveDomain';
import { BottomSheet } from '../components/BottomSheet';
import { ActionMenuSheet } from '../components/ActionMenuSheet';

interface MainListProps {
  storage: StorageSchema;
}

function getUsedSeconds(todayUsage: DailyUsage, domain: string): number {
  return todayUsage[domain]?.usedSeconds ?? 0;
}

export function MainList({ storage }: MainListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<SiteConfig | null>(null);
  const todayUsage = getTodayUsage(storage.usage);
  const { liveUsage } = useActiveDomain();

  const handleToggleExpand = useCallback((siteId: string) => {
    setExpandedId((prev) => (prev === siteId ? null : siteId));
  }, []);

  async function handleExtend(siteId: string) {
    try {
      await browser.runtime.sendMessage({
        type: 'updateSiteLimit',
        siteId,
        direction: 'extend',
      });
    } catch (err) {
      console.error('[SitesNuker] handleExtend failed:', err);
    }
  }

  async function handleReduce(siteId: string) {
    try {
      await browser.runtime.sendMessage({
        type: 'updateSiteLimit',
        siteId,
        direction: 'reduce',
      });
    } catch (err) {
      console.error('[SitesNuker] handleReduce failed:', err);
    }
  }

  function handleMenuRequest(siteId: string) {
    const site = storage.sites.find((s) => s.id === siteId);
    if (site) setMenuTarget(site);
  }

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

  async function handleMenuBlockConfirm() {
    if (!menuTarget) return;
    try {
      await browser.runtime.sendMessage({
        type: 'hardBlockSite',
        domain: menuTarget.domain,
      });
      setMenuTarget(null);
      setExpandedId(null);
    } catch (err) {
      console.error('[SitesNuker] handleMenuBlockConfirm failed:', err);
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

      {/* Action menu (transforms into block confirmation in-place) */}
      <BottomSheet
        isOpen={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
      >
        {menuTarget && (
          <ActionMenuSheet
            key={menuTarget.id}
            domain={menuTarget.domain}
            onDelete={handleMenuDelete}
            onBlockConfirm={handleMenuBlockConfirm}
          />
        )}
      </BottomSheet>
    </>
  );
}
