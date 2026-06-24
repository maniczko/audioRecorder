import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config.ts — validateRequiredApiKeys', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('does not call process.exit in test environment when errors exist', async () => {
    // Clear STT providers to trigger errors
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.WHISPER_CPP_PATH;
    delete process.env.USE_LOCAL_WHISPER;
    process.env.NODE_ENV = 'test';

    const { validateRequiredApiKeys } = await import('../config.js');
    validateRequiredApiKeys();

    // Should NOT have exited (we're in test env) even if there are errors
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test('logs successful config in development mode', async () => {
    // These env vars must be set BEFORE the module is first loaded
    process.env.OPENAI_API_KEY = 'sk-test123';
    process.env.HF_TOKEN = 'hf_test_token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key123';
    process.env.NODE_ENV = 'development';

    const { validateRequiredApiKeys } = await import('../config.js');
    validateRequiredApiKeys();

    expect(logSpy).toHaveBeenCalledWith('\n✅ Configuration loaded successfully:');
  });

  test('logs successful config when DEBUG=true', async () => {
    process.env.OPENAI_API_KEY = 'sk-test123';
    process.env.HF_TOKEN = 'hf_test_token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key123';
    process.env.NODE_ENV = 'production';
    process.env.VOICELOG_ALLOWED_ORIGINS = 'https://voicelog.example.com';
    process.env.DEBUG = 'true';

    const { validateRequiredApiKeys } = await import('../config.js');
    validateRequiredApiKeys();

    expect(logSpy).toHaveBeenCalledWith('\n✅ Configuration loaded successfully:');
  });

  test('blocks production when CORS is left on the localhost default', async () => {
    const previousEnv = { ...process.env };

    try {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key';
      process.env.NODE_ENV = 'production';
      process.env.RAILWAY_PROJECT_ID = 'railway-project-test';
      delete process.env.VOICELOG_ALLOWED_ORIGINS;
      delete process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS;

      const { validateRequiredApiKeys } = await import('../config.js');
      validateRequiredApiKeys();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration errors'));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Production CORS is configured only for local development origins')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.env = previousEnv;
    }
  });

  test('blocks Railway production when SUPABASE_URL is a Postgres URL instead of project API URL', async () => {
    const previousEnv = { ...process.env };

    try {
      process.env.OPENAI_API_KEY = 'sk-test123';
      process.env.NODE_ENV = 'production';
      process.env.RAILWAY_PROJECT_ID = 'railway-project-test';
      process.env.VOICELOG_ALLOWED_ORIGINS = 'https://voicelog.example.com';
      process.env.SUPABASE_URL =
        'postgresql://postgres:secret@db.tdikvnyrdpudlefjtqty.supabase.co:5432/postgres';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key';

      const { validateRequiredApiKeys } = await import('../config.js');
      validateRequiredApiKeys();

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration errors'));
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('SUPABASE_URL must be a Supabase project API URL')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.env = previousEnv;
    }
  });

  test('exports config object with expected properties', async () => {
    const { config } = await import('../config.js');
    expect(config).toHaveProperty('VOICELOG_STT_PROVIDER');
    expect(config).toHaveProperty('VOICELOG_STT_POLICY');
    expect(config).toHaveProperty('VOICELOG_OPENAI_BASE_URL');
    expect(config).toHaveProperty('VOICELOG_PROCESSING_MODE_DEFAULT');
  });

  test('defaults production-quality STT to OpenAI premium mode', async () => {
    const previousProvider = process.env.VOICELOG_STT_PROVIDER;
    const previousPolicy = process.env.VOICELOG_STT_POLICY;
    const previousMode = process.env.VOICELOG_PROCESSING_MODE_DEFAULT;
    vi.resetModules();
    delete process.env.VOICELOG_STT_PROVIDER;
    delete process.env.VOICELOG_STT_POLICY;
    delete process.env.VOICELOG_PROCESSING_MODE_DEFAULT;

    const { config } = await import('../config.js');

    expect(config.VOICELOG_STT_POLICY).toBe('premium');
    expect(config.VOICELOG_STT_PROVIDER).toBe('openai');
    expect(config.VOICELOG_PROCESSING_MODE_DEFAULT).toBe('full');

    if (previousProvider === undefined) delete process.env.VOICELOG_STT_PROVIDER;
    else process.env.VOICELOG_STT_PROVIDER = previousProvider;
    if (previousPolicy === undefined) delete process.env.VOICELOG_STT_POLICY;
    else process.env.VOICELOG_STT_POLICY = previousPolicy;
    if (previousMode === undefined) delete process.env.VOICELOG_PROCESSING_MODE_DEFAULT;
    else process.env.VOICELOG_PROCESSING_MODE_DEFAULT = previousMode;
  });
});
