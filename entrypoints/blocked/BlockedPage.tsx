import { t } from '@/shared/i18n';
import { BLOCKED_STYLES } from '@/shared/blockedPageTheme';

export default function BlockedPage() {
  return (
    <div style={BLOCKED_STYLES.container}>
      <div style={BLOCKED_STYLES.brand}>SitesNuker</div>
      <div style={BLOCKED_STYLES.title}>{t('blockedTitle')}</div>
      <div style={BLOCKED_STYLES.message}>{t('blockedQuote')}</div>
    </div>
  );
}
