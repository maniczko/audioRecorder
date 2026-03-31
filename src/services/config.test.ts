import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
  REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL,
};

function setWindowOrigin(origin: string) {
  vi.stubGlobal('window', {
    location: {
      origin,
    },
  });
}

describe('services/config resolveApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.VITE_API_BASE_URL = ORIGINAL_ENV.VITE_API_BASE_URL;
    process.env.REACT_APP_API_BASE_URL = ORIGINAL_ENV.REACT_APP_API_BASE_URL;
    vi.resetModules();
  });

  it('uses same-origin proxy on Vercel preview runtime (ignores VITE_API_BASE_URL)', async () => {
    process.env.VITE_API_BASE_URL = 'https://audiorecorder-production.up.railway.app';
    delete process.env.REACT_APP_API_BASE_URL;
    setWindowOrigin('https://audiorecorder-preview.vercel.app');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('https://audiorecorder-preview.vercel.app');
  });

  it('falls back to local default when API URL is not configured in non-hosted runtime', async () => {
    delete process.env.VITE_API_BASE_URL;
    delete process.env.REACT_APP_API_BASE_URL;
    setWindowOrigin('http://127.0.0.1:3000');

    const config = await import('./config');

    expect(config.API_BASE_URL).toBe('http://localhost:4000');
  });
});
