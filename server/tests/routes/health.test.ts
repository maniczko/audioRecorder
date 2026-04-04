import { describe, test, expect, vi } from 'vitest';
import { registerHealthRoute } from '../../http/health.ts';

function makeHonoLike() {
  const routes: { method: string; path: string; handler: any }[] = [];
  const app: any = {
    get(path: string, handler: any) {
      routes.push({ method: 'get', path, handler });
    },
    _routes: routes,
  };
  return app;
}

function makeCtxLike(jsonFn: any) {
  return { json: jsonFn } as any;
}

describe('http/health.ts', () => {
  test('registers /health GET route', () => {
    const app = makeHonoLike();
    registerHealthRoute(app);
    const route = app._routes.find((r: any) => r.path === '/health');
    expect(route).toBeDefined();
    expect(route.method).toBe('get');
  });

  test('returns ok status with db fallback', async () => {
    const app = makeHonoLike();
    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
    expect(response.data.status).toBe('ok');
    expect(response.data.db).toBe('no_db_required');
    expect(response.data).toHaveProperty('uptime');
    expect(response.data).toHaveProperty('memory');
    expect(response.data).toHaveProperty('platform');
  });

  test('checks db health via checkHealth method', async () => {
    const app = makeHonoLike();
    const db = {
      checkHealth: vi.fn().mockResolvedValue({ ok: true, status: 'healthy' }),
    };
    registerHealthRoute(app, db);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(db.checkHealth).toHaveBeenCalled();
    expect(response.data.db).toBe('healthy');
    expect(response.status).toBe(200);
  });

  test('falls back to db._get when checkHealth not available', async () => {
    const app = makeHonoLike();
    const db = {
      _get: vi.fn().mockResolvedValue({ ok: 1 }),
    };
    registerHealthRoute(app, db);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(db._get).toHaveBeenCalledWith('SELECT 1 as ok');
    expect(response.data.db).toBe('connected');
    expect(response.status).toBe(200);
  });

  test('returns 503 when db check fails', async () => {
    const app = makeHonoLike();
    const db = {
      _get: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    registerHealthRoute(app, db);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(response.status).toBe(503);
    expect(response.data.ok).toBe(false);
    expect(response.data.db).toBe('connection refused');
    expect(response.data.status).toBe('degraded');
  });

  test('includes supabaseRemote flag based on env vars', async () => {
    const app = makeHonoLike();
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any) => {
      response = { data };
    });

    await route.handler(mockCtx);
    expect(response.data.supabaseRemote).toBe(false);

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    await route.handler(mockCtx);
    expect(response.data.supabaseRemote).toBe(true);

    process.env.SUPABASE_URL = savedUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  test('includes build metadata', async () => {
    const app = makeHonoLike();
    process.env.GITHUB_SHA = 'sha123';
    process.env.APP_VERSION = '1.2.3';
    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any) => {
      response = { data };
    });

    await route.handler(mockCtx);
    expect(response.data.gitSha).toBe('sha123');
    expect(response.data.appVersion).toBe('1.2.3');

    delete process.env.GITHUB_SHA;
    delete process.env.APP_VERSION;
  });
});
