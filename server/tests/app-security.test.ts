import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.ts';

function createServices(allowedOrigins: string) {
  return {
    authService: { getSession: vi.fn() },
    workspaceService: { getMembership: vi.fn() },
    transcriptionService: {},
    db: {},
    config: {
      allowedOrigins,
      trustProxy: false,
      uploadDir: '/tmp',
    },
  } as any;
}

describe('app security CORS contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowVercelPreviews = process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS = originalAllowVercelPreviews;
    vi.restoreAllMocks();
  });

  it('allows credentials only for explicitly allowed request origins', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS;
    const app = createApp(createServices('https://app.example.test'));

    const allowed = await app.request('/missing-route', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.test',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(allowed.headers.get('Access-Control-Allow-Credentials')).toBe('true');

    const disallowed = await app.request('/missing-route', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.test',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(disallowed.status).toBe(204);
    expect(disallowed.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(disallowed.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('does not echo wildcard Vercel preview origins with credentials in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS;
    const app = createApp(createServices('https://*.vercel.app,https://app.example.test'));

    const res = await app.request('/missing-route', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://preview-app.vercel.app',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.test');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
});
