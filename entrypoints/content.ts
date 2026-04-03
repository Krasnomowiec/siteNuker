import { BLOCKED_STYLES } from '@/shared/blockedPageTheme';

export default defineContentScript({
  // Runs on all URLs intentionally. The script is idle on untracked sites
  // (just message listeners + one lightweight isCurrentSiteBlocked check).
  // Dynamic registration was considered but rejected: re-registering patterns
  // on every site-list change adds complexity with no meaningful perf benefit.
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let overlayElement: HTMLDivElement | null = null;
    let mediaObserver: MutationObserver | null = null;

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

    /** Watch for dynamically added media elements and pause them */
    function startMediaObserver(): void {
      if (mediaObserver) return;
      mediaObserver = new MutationObserver(() => pauseAllMedia());
      mediaObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    function stopMediaObserver(): void {
      mediaObserver?.disconnect();
      mediaObserver = null;
    }

    function showOverlay(): void {
      // Restore visibility if it was hidden during early block check
      document.documentElement.style.removeProperty('visibility');

      if (overlayElement) return;

      pauseAllMedia();

      overlayElement = document.createElement('div');
      overlayElement.id = 'sitesnuker-block-overlay';
      Object.assign(overlayElement.style, BLOCKED_STYLES.container);

      const brand = document.createElement('div');
      Object.assign(brand.style, BLOCKED_STYLES.brand);
      brand.textContent = 'SitesNuker';

      const title = document.createElement('div');
      Object.assign(title.style, BLOCKED_STYLES.title);
      title.textContent = browser.i18n.getMessage('blockedTitle') || 'That\u2019s it';

      const message = document.createElement('div');
      Object.assign(message.style, BLOCKED_STYLES.message);
      message.textContent = browser.i18n.getMessage('blockedQuote') || '\u201cLife is somewhere else.\u201d';

      overlayElement.append(brand, title, message);
      // Prevent scrolling behind overlay
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.appendChild(overlayElement);
      startMediaObserver();
    }

    function removeOverlay(): void {
      stopMediaObserver();
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
