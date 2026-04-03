/**
 * Shared design tokens for the blocked-page overlay.
 * Used by both the content-script overlay (vanilla DOM, Object.assign)
 * and the React BlockedPage component (style={}).
 */

export const BLOCKED_STYLES = {
  container: {
    position: 'fixed' as const,
    inset: '0',
    zIndex: '2147483647',
    background: '#131317',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '16px',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#e4e1e7',
  },
  brand: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: '13px',
    fontWeight: '700',
    color: '#fe554a',
    letterSpacing: '0.1em',
    fontStyle: 'italic' as const,
    marginBottom: '4px',
  },
  title: {
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    fontSize: '38px',
    fontWeight: '700',
    color: '#ffb874',
    letterSpacing: '-0.5px',
    textTransform: 'uppercase' as const,
  },
  message: {
    fontSize: '16px',
    color: '#aa8985',
    textAlign: 'center' as const,
    maxWidth: '300px',
    lineHeight: '1.5',
    fontStyle: 'italic' as const,
    marginTop: '8px',
  },
} as const;
