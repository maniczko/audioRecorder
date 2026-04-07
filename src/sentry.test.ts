import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'browser-tracing' })),
  replayIntegration: vi.fn(() => ({ name: 'replay' })),
}));

vi.mock('@sentry/react', () => sentryMocks);

describe('initSentry', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips initialization when DSN is missing', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.stubEnv('VITE_SENTRY_DSN', '');
    vi.stubEnv('MODE', 'test');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(infoSpy).toHaveBeenCalledWith(
      '[Sentry] No DSN provided, skipping frontend initialization.'
    );
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured DSN and environment', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('MODE', 'production');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
      })
    );
  });

  it('registers browser tracing integration', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('MODE', 'production');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(sentryMocks.browserTracingIntegration).toHaveBeenCalledTimes(1);
  });

  it('registers replay integration', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('MODE', 'production');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(sentryMocks.replayIntegration).toHaveBeenCalledTimes(1);
  });

  it('uses the expected frontend sampling configuration', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('MODE', 'preview');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [{ name: 'browser-tracing' }, { name: 'replay' }],
      })
    );
  });
});
