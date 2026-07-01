import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSentryInit = vi.fn();
const mockCaptureException = vi.fn();
const mockAddBreadcrumb = vi.fn();
const mockScope = {
  setLevel: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
  setFingerprint: vi.fn(),
};
const mockWithScope = vi.fn((callback: (scope: typeof mockScope) => void) => callback(mockScope));

vi.mock('@sentry/node', () => ({
  init: mockSentryInit,
  captureException: mockCaptureException,
  addBreadcrumb: mockAddBreadcrumb,
  withScope: mockWithScope,
}));

// Mock logger to avoid side effects
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe('sentry.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('skips initialization when SENTRY_DSN is not set', async () => {
    const { initSentry } = await import('../sentry.js');
    initSentry();
    expect(mockSentryInit).not.toHaveBeenCalled();
  });

  test('initializes Sentry when DSN is provided', async () => {
    process.env.SENTRY_DSN = 'https://test@o123.ingest.sentry.io/456';
    process.env.RAILWAY_GIT_COMMIT_SHA = 'sha123';
    // NODE_ENV is 'test' in vitest environment
    const { initSentry } = await import('../sentry.js');
    initSentry();
    expect(mockSentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://test@o123.ingest.sentry.io/456',
        tracesSampleRate: 0.1,
        environment: 'test',
        release: 'sha123',
        integrations: expect.any(Function),
      })
    );
  });

  test('uses NODE_ENV for environment', async () => {
    process.env.SENTRY_DSN = 'https://test@o123.ingest.sentry.io/456';
    process.env.NODE_ENV = 'production';
    const { initSentry } = await import('../sentry.js');
    initSentry();
    expect(mockSentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' })
    );
  });

  test('captures exception via captureException', async () => {
    const { captureException } = await import('../sentry.js');
    const err = new Error('test error');
    captureException(err);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
    expect(mockScope.setContext).toHaveBeenCalledWith('audio_pipeline', {});
  });

  test('fails silently when Sentry is not initialized', async () => {
    const { captureException } = await import('../sentry.js');
    expect(() => captureException(new Error('no sentry'))).not.toThrow();
  });

  test('redacts sensitive pipeline context before adding breadcrumbs', async () => {
    const { addPipelineBreadcrumb } = await import('../sentry.js');

    addPipelineBreadcrumb('Pipeline failed', {
      requestId: 'req_1',
      workspaceId: 'ws_1',
      recordingId: 'rec_1',
      accessToken: 'secret-token',
      transcriptJson: 'private transcript',
      audioBuffer: 'binary audio',
    });

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'audio.pipeline',
        data: expect.objectContaining({
          requestId: 'req_1',
          workspaceId: 'ws_1',
          recordingId: 'rec_1',
          accessToken: '[redacted]',
          transcriptJson: '[redacted]',
          audioBuffer: '[redacted]',
        }),
      })
    );
    expect(JSON.stringify(mockAddBreadcrumb.mock.calls[0][0])).not.toContain('private transcript');
  });

  test('captures pipeline exceptions with safe context and searchable tags', async () => {
    const { capturePipelineException } = await import('../sentry.js');
    const err = new Error('STT crashed');

    capturePipelineException(
      err,
      {
        requestId: 'req_2',
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        jobId: 'job_1',
        pipelineStage: 'stt',
        providerId: 'openai',
        errorCode: 'stt_failed',
        segments: [{ text: 'private segment' }],
      },
      { level: 'warning', fingerprint: ['audio-pipeline', 'stt_failed'] }
    );

    expect(mockScope.setLevel).toHaveBeenCalledWith('warning');
    expect(mockScope.setContext).toHaveBeenCalledWith(
      'audio_pipeline',
      expect.objectContaining({
        requestId: 'req_2',
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        jobId: 'job_1',
        pipelineStage: 'stt',
        providerId: 'openai',
        errorCode: 'stt_failed',
        segments: '[redacted]',
      })
    );
    expect(mockScope.setTag).toHaveBeenCalledWith('recordingId', 'rec_1');
    expect(mockScope.setFingerprint).toHaveBeenCalledWith(['audio-pipeline', 'stt_failed']);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });
});
