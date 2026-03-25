const PREVIEW_CLEANUP_KEY = "voicelog.preview-runtime-cleanup.v1";
const PREVIEW_BUILD_KEY = "voicelog.preview-runtime-build.v1";

function isLocalhost(hostname: string) {
  return /^(localhost|127\.0\.0\.1)$/i.test(String(hostname || ""));
}

export function isHostedPreviewHost(hostname: string) {
  return /\.vercel\.app$/i.test(String(hostname || ""));
}

export function shouldEnableServiceWorker(hostname: string) {
  return isLocalhost(hostname);
}

function readBuildId() {
  try {
    // @ts-expect-error - import.meta.env is Vite-specific and not in TypeScript types
    const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
    return String(env?.VITE_VERCEL_GIT_COMMIT_SHA || env?.VITE_BUILD_ID || "").trim();
  } catch (_) {
    return "";
  }
}

export function getHostedRuntimeBuildId() {
  return readBuildId();
}

export async function prepareHostedRuntime({
  hostname = window.location.hostname,
  sessionStorageRef = window.sessionStorage,
  serviceWorkerRef = navigator.serviceWorker,
  cachesRef = window.caches,
  reload = () => window.location.reload(),
  buildId = readBuildId(),
}: {
  hostname?: string;
  sessionStorageRef?: Storage;
  serviceWorkerRef?: ServiceWorkerContainer;
  cachesRef?: CacheStorage;
  reload?: () => void;
  buildId?: string;
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
  const previousBuildId = String(sessionStorageRef.getItem(PREVIEW_BUILD_KEY) || "");
  const buildChanged = Boolean(buildId && previousBuildId && previousBuildId !== buildId);

  if (buildId) {
    sessionStorageRef.setItem(PREVIEW_BUILD_KEY, buildId);
  }

  if ((hadController || buildChanged) && !alreadyReloaded) {
    sessionStorageRef.setItem(PREVIEW_CLEANUP_KEY, "done");
    reload();
    return { cleaned: true, reloaded: true };
  }

  sessionStorageRef.removeItem(PREVIEW_CLEANUP_KEY);
  return { cleaned: hadController || buildChanged, reloaded: false };
}
