import { useState, useEffect, useRef } from 'react';
import {
  DOMAIN_ALIASES,
  DEFAULT_LIMIT_MINUTES,
  MAX_SITES,
} from '@/shared/constants';
import { extractDomain } from '@/shared/utils';
import { t } from '@/shared/i18n';
import { AlertCircleIcon } from './icons';

interface AddSiteBarProps {
  existingDomains: string[];
  onAdd: (domain: string, limitMinutes: number) => void;
}

export function AddSiteBar({ existingDomains, onAdd }: AddSiteBarProps) {
  const [domain, setDomain] = useState('');
  const [showError, setShowError] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url) {
        try {
          let host = new URL(tab.url).hostname.replace(/^www\./, '');
          host = DOMAIN_ALIASES[host] ?? host;
          if (!existingDomains.includes(host)) {
            setDomain(host);
          }
        } catch {
          /* ignore about:, chrome:, moz-extension: URLs */
        }
      }
      initializedRef.current = true;
    });
  }, [existingDomains]);

  const trimmed = domain.trim();
  const extracted =
    trimmed.length > 0 ? extractDomain(trimmed, DOMAIN_ALIASES) : null;
  const isInvalid = trimmed.length > 0 && extracted === null;
  const isDuplicate = extracted !== null && existingDomains.includes(extracted);
  const isAtLimit = existingDomains.length >= MAX_SITES;
  const canAdd = extracted !== null && !isDuplicate && !isAtLimit;

  function handleAdd() {
    if (!canAdd || !extracted) {
      setShowError(true);
      return;
    }
    onAdd(extracted, DEFAULT_LIMIT_MINUTES);
    setDomain('');
    setShowError(false);
  }

  return (
    <div className="bg-bg-tertiary p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.4)] shrink-0">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setShowError(false);
          }}
          placeholder={t('addSitePlaceholder')}
          className="flex-1 h-[42px] bg-bg-primary text-text-primary font-headline text-[0.875rem] rounded-sm px-3 placeholder:text-text-tertiary/50 outline-none border-none text-left"
        />
        <button
          type="button"
          disabled={trimmed.length === 0}
          onClick={handleAdd}
          className={`
            h-[42px] w-[42px] rounded-sm grid place-items-center transition-colors
            ${
              trimmed.length > 0
                ? 'sn-gradient-cta text-[#690005] cursor-pointer active:scale-[0.97]'
                : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
            }
          `}
        >
          <span className="text-xl font-bold translate-y-[-2px]">+</span>
        </button>
      </div>

      {showError && isInvalid && (
        <p className="flex items-center gap-1 text-[11px] text-error mt-1.5">
          <AlertCircleIcon size={12} />
          {t('addSiteErrorInvalid')}
        </p>
      )}
      {showError && isDuplicate && (
        <p className="flex items-center gap-1 text-[11px] text-accent-amber mt-1.5">
          <AlertCircleIcon size={12} />
          {t('addSiteErrorDuplicate')}
        </p>
      )}
      {isAtLimit && (
        <p className="flex items-center gap-1 text-[11px] text-text-tertiary mt-1.5">
          <AlertCircleIcon size={12} />
          {t('addSiteErrorAtLimit', String(MAX_SITES))}
        </p>
      )}
    </div>
  );
}
