function readEnv(key: string, fallback = '') {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  const env = (import.meta as any).env;
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
  }
  return fallback;
}

function readMode(value, fallback = 'local') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'remote' ? 'remote' : fallback;
}

function readDefaultApiBaseUrl() {
  const env = (import.meta as any).env;
  const isProd = Boolean(env?.PROD);
  if (!isProd) {
    return 'http://localhost:4000';
  }

  // In deployed frontend builds we proxy API paths through the same origin.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return '';
}

export const APP_DATA_PROVIDER = readMode(
  readEnv('VITE_DATA_PROVIDER') || readEnv('REACT_APP_DATA_PROVIDER') || 'local',
  'local'
);

export const MEDIA_PIPELINE_PROVIDER = readMode(
  readEnv('VITE_MEDIA_PROVIDER') || readEnv('REACT_APP_MEDIA_PROVIDER') || 'local',
  'local'
);

const RAW_API_BASE_URL = String(
  readEnv('VITE_API_BASE_URL') ||
    readEnv('REACT_APP_API_BASE_URL') ||
    readDefaultApiBaseUrl()
).trim();

export const API_BASE_URL = RAW_API_BASE_URL;

export function apiBaseUrlConfigured() {
  return Boolean(API_BASE_URL);
}

export function remoteApiEnabled() {
  return APP_DATA_PROVIDER === 'remote' && apiBaseUrlConfigured();
}
