/**
 * datadog.test.ts
 *
 * Tests for DataDog APM configuration module.
 * Coverage target: 100% (currently 0%)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('datadog — APM configuration', () => {
  const originalEnv = { ...process.env };
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Reset env vars
    process.env.NODE_ENV = '';
    process.env.DD_APM_ENABLED = '';
    process.env.DD_SERVICE = '';
    process.env.DD_ENV = '';
    process.env.DD_AGENT_HOST = '';
    process.env.DD_TRACE_AGENT_PORT = '';
    process.env.DD_LOGS_INJECTION = '';
  });

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('DD_') || key === 'NODE_ENV') {
        process.env[key] = (originalEnv as Record<string, string | undefined>)[key] || '';
      }
    });
    consoleLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  test('logs "APM disabled" when not in production and DD_APM_ENABLED is not set', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DD_APM_ENABLED = '';

    await import('../datadog.ts');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[DataDog] APM disabled (set DD_APM_ENABLED=true or NODE_ENV=production)'
    );
  });

  test('logs "APM disabled" in development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DD_APM_ENABLED = '';

    await import('../datadog.ts');

    // In development, it should NOT initialize (only production or explicit enable)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[DataDog] APM disabled (set DD_APM_ENABLED=true or NODE_ENV=production)'
    );
  });

  test('initializes APM when DD_APM_ENABLED is explicitly set to true', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DD_APM_ENABLED = 'true';
    process.env.DD_SERVICE = 'test-service';

    await import('../datadog.ts');

    expect(consoleLogSpy).toHaveBeenCalledWith('[DataDog] APM initialized successfully');
  });

  test('initializes APM when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DD_SERVICE = 'prod-service';

    await import('../datadog.ts');

    expect(consoleLogSpy).toHaveBeenCalledWith('[DataDog] APM initialized successfully');
  });

  test('exports tracer as default', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DD_APM_ENABLED = '';

    const datadog = await import('../datadog.ts');

    expect(datadog.default).toBeDefined();
    expect(typeof datadog.default.init).toBe('function');
    expect(typeof datadog.default.use).toBe('function');
  });
});
