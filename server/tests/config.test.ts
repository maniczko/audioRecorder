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
    process.env.DEBUG = 'true';

    const { validateRequiredApiKeys } = await import('../config.js');
    validateRequiredApiKeys();

    expect(logSpy).toHaveBeenCalledWith('\n✅ Configuration loaded successfully:');
  });

  test('exports config object with expected properties', async () => {
    const { config } = await import('../config.js');
    expect(config).toHaveProperty('VOICELOG_STT_PROVIDER');
    expect(config).toHaveProperty('VOICELOG_OPENAI_BASE_URL');
    expect(config).toHaveProperty('VOICELOG_PROCESSING_MODE_DEFAULT');
  });
});
