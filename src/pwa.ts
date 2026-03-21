function isEphemeralVercelPreviewHost(hostname: string) {
  return /\.vercel\.app$/i.test(String(hostname || ""));
}

async function unregisterPreviewServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations?.();
  await Promise.all((registrations || []).map((registration) => registration.unregister?.()));

  if (!("caches" in window)) return;

  const cacheKeys = await window.caches.keys();
  await Promise.all(cacheKeys.filter((key) => key.startsWith("voicelog-os-")).map((key) => window.caches.delete(key)));
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    if (isEphemeralVercelPreviewHost(window.location.hostname)) {
      unregisterPreviewServiceWorkers().catch((error) => {
        console.error("Preview service worker cleanup failed.", error);
      });
      return;
    }

    let hasReloadedForUpdate = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloadedForUpdate) return;
      hasReloadedForUpdate = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        const promoteWaitingWorker = (worker) => {
          if (worker?.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        };

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
          promoteWaitingWorker(registration.installing);
          registration.installing?.addEventListener("statechange", () => {
            promoteWaitingWorker(registration.installing);
          });
        });

        registration.update().catch((error) => {
          console.error("Service worker update check failed.", error);
        });
      })
      .catch((error) => {
        console.error("Service worker registration failed.", error);
      });
  });
}
