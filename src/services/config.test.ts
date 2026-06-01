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

  it('uses same-origin proxy on Vercel preview runtime (ignores VITE_API_BASE_URL)', async () => {
    process.env.VITE_API_BASE_URL = 'https://audiorecorder-production.up.railway.app';
    delete process.env.REACT_APP_API_BASE_URL;
    setWindowOrigin('https://audiorecorder-preview.vercel.app');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('https://audiorecorder-preview.vercel.app');
    expect(config.MEDIA_API_BASE_URL).toBe('https://audiorecorder-production.up.railway.app');
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
});
