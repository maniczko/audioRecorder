import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => {
  const scope = {
    setLevel: vi.fn(),
    setContext: vi.fn(),
    setTag: vi.fn(),
    setFingerprint: vi.fn(),
  };

  return {
    init: vi.fn(),
    browserTracingIntegration: vi.fn(() => ({ name: 'browser-tracing' })),
    replayIntegration: vi.fn(() => ({ name: 'replay' })),
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
    scope,
    withScope: vi.fn((callback: (scope: unknown) => void) => {
      callback(scope);
    }),
  };
});

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

    expect(infoSpy).not.toHaveBeenCalled();
    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the configured DSN and environment', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/0');
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_BUILD_ID', 'ABC123');

    const { initSentry } = await import('./sentry');
    initSentry();

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
        release: 'abc123',
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

  it('redacts sensitive queue context before sending breadcrumbs', async () => {
    const { addQueueBreadcrumb } = await import('./sentry');

    addQueueBreadcrumb('Queue failed', {
      workspaceId: 'ws_1',
      recordingId: 'rec_1',
      accessToken: 'secret-token',
      transcript: 'private transcript',
      audioBuffer: 'binary audio',
    });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'recording.queue',
        data: expect.objectContaining({
          workspaceId: 'ws_1',
          recordingId: 'rec_1',
          accessToken: '[redacted]',
          transcript: '[redacted]',
          audioBuffer: '[redacted]',
        }),
      })
    );
    expect(JSON.stringify(sentryMocks.addBreadcrumb.mock.calls[0][0])).not.toContain(
      'private transcript'
    );
  });

  it('captures queue exceptions with safe context and searchable tags', async () => {
    const { captureQueueException } = await import('./sentry');
    const error = new Error('Upload crashed');

    captureQueueException(
      error,
      {
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        pipelineStage: 'upload',
        errorCode: 'upload_failed',
        segments: [{ text: 'private segment' }],
      },
      { level: 'warning', fingerprint: ['recording-queue', 'upload_failed'] }
    );

    expect(sentryMocks.scope.setLevel).toHaveBeenCalledWith('warning');
    expect(sentryMocks.scope.setContext).toHaveBeenCalledWith(
      'recording_queue',
      expect.objectContaining({
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        pipelineStage: 'upload',
        errorCode: 'upload_failed',
        segments: '[redacted]',
      })
    );
    expect(sentryMocks.scope.setTag).toHaveBeenCalledWith('recordingId', 'rec_1');
    expect(sentryMocks.scope.setFingerprint).toHaveBeenCalledWith([
      'recording-queue',
      'upload_failed',
    ]);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
  });
});
