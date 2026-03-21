const PREVIEW_CLEANUP_KEY = "voicelog.preview-runtime-cleanup.v1";

function isLocalhost(hostname: string) {
  return /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || ""));
}

export function isHostedPreviewHost(hostname: string) {
  return /\.vercel\.app$/i.test(String(hostname || ""));
}

export function shouldEnableServiceWorker(hostname: string) {
  return isLocalhost(hostname);
}

export async function prepareHostedRuntime({
  hostname = window.location.hostname,
  sessionStorageRef = window.sessionStorage,
  serviceWorkerRef = navigator.serviceWorker,
  cachesRef = window.caches,
  reload = () => window.location.reload(),
}: {
  hostname?: string;
  sessionStorageRef?: Storage;
  serviceWorkerRef?: ServiceWorkerContainer;
  cachesRef?: CacheStorage;
  reload?: () => void;
} = {}) {
  if (!isHostedPreviewHost(hostname) || !serviceWorkerRef) {
    return { cleaned: false, reloaded: false };
  }

  const registrations = (await serviceWorkerRef.getRegistrations?.()) || [];
  await Promise.all(registrations.map((registration) => registration.unregister?.()));

  if (cachesRef) {
    const cacheKeys = await cachesRef.keys();
    await Promise.all(cacheKeys.filter((key) => key.startsWith("voicelog-os-")).map((key) => cachesRef.delete(key)));
  }

  const hadController = Boolean(serviceWorkerRef.controller || registrations.length);
  const alreadyReloaded = sessionStorageRef.getItem(PREVIEW_CLEANUP_KEY) === "done";

  if (hadController && !alreadyReloaded) {
    sessionStorageRef.setItem(PREVIEW_CLEANUP_KEY, "done");
    reload();
    return { cleaned: true, reloaded: true };
  }

  sessionStorageRef.removeItem(PREVIEW_CLEANUP_KEY);
  return { cleaned: hadController, reloaded: false };
}
