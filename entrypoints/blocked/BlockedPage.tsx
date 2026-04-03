import { t } from '@/shared/i18n';

export default function BlockedPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        background: '#131317',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#e4e1e7',
      }}
    >
      <div
        style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: '13px',
          fontWeight: '700',
          color: '#fe554a',
          letterSpacing: '0.1em',
          fontStyle: 'italic',
          marginBottom: '4px',
        }}
      >
        SitesNuker
      </div>

      <div
        style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: '38px',
          fontWeight: '700',
          color: '#ffb874',
          letterSpacing: '-0.5px',
          textTransform: 'uppercase' as const,
        }}
      >
        {t('blockedTitle')}
      </div>

      <div
        style={{
          fontSize: '16px',
          color: '#aa8985',
          textAlign: 'center' as const,
          maxWidth: '300px',
          lineHeight: '1.5',
          fontStyle: 'italic',
          marginTop: '8px',
        }}
      >
        {t('blockedQuote')}
      </div>
    </div>
  );
}
