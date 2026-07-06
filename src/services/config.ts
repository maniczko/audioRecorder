function readEnv(key: string, fallback = '') {
  const env = (import.meta as any).env;
  const isTestRuntime =
    Boolean(env?.MODE === 'test') || Boolean(typeof process !== 'undefined' && process.env?.VITEST);

  if (isTestRuntime && typeof process !== 'undefined' && process.env?.[key] !== undefined) {
    return process.env[key];
  }

  if (typeof import.meta !== 'undefined' && env) {
    if (key === 'VITE_DATA_PROVIDER' && env.VITE_DATA_PROVIDER !== undefined)
      return env.VITE_DATA_PROVIDER;
    if (key === 'REACT_APP_DATA_PROVIDER' && env.REACT_APP_DATA_PROVIDER !== undefined)
      return env.REACT_APP_DATA_PROVIDER;
    if (key === 'VITE_MEDIA_PROVIDER' && env.VITE_MEDIA_PROVIDER !== undefined)
      return env.VITE_MEDIA_PROVIDER;
    if (key === 'REACT_APP_MEDIA_PROVIDER' && env.REACT_APP_MEDIA_PROVIDER !== undefined)
      return env.REACT_APP_MEDIA_PROVIDER;
    if (key === 'VITE_API_BASE_URL' && env.VITE_API_BASE_URL !== undefined)
      return env.VITE_API_BASE_URL;
    if (key === 'REACT_APP_API_BASE_URL' && env.REACT_APP_API_BASE_URL !== undefined)
      return env.REACT_APP_API_BASE_URL;
    if (key === 'VITE_MEDIA_API_BASE_URL' && env.VITE_MEDIA_API_BASE_URL !== undefined)
      return env.VITE_MEDIA_API_BASE_URL;
    if (key === 'REACT_APP_MEDIA_API_BASE_URL' && env.REACT_APP_MEDIA_API_BASE_URL !== undefined)
      return env.REACT_APP_MEDIA_API_BASE_URL;
  }
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  return fallback;
}

const STABLE_VERCEL_HOSTNAME = 'voicelog-audiorecorder.vercel.app';

function readMode(value, fallback = 'local') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'remote' ? 'remote' : fallback;
}

function isStableProductionVercelRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }
  const location = window.location;
  return (
    String(location?.protocol || '') === 'https:' &&
    String(location?.hostname || '').toLowerCase() === STABLE_VERCEL_HOSTNAME
  );
}

function isHostedVercelPreviewRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }
  const location = window.location;
  const hostname = String(location?.hostname || '').toLowerCase();
  return (
    String(location?.protocol || '') === 'https:' &&
    hostname.endsWith('.vercel.app') &&
    hostname !== STABLE_VERCEL_HOSTNAME
  );
}

function isHostedBrowserRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const location = window.location;
  const hostname = String(location?.hostname || '').toLowerCase();
  const protocol = String(location?.protocol || '');

  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return false;
  }

  return protocol === 'https:';
}

function readDefaultApiBaseUrl() {
  const env = (import.meta as any).env;
  const isProd = Boolean(env?.PROD);

  if (isHostedVercelPreviewRuntime()) {
    return '';
  }

  if (
    isStableProductionVercelRuntime() &&
    typeof window !== 'undefined' &&
    window.location?.origin
  ) {
    return window.location.origin;
  }

  if (!isProd) {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname === '127.0.0.1' || hostname === 'localhost') {
        return `http://${hostname}:4000`;
      }
    }
    return 'http://localhost:4000';
  }

  // Stable production and custom hosted frontends proxy API paths through the same origin.
  if (isProd && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

function resolveApiBaseUrl() {
  const configuredValue = String(
    readEnv('VITE_API_BASE_URL') || readEnv('REACT_APP_API_BASE_URL') || ''
  ).trim();

  return configuredValue || readDefaultApiBaseUrl();
}

function hasExplicitApiBaseUrl() {
  return Boolean(
    String(readEnv('VITE_API_BASE_URL') || readEnv('REACT_APP_API_BASE_URL') || '').trim()
  );
}

const RAW_API_BASE_URL = String(resolveApiBaseUrl()).trim();

export const APP_DATA_PROVIDER = readMode(
  isHostedBrowserRuntime() && RAW_API_BASE_URL
    ? 'remote'
    : hasExplicitApiBaseUrl()
      ? 'remote'
      : readEnv('VITE_DATA_PROVIDER') || readEnv('REACT_APP_DATA_PROVIDER') || 'local',
  'local'
);

export const MEDIA_PIPELINE_PROVIDER = readMode(
  readEnv('VITE_MEDIA_PROVIDER') || readEnv('REACT_APP_MEDIA_PROVIDER') || 'local',
  'local'
);

export const API_BASE_URL = RAW_API_BASE_URL;
export const MEDIA_API_BASE_URL = String(
  readEnv('VITE_MEDIA_API_BASE_URL') || readEnv('REACT_APP_MEDIA_API_BASE_URL') || API_BASE_URL
).trim();

export function apiBaseUrlConfigured() {
  return Boolean(API_BASE_URL);
}

export function remoteApiEnabled() {
  return APP_DATA_PROVIDER === 'remote' && apiBaseUrlConfigured();
}
