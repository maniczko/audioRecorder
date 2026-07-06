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

  test('registers /health/live GET route', () => {
    const app = makeHonoLike();
    registerHealthRoute(app);
    const route = app._routes.find((r: any) => r.path === '/health/live');
    expect(route).toBeDefined();
    expect(route.method).toBe('get');
  });

  test('registers /ready GET route', () => {
    const app = makeHonoLike();
    registerHealthRoute(app);
    const route = app._routes.find((r: any) => r.path === '/ready');
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

  // ----------------------------------------------------------------
  // Issue #1306 - frontend liveness probe used dependency-heavy health
  // Date: 2026-07-06
  // Bug: the availability probe could be coupled to DB/storage readiness,
  //      causing false backend_unreachable states during dependency issues.
  // Fix: expose /health/live as a process-only liveness endpoint.
  // ----------------------------------------------------------------
  test('Regression: #1306 /health/live is process-only and does not query dependencies', async () => {
    const app = makeHonoLike();
    const db = {
      checkHealth: vi.fn().mockRejectedValue(new Error('database down')),
      _get: vi.fn().mockRejectedValue(new Error('database down')),
    };

    registerHealthRoute(app, db);
    const route = app._routes.find((r: any) => r.path === '/health/live');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      ok: true,
      status: 'ok',
      check: 'liveness',
    });
    expect(response.data).toHaveProperty('gitSha');
    expect(db.checkHealth).not.toHaveBeenCalled();
    expect(db._get).not.toHaveBeenCalled();
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

  test('Regression: reports real Supabase Storage readiness, not only env presence', async () => {
    const app = makeHonoLike();
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any, status: number) => {
      response = { data, status };
    });

    await route.handler(mockCtx);

    expect(response.status).toBe(200);
    expect(response.data.supabaseRemote).toBe(true);
    expect(response.data.supabaseStorage).toMatchObject({
      configured: true,
      ready: true,
      bucket: 'recordings',
    });

    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #1436 — Railway deploy health blocked by storage readiness
  // Date: 2026-07-06
  // Bug: /health returned 503 when Supabase Storage was degraded, so
  //      Railway marked otherwise booted backend containers as failed.
  // Fix: /health is liveness; /ready remains strict dependency readiness.
  // ─────────────────────────────────────────────────────────────────
  test('Regression: #1436 keeps Railway liveness healthy when storage readiness is degraded', async () => {
    const storageModule = await import('../../lib/supabaseStorage.ts');
    const storageSpy = vi.spyOn(storageModule, 'checkSupabaseStorageReadiness').mockResolvedValue({
      configured: true,
      ready: false,
      bucket: 'recordings',
      status: 'bucket_unavailable',
      error: 'exceed_egress_quota',
    });
    const savedNodeEnv = process.env.NODE_ENV;
    const savedRailwayEnv = process.env.RAILWAY_ENVIRONMENT_NAME;
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'production';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    const app = makeHonoLike();
    registerHealthRoute(app, {
      checkHealth: vi.fn().mockResolvedValue({ ok: true, status: 'healthy' }),
    });
    const healthRoute = app._routes.find((r: any) => r.path === '/health');
    const readyRoute = app._routes.find((r: any) => r.path === '/ready');

    let healthResponse: any;
    let readyResponse: any;
    await healthRoute.handler(
      makeCtxLike((data: any, status: number) => {
        healthResponse = { data, status };
      })
    );
    await readyRoute.handler(
      makeCtxLike((data: any, status: number) => {
        readyResponse = { data, status };
      })
    );

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data).toMatchObject({
      ok: true,
      status: 'ok',
      supabaseRemote: false,
      supabaseStorage: {
        ready: false,
        status: 'bucket_unavailable',
      },
      readiness: {
        ok: false,
        status: 'degraded',
        storageRequired: true,
      },
    });
    expect(readyResponse.status).toBe(503);
    expect(readyResponse.data).toMatchObject({
      ok: false,
      status: 'degraded',
    });

    storageSpy.mockRestore();
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (savedRailwayEnv === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME;
    else process.env.RAILWAY_ENVIRONMENT_NAME = savedRailwayEnv;
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  test('reports diarization degraded mode when HF token is missing', async () => {
    const app = makeHonoLike();
    const savedHfToken = process.env.HF_TOKEN;
    const savedHuggingFaceToken = process.env.HUGGINGFACE_TOKEN;
    delete process.env.HF_TOKEN;
    delete process.env.HUGGINGFACE_TOKEN;

    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any) => {
      response = { data };
    });

    await route.handler(mockCtx);
    expect(response.data.diarization).toEqual({
      enabled: false,
      provider: 'disabled',
      status: 'degraded',
    });

    process.env.HF_TOKEN = 'hf_test_token';
    await route.handler(mockCtx);
    expect(response.data.diarization).toEqual({
      enabled: true,
      provider: 'pyannote',
      status: 'available',
    });

    process.env.HF_TOKEN = savedHfToken;
    process.env.HUGGINGFACE_TOKEN = savedHuggingFaceToken;
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

  test('includes premium STT policy without exposing secrets', async () => {
    const app = makeHonoLike();
    const savedOpenAiKey = process.env.OPENAI_API_KEY;
    const savedGroqKey = process.env.GROQ_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GROQ_API_KEY = 'gsk-test';
    registerHealthRoute(app, undefined);
    const route = app._routes.find((r: any) => r.path === '/health');

    let response: any;
    const mockCtx = makeCtxLike((data: any) => {
      response = { data };
    });

    await route.handler(mockCtx);

    expect(response.data.stt).toMatchObject({
      policy: 'premium',
      provider: 'openai',
      fallbackProvider: 'groq',
      processingMode: 'full',
      fullModel: 'gpt-4o-transcribe',
      language: 'pl',
      openAiConfigured: true,
      groqConfigured: true,
    });
    expect(JSON.stringify(response.data.stt)).not.toContain('sk-test');
    expect(JSON.stringify(response.data.stt)).not.toContain('gsk-test');

    if (savedOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedOpenAiKey;
    if (savedGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = savedGroqKey;
  });
});
