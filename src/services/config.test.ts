import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
  REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
  VITE_MEDIA_API_BASE_URL: process.env.VITE_MEDIA_API_BASE_URL,
  REACT_APP_MEDIA_API_BASE_URL: process.env.REACT_APP_MEDIA_API_BASE_URL,
};

function setWindowOrigin(origin: string) {
  const url = new URL(origin);
  vi.stubGlobal('window', {
    location: {
      origin,
      hostname: url.hostname,
      protocol: url.protocol,
      href: origin,
    },
  });
}

describe('services/config resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    process.env.VITE_API_BASE_URL = ORIGINAL_ENV.VITE_API_BASE_URL;
    process.env.REACT_APP_API_BASE_URL = ORIGINAL_ENV.REACT_APP_API_BASE_URL;
    process.env.VITE_MEDIA_API_BASE_URL = ORIGINAL_ENV.VITE_MEDIA_API_BASE_URL;
    process.env.REACT_APP_MEDIA_API_BASE_URL = ORIGINAL_ENV.REACT_APP_MEDIA_API_BASE_URL;
    vi.resetModules();
  });

  it('uses configured API URL directly on Vercel preview runtime', async () => {
    process.env.VITE_API_BASE_URL = 'https://voicelog-production.up.railway.app';
    delete process.env.REACT_APP_API_BASE_URL;
    setWindowOrigin('https://audiorecorder-preview.vercel.app');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('https://voicelog-production.up.railway.app');
    expect(config.MEDIA_API_BASE_URL).toBe('https://voicelog-production.up.railway.app');
  });

  it('falls back to Railway directly on hosted Vercel when API URL is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('REACT_APP_API_BASE_URL', '');
    setWindowOrigin('https://audiorecorder-preview.vercel.app');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('https://voicelog-production.up.railway.app');
  });

  it('allows overriding the direct media API base URL', async () => {
    vi.stubEnv('VITE_MEDIA_API_BASE_URL', 'https://media.example.test');
    setWindowOrigin('https://audiorecorder-preview.vercel.app');

    const config = await import('./config');

    expect(config.MEDIA_API_BASE_URL).toBe('https://media.example.test');
  });

  it('falls back to local default when API URL is not configured in non-hosted runtime', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('REACT_APP_API_BASE_URL', '');
    setWindowOrigin('http://127.0.0.1:3000');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('http://127.0.0.1:4000');
  });

  it('forces remote data provider on hosted HTTPS runtime so new accounts use Supabase-backed API', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'local');
    vi.stubEnv('REACT_APP_DATA_PROVIDER', 'local');
    setWindowOrigin('https://voicelog-audiorecorder.vercel.app');

    const config = await import('./config');

    expect(config.APP_DATA_PROVIDER).toBe('remote');
    expect(config.remoteApiEnabled()).toBe(true);
  });

  it('keeps local data provider available for localhost development', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'local');
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('REACT_APP_API_BASE_URL', '');
    setWindowOrigin('http://localhost:3000');

    const config = await import('./config');

    expect(config.APP_DATA_PROVIDER).toBe('local');
    expect(config.remoteApiEnabled()).toBe(false);
  });

  it('enables remote localhost auth when VITE_DATA_PROVIDER is remote', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'remote');
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:4000');
    setWindowOrigin('http://127.0.0.1:3000');

    const config = await import('./config');

    expect(config.APP_DATA_PROVIDER).toBe('remote');
    expect(config.API_BASE_URL).toBe('http://127.0.0.1:4000');
    expect(config.remoteApiEnabled()).toBe(true);
  });

  it('enables remote localhost auth when an API base URL is explicitly configured', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', '');
    vi.stubEnv('REACT_APP_DATA_PROVIDER', '');
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:4000');
    setWindowOrigin('http://127.0.0.1:3000');

    const config = await import('./config');

    expect(config.APP_DATA_PROVIDER).toBe('remote');
    expect(config.remoteApiEnabled()).toBe(true);
  });

  it('prefers explicit API base URL over stale local provider on localhost', async () => {
    vi.stubEnv('VITE_DATA_PROVIDER', 'local');
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:4000');
    setWindowOrigin('http://127.0.0.1:3000');

    const config = await import('./config');

    expect(config.APP_DATA_PROVIDER).toBe('remote');
    expect(config.remoteApiEnabled()).toBe(true);
  });
});
