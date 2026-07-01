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
  const productionOrigin = 'https://voicelog-audiorecorder.vercel.app';

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

  function expectCredentialedCors(res: Response, origin = productionOrigin) {
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('X-Workspace-Id');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Vary')).toContain('Origin');
  }

  // ----------------------------------------------------------------
  // Issue #1305 - Production CORS missing on startup and error paths
  // Date: 2026-06-30
  // Bug: production Vercel origins could receive partial or missing CORS
  //      headers on notFound/onError responses, hiding real 4xx/5xx errors
  //      behind browser-level CORS failures.
  // Fix: every success, preflight, auth failure, notFound and onError response
  //      carries the same explicit CORS contract for allowlisted origins.
  // ----------------------------------------------------------------
  describe('Regression: Issue #1305 - production CORS startup paths', () => {
    function createProductionApp() {
      process.env.NODE_ENV = 'production';
      delete process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS;
      return createApp(
        createServices(`${productionOrigin},https://audiorecorder-git-main.example.vercel.app`)
      );
    }

    it('returns full CORS headers for startup success, preflight, auth failure, notFound and onError paths', async () => {
      const app = createProductionApp();
      app.get('/boom', () => {
        throw new Error('boom');
      });

      const health = await app.request('/health', {
        method: 'GET',
        headers: { Origin: productionOrigin },
      });
      expectCredentialedCors(health);

      for (const path of ['/health', '/state/bootstrap', '/integrations/google/status']) {
        const res = await app.request(path, {
          method: 'OPTIONS',
          headers: {
            Origin: productionOrigin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization,Content-Type,X-Workspace-Id',
          },
        });
        expect(res.status).toBe(204);
        expectCredentialedCors(res);
      }

      const unauthorized = await app.request('/state/bootstrap?workspaceId=w123', {
        method: 'GET',
        headers: { Origin: productionOrigin },
      });
      expect(unauthorized.status).toBe(401);
      expectCredentialedCors(unauthorized);

      const missing = await app.request('/missing-production-route', {
        method: 'GET',
        headers: { Origin: productionOrigin },
      });
      expect(missing.status).toBe(404);
      expectCredentialedCors(missing);

      const error = await app.request('/boom', {
        method: 'GET',
        headers: { Origin: productionOrigin },
      });
      expect(error.status).toBe(500);
      expectCredentialedCors(error);
    });
  });
});
