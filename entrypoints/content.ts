export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let overlayElement: HTMLDivElement | null = null;

    function pauseAllMedia(): void {
      document
        .querySelectorAll<HTMLMediaElement>('video, audio')
        .forEach((el) => {
          try {
            if (!el.paused) el.pause();
          } catch {
            // Some media elements may reject pause() due to restrictions
          }
        });
    }

    function showOverlay(): void {
      // Restore visibility if it was hidden during early block check
      document.documentElement.style.removeProperty('visibility');

      if (overlayElement) return;

      pauseAllMedia();

      overlayElement = document.createElement('div');
      overlayElement.id = 'sitesnuker-block-overlay';
      Object.assign(overlayElement.style, {
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
      });

      const brand = document.createElement('div');
      Object.assign(brand.style, {
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        fontSize: '13px',
        fontWeight: '700',
        color: '#fe554a',
        letterSpacing: '0.1em',
        fontStyle: 'italic',
        marginBottom: '4px',
      });
      brand.textContent = 'SitesNuker';

      const title = document.createElement('div');
      Object.assign(title.style, {
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        fontSize: '38px',
        fontWeight: '700',
        color: '#ffb874',
        letterSpacing: '-0.5px',
        textTransform: 'uppercase',
      });
      title.textContent = browser.i18n.getMessage('blockedTitle') || 'That\u2019s it';

      const message = document.createElement('div');
      Object.assign(message.style, {
        fontSize: '16px',
        color: '#aa8985',
        textAlign: 'center',
        maxWidth: '300px',
        lineHeight: '1.5',
        fontStyle: 'italic',
        marginTop: '8px',
      });
      message.textContent = browser.i18n.getMessage('blockedQuote') || '\u201cLife is somewhere else.\u201d';

      overlayElement.append(brand, title, message);
      // Prevent scrolling behind overlay
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.appendChild(overlayElement);
    }

    function removeOverlay(): void {
      if (overlayElement) {
        overlayElement.remove();
        overlayElement = null;
        document.documentElement.style.removeProperty('overflow');
      }
    }

    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === 'showBlockOverlay') {
        showOverlay();
      }
      if (message?.type === 'removeBlockOverlay') {
        removeOverlay();
      }
    });

    // Immediate check at document_start — hide page before render if blocked
    browser.runtime
      .sendMessage({ type: 'isCurrentSiteBlocked' })
      .then((response) => {
        if (response?.blocked) {
          // Record this as a blocked visit attempt for stats
          browser.runtime
            .sendMessage({ type: 'recordBlockedAttempt' })
            .catch(() => {});

          document.documentElement.style.visibility = 'hidden';
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => showOverlay(), {
              once: true,
            });
          } else {
            showOverlay();
          }
        }
      })
      .catch(() => {});
  },
});
