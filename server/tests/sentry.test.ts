import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSentryInit = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@sentry/node', () => ({
  init: mockSentryInit,
  captureException: mockCaptureException,
}));

// Mock logger to avoid side effects
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe('sentry.ts', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SENTRY_DSN;
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
    // NODE_ENV is 'test' in vitest environment
    const { initSentry } = await import('../sentry.js');
    initSentry();
    expect(mockSentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://test@o123.ingest.sentry.io/456',
        tracesSampleRate: 0.1,
        environment: 'test',
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
  });

  test('fails silently when Sentry is not initialized', async () => {
    const { captureException } = await import('../sentry.js');
    expect(() => captureException(new Error('no sentry'))).not.toThrow();
  });
});
