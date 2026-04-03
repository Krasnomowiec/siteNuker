import { useState } from 'react';
import type { StorageSchema, SiteConfig, DailyUsage } from '@/shared/types';
import { writeStorage } from '@/shared/storage';
import { getTodayKey, getTodayUsage } from '@/shared/utils';
import { t } from '@/shared/i18n';

import { SiteRow } from '../components/site-row';
import { AddSiteBar } from '../components/AddSiteBar';
import { useActiveDomain } from '../hooks/useActiveDomain';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmationSheet } from '../components/ConfirmationSheet';

interface MainListProps {
  storage: StorageSchema;
}

function getUsedSeconds(todayUsage: DailyUsage, domain: string): number {
  return todayUsage[domain]?.usedSeconds ?? 0;
}

export function MainList({ storage }: MainListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteConfig | null>(null);
  const todayUsage = getTodayUsage(storage.usage);
  const { liveUsage } = useActiveDomain();

  async function handleSave(siteId: string, newLimit: number) {
    const site = storage.sites.find((s) => s.id === siteId);
    if (!site) return;

    const updatedSites: SiteConfig[] = storage.sites.map((s) =>
      s.id === siteId ? { ...s, dailyLimitMinutes: newLimit } : s,
    );

    const todayKey = getTodayKey();
    const existingDay = storage.usage[todayKey] ?? {};
    const existingDomain = existingDay[site.domain] ?? {
      usedSeconds: 0,
      blockedAttempts: 0,
      limitChanges: [],
    };

    const updatedUsage = {
      ...storage.usage,
      [todayKey]: {
        ...existingDay,
        [site.domain]: {
          ...existingDomain,
          limitChanges: [
            ...existingDomain.limitChanges,
            {
              timestamp: new Date().toISOString(),
              from: site.dailyLimitMinutes,
              to: newLimit,
            },
          ],
        },
      },
    };

    await writeStorage({ sites: updatedSites, usage: updatedUsage });
  }

  function handleDeleteRequest(siteId: string) {
    const site = storage.sites.find((s) => s.id === siteId);
    if (site) setDeleteTarget(site);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const updatedSites = storage.sites.filter(
      (site) => site.id !== deleteTarget.id,
    );
    await writeStorage({ sites: updatedSites });
    setDeleteTarget(null);
    setExpandedId(null);
  }

  async function handleAdd(domain: string, limitMinutes: number) {
    const newSite: SiteConfig = {
      id: crypto.randomUUID(),
      domain,
      dailyLimitMinutes: limitMinutes,
      initialLimitMinutes: limitMinutes,
      isPreset: false,
      addedAt: new Date().toISOString(),
    };
    await writeStorage({ sites: [newSite, ...storage.sites] });
  }

  if (storage.sites.length === 0) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <p className="text-text-tertiary text-body text-center">
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
                ? (liveUsage[site.domain] ?? getUsedSeconds(todayUsage, site.domain))
                : getUsedSeconds(todayUsage, site.domain)
            }
            isExpanded={expandedId === site.id}
            onToggleExpand={() =>
              setExpandedId(expandedId === site.id ? null : site.id)
            }
            onSave={handleSave}
            onDelete={handleDeleteRequest}
          />
        ))}
      </div>
      <AddSiteBar
        existingDomains={storage.sites.map((s) => s.domain)}
        onAdd={handleAdd}
      />

      <BottomSheet
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <ConfirmationSheet
            title={t('deleteConfirmTitle', deleteTarget.domain)}
            description={t('deleteConfirmDescription')}
            confirmLabel={t('deleteConfirmRemove')}
            cancelLabel={t('deleteConfirmKeep')}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </BottomSheet>
    </>
  );
}
