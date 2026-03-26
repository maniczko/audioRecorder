import { shouldEnableServiceWorker } from './runtime/browserRuntime';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (!shouldEnableServiceWorker(window.location.hostname)) {
    return;
  }

  window.addEventListener('load', () => {
    let hasReloadedForUpdate = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloadedForUpdate) return;
      hasReloadedForUpdate = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/service-worker.js', { updateViaCache: 'none' })
      .then((registration) => {
        const promoteWaitingWorker = (worker) => {
          if (worker?.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          promoteWaitingWorker(registration.installing);
          registration.installing?.addEventListener('statechange', () => {
            promoteWaitingWorker(registration.installing);
          });
        });

        // Silent fail for service worker update - expected in dev mode
        registration.update().catch(() => {
          // Silent fail - service worker not available in all environments
        });
      })
      .catch(() => {
        // Silent fail - service worker not available in all environments
      });
  });
}
