import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const mockTracerInit = vi.fn();
const mockTracerUse = vi.fn();

vi.mock('dd-trace', () => {
  const tracer = {
    init: mockTracerInit,
    use: mockTracerUse,
  };
  return { default: tracer, __esModule: true };
});

describe('datadog.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    mockTracerInit.mockClear();
    mockTracerUse.mockClear();
    process.env.NODE_ENV = '';
    process.env.DD_APM_ENABLED = '';
    process.env.DD_SERVICE = '';
    process.env.DD_ENV = '';
    process.env.DD_AGENT_HOST = '';
    process.env.DD_TRACE_AGENT_PORT = '';
    process.env.DD_LOGS_INJECTION = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('logs "APM disabled" when not production and DD_APM_ENABLED not set', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
    await import('../datadog.js');
    expect(logSpy).toHaveBeenCalledWith(
      '[DataDog] APM disabled (set DD_APM_ENABLED=true or NODE_ENV=production)'
    );
  });

  test('logs "APM disabled" in development mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    await import('../datadog.js');
    expect(logSpy).toHaveBeenCalledWith(
      '[DataDog] APM disabled (set DD_APM_ENABLED=true or NODE_ENV=production)'
    );
  });

  test('initializes APM when DD_APM_ENABLED=true', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
    process.env.DD_APM_ENABLED = 'true';
    process.env.DD_SERVICE = 'my-service';
    await import('../datadog.js');
    expect(mockTracerInit).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'my-service',
        env: 'test',
      })
    );
    expect(logSpy).toHaveBeenCalledWith('[DataDog] APM initialized successfully');
  });

  test('initializes APM when NODE_ENV=production', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    await import('../datadog.js');
    expect(mockTracerInit).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'voicelog-server',
        env: 'production',
        profiling: true,
      })
    );
    expect(logSpy).toHaveBeenCalledWith('[DataDog] APM initialized successfully');
  });

  test('instruments HTTP, pg, and hono in production mode', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'production';
    await import('../datadog.js');
    expect(mockTracerUse).toHaveBeenCalledWith('http', expect.any(Object));
    expect(mockTracerUse).toHaveBeenCalledWith('pg', expect.any(Object));
    expect(mockTracerUse).toHaveBeenCalledWith('hono', expect.any(Object));
  });

  test('exports tracer as default', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
    const mod = await import('../datadog.js');
    expect(mod.default).toHaveProperty('init');
    expect(mod.default).toHaveProperty('use');
  });

  test('uses default service name when DD_SERVICE not set', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'test';
    process.env.DD_APM_ENABLED = 'true';
    delete process.env.DD_SERVICE;
    await import('../datadog.js');
    expect(mockTracerInit).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'voicelog-server' })
    );
  });

  test('disables profiling in non-production', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NODE_ENV = 'staging';
    process.env.DD_APM_ENABLED = 'true';
    await import('../datadog.js');
    expect(mockTracerInit).toHaveBeenCalledWith(expect.objectContaining({ profiling: false }));
  });
});
