import { describe, expect, test, vi, afterEach } from 'vitest';
import { createApp } from '../../app.ts';
import {
  registerCapabilitiesRoute,
  resolveProductionCapabilities,
} from '../../http/capabilities.ts';
import { MetricsService } from '../../services/MetricsService.ts';

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

const managedEnvKeys = [
  'OPENAI_API_KEY',
  'VOICELOG_OPENAI_API_KEY',
  'GROQ_API_KEY',
  'HF_TOKEN',
  'HUGGINGFACE_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'USE_LOCAL_WHISPER',
  'WHISPER_CPP_PATH',
  'VOICELOG_ENABLE_MEETING_ANALYSIS',
];

function withCleanCapabilityEnv() {
  const previous = new Map<string, string | undefined>();
  for (const key of managedEnvKeys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  return () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('http/capabilities.ts', () => {
  test('registers /api/capabilities GET route', () => {
    const app = makeHonoLike();
    registerCapabilitiesRoute(app);

    const route = app._routes.find((item: any) => item.path === '/api/capabilities');
    expect(route).toBeDefined();
    expect(route.method).toBe('get');
  });

  test('returns a user-facing degraded payload without provider secrets', async () => {
    const restore = withCleanCapabilityEnv();
    const app = makeHonoLike();
    registerCapabilitiesRoute(app, {
      resolveStorageReadiness: async () => ({
        configured: false,
        ready: false,
        bucket: 'recordings',
        status: 'missing_config',
      }),
    });
    const route = app._routes.find((item: any) => item.path === '/api/capabilities');

    let response: any;
    await route.handler(
      makeCtxLike((data: any, status: number) => {
        response = { data, status };
      })
    );

    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(false);
    expect(response.data.status).toBe('degraded');
    expect(response.data.capabilities.stt).toMatchObject({
      enabled: false,
      status: 'unavailable',
      provider: 'none',
    });
    expect(response.data.capabilities.meetingAnalysis).toMatchObject({
      enabled: false,
      status: 'degraded',
      provider: 'local-fallback',
      fallbackMode: true,
    });
    expect(response.data.telemetry.fallbackModeUsed).toBe(true);
    expect(response.data.telemetry.fallbackModeCapabilities).toContain('meetingAnalysis');
    expect(JSON.stringify(response.data)).not.toMatch(/sk-|test-secret|service-role/i);
    restore();
  });

  test('exposes /api/capabilities through the production app route registry', async () => {
    const restore = withCleanCapabilityEnv();
    const app = createApp({
      authService: {},
      workspaceService: {},
      transcriptionService: {},
      db: null,
      config: { allowedOrigins: 'http://localhost:3000', trustProxy: false },
    } as any);

    const res = await app.request('/api/capabilities', { method: 'GET' });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: false,
        status: 'degraded',
      })
    );
    expect(payload.capabilities).toHaveProperty('stt');
    expect(payload.capabilities).toHaveProperty('supabaseStorage');
    restore();
  });

  test('marks production capabilities ready when required providers are configured', () => {
    const restore = withCleanCapabilityEnv();
    process.env.OPENAI_API_KEY = 'sk-test-secret';
    process.env.HF_TOKEN = 'hf-test-secret';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.ANTHROPIC_API_KEY = 'anthropic-secret';
    process.env.GEMINI_API_KEY = 'gemini-secret';
    process.env.VOICELOG_ENABLE_MEETING_ANALYSIS = 'true';

    const payload = resolveProductionCapabilities({
      storageReadiness: {
        configured: true,
        ready: true,
        bucket: 'recordings',
        status: 'ready',
      },
    });

    expect(payload.ok).toBe(true);
    expect(payload.status).toBe('ready');
    expect(payload.degradedCapabilities).toEqual([]);
    expect(payload.capabilities.stt.status).toBe('available');
    expect(payload.capabilities.diarization.status).toBe('available');
    expect(payload.capabilities.meetingAnalysis.status).toBe('available');
    expect(payload.capabilities.supabaseStorage.status).toBe('available');
    expect(payload.capabilities.embeddings.status).toBe('available');
    expect(payload.capabilities.imageGeneration.status).toBe('available');
    expect(JSON.stringify(payload)).not.toContain('sk-test-secret');
    expect(JSON.stringify(payload)).not.toContain('service-role-secret');
    restore();
  });

  test('reports Groq as degraded STT fallback when OpenAI primary is missing', () => {
    const restore = withCleanCapabilityEnv();
    process.env.GROQ_API_KEY = 'gsk-test-secret';

    const payload = resolveProductionCapabilities({
      storageReadiness: {
        configured: false,
        ready: false,
        bucket: 'recordings',
        status: 'missing_config',
      },
    });

    expect(payload.capabilities.stt).toMatchObject({
      enabled: true,
      status: 'degraded',
      provider: 'groq',
      fallbackMode: true,
    });
    expect(payload.capabilities.stt.reason).toContain('fallback provider');
    expect(JSON.stringify(payload)).not.toContain('gsk-test-secret');
    restore();
  });

  test('reports local whisper as a configured offline STT fallback', () => {
    const restore = withCleanCapabilityEnv();
    process.env.USE_LOCAL_WHISPER = 'true';
    process.env.WHISPER_CPP_PATH = 'C:/tools/whisper/main.exe';

    const payload = resolveProductionCapabilities();

    expect(payload.capabilities.stt).toMatchObject({
      enabled: true,
      status: 'available',
      provider: 'local-whisper',
      fallbackMode: true,
    });
    expect(payload.telemetry.fallbackModeCapabilities).toContain('stt');
    restore();
  });

  test('redacts provider-looking secrets from storage readiness errors', () => {
    const payload = resolveProductionCapabilities({
      storageReadiness: {
        configured: true,
        ready: false,
        bucket: 'recordings',
        status: 'bucket_unavailable',
        error: 'bucket failed with sk-test-secret and token-secret',
      },
    });

    expect(payload.capabilities.supabaseStorage.reason).toContain('[redacted]');
    expect(payload.capabilities.supabaseStorage.reason).not.toContain('sk-test-secret');
    expect(payload.capabilities.supabaseStorage.reason).not.toContain('token-secret');
  });

  test('records fallback mode telemetry when the route is requested', async () => {
    const restore = withCleanCapabilityEnv();
    const observeCapabilityMode = vi.spyOn(MetricsService, 'observeCapabilityMode');
    const app = makeHonoLike();
    registerCapabilitiesRoute(app, {
      resolveStorageReadiness: async () => ({
        configured: false,
        ready: false,
        bucket: 'recordings',
        status: 'missing_config',
      }),
    });
    const route = app._routes.find((item: any) => item.path === '/api/capabilities');

    await route.handler(makeCtxLike(() => undefined));

    expect(observeCapabilityMode).toHaveBeenCalledWith('meetingAnalysis', 'fallback');
    expect(observeCapabilityMode).toHaveBeenCalledWith('supabaseStorage', 'fallback');
    restore();
  });
});
