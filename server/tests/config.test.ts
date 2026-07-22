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

  test('logs sanitized CORS startup configuration without secrets', async () => {
    const previousEnv = { ...process.env };

    try {
      process.env.OPENAI_API_KEY = 'sk-secret-openai';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_service_role';
      process.env.NODE_ENV = 'production';
      process.env.RAILWAY_PROJECT_ID = 'railway-project-test';
      process.env.VOICELOG_ALLOWED_ORIGINS =
        'https://voicelog-audiorecorder.vercel.app,https://audiorecorder-git-main-iwoczajka-2703s-projects.vercel.app';
      process.env.VOICELOG_ALLOW_VERCEL_PREVIEWS = 'false';

      const { validateRequiredApiKeys } = await import('../config.js');
      validateRequiredApiKeys();

      expect(logSpy).toHaveBeenCalledWith(
        '[Config] CORS',
        expect.objectContaining({
          allowedOriginCount: 2,
          allowVercelPreviews: false,
          nodeEnv: 'production',
          productionDeployment: true,
        })
      );
      const serializedLogs = logSpy.mock.calls.map((args) => JSON.stringify(args)).join('\n');
      expect(serializedLogs).toContain('https://voicelog-audiorecorder.vercel.app');
      expect(serializedLogs).not.toContain('sk-secret-openai');
      expect(serializedLogs).not.toContain('sb_secret_service_role');
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

  // ----------------------------------------------------------------
  // Issue #1510 — production must never fall back to SQLite
  // Date: 2026-07-21
  // Bug: a Railway deployment without a usable PostgreSQL URL could
  //      initialize local SQLite and silently lose data on redeploy.
  // Fix: one production predicate and a fail-closed URL validator are
  //      shared by startup validation and database initialization.
  // ----------------------------------------------------------------
  test('rejects missing and malformed PostgreSQL configuration for production deployments', async () => {
    const { getProductionDatabaseConfigurationError, isProductionDeployment } =
      await import('../config.js');

    expect(isProductionDeployment({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionDeployment({ RAILWAY_PROJECT_ID: 'railway-project-test' })).toBe(true);
    expect(
      isProductionDeployment({ NODE_ENV: 'test', RAILWAY_PROJECT_ID: 'railway-project-test' })
    ).toBe(false);
    expect(getProductionDatabaseConfigurationError({ NODE_ENV: 'production' })).toContain(
      'Missing PostgreSQL database URL'
    );
    expect(
      getProductionDatabaseConfigurationError({
        NODE_ENV: 'production',
        DATABASE_URL: 'https://db.example.com/not-postgres',
      })
    ).toContain('postgresql://');
    expect(
      getProductionDatabaseConfigurationError({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:secret@postgres.project-ref:5432/postgres',
      })
    ).toContain('complete resolvable Supabase host');
  });

  test('accepts direct and pooler PostgreSQL URLs in production without exposing credentials', async () => {
    const { getProductionDatabaseConfigurationError } = await import('../config.js');

    expect(
      getProductionDatabaseConfigurationError({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://postgres:super-secret@db.project-ref.supabase.co:5432/postgres',
      })
    ).toBeNull();
    expect(
      getProductionDatabaseConfigurationError({
        RAILWAY_PROJECT_ID: 'railway-project-test',
        VOICELOG_DATABASE_URL:
          'postgresql://postgres.project-ref:super-secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      })
    ).toBeNull();
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
