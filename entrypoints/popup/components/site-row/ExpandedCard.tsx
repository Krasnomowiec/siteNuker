import { useState, useRef, useEffect } from 'react';
import type { SiteConfig } from '@/shared/types';
import {
  LIMIT_MIN,
  LIMIT_STEP,
  HARD_CAP_SECONDS,
} from '@/shared/constants';
import { formatTimeCompact } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { SiteFavicon } from '../SiteFavicon';
import { Slider } from '../Slider';
import { ChevronIcon, TrashIcon } from '../icons';
import { HoldToSaveButton } from './HoldToSaveButton';

interface ExpandedCardProps {
  site: SiteConfig;
  usedSeconds: number;
  onCollapse: () => void;
  onSave: (newLimit: number) => void;
  onDelete: () => void;
  isSoftLocked?: boolean;
}

export function ExpandedCard({
  site,
  usedSeconds,
  onCollapse,
  onSave,
  onDelete,
  isSoftLocked = false,
}: ExpandedCardProps) {
  const usedMinutes = usedSeconds / 60;
  const sliderFloor = Math.max(
    LIMIT_MIN,
    Math.floor(usedMinutes / LIMIT_STEP) * LIMIT_STEP,
  );
  const usedPercent = (usedSeconds / HARD_CAP_SECONDS) * 100;

  const initialValue = isSoftLocked
    ? Math.min(
        Math.max(site.dailyLimitMinutes, sliderFloor + LIMIT_STEP),
        HARD_CAP_SECONDS / 60,
      )
    : site.dailyLimitMinutes;

  const [sliderValue, setSliderValue] = useState(initialValue);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasChanged = sliderValue !== site.dailyLimitMinutes;

  useEffect(() => {
    requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const remaining = site.dailyLimitMinutes * 60 - usedSeconds;
  const isExceeded = remaining <= 0;

  return (
    <div
      ref={cardRef}
      className="bg-bg-tertiary rounded-sm overflow-hidden transition-all duration-200 scroll-mb-5"
    >
      {/* Top row — same as collapsed */}
      <button
        type="button"
        onClick={onCollapse}
        className={`w-full p-4 flex items-center gap-3 ${isSoftLocked ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <SiteFavicon domain={site.domain} />
        <span className="font-headline font-bold text-text-primary truncate flex-1 min-w-0 text-left">
          {site.domain}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {isSoftLocked ? (
            <span className="text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 text-accent-amber bg-accent-amber/15">
              {t('siteRowSoftBlocked')}
            </span>
          ) : (
            <span
              className={`text-xs font-bold whitespace-nowrap rounded-sm px-2.5 py-1 ${isExceeded ? 'text-accent-red bg-accent-red/15' : 'text-accent-red-soft bg-accent-red-soft/15'}`}
            >
              {formatTimeCompact(Math.max(0, remaining))}
            </span>
          )}
          {!isSoftLocked && (
            <ChevronIcon
              size={22}
              className="text-accent-red rotate-180 shrink-0"
            />
          )}
        </div>
      </button>

      {/* Bottom — limit controls */}
      <div className="px-4 pb-4 space-y-4">
        {isSoftLocked && (
          <p className="text-xs text-text-tertiary">
            {t('siteRowIncreaseLimit')}
          </p>
        )}

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary shrink-0">
            {t('siteRowDailyLimit')}
          </span>
          <Slider
            value={sliderValue}
            onChange={setSliderValue}
            usedPercent={usedPercent}
            minValue={sliderFloor}
          />
          <span className="text-xs text-text-tertiary shrink-0 min-w-10 text-right">
            {sliderValue} {t('unitMin')}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onDelete}
            className="w-10 h-10 flex items-center justify-center bg-error-bg/20 text-error rounded-sm hover:bg-error-bg/40 transition-colors"
          >
            <TrashIcon size={18} />
          </button>

          <HoldToSaveButton
            onSave={() => onSave(sliderValue)}
            disabled={!hasChanged}
          />
        </div>
      </div>
    </div>
  );
}
