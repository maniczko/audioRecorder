import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCaptureMessage = vi.fn();
const mockCaptureException = vi.fn();

vi.mock('@sentry/node', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}));

describe('logger.ts', () => {
  let originalSentryDsn: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalSentryDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockCaptureMessage.mockReset();
    mockCaptureException.mockReset();
    if (originalSentryDsn !== undefined) {
      process.env.SENTRY_DSN = originalSentryDsn;
    } else {
      delete process.env.SENTRY_DSN;
    }
  });

  test('logs info messages to console.log', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.info('hello world');
    expect(logSpy).toHaveBeenCalledWith('[INFO] hello world', '');
  });

  test('logs info messages with metadata', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.info('hello', { key: 'value' });
    expect(logSpy).toHaveBeenCalledWith('[INFO] hello', { key: 'value' });
  });

  test('logs warn messages to console.warn', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.warn('warning msg');
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warning msg', '');
  });

  test('logs warn with metadata', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.warn('warning', { detail: true });
    expect(warnSpy).toHaveBeenCalledWith('[WARN] warning', { detail: true });
  });

  test('logs error messages to console.error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.error('error msg');
    expect(errSpy).toHaveBeenCalledWith('[ERROR] error msg', '');
  });

  test('logs error with Error object', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    const err = new Error('test error');
    logger.error('error msg', err);
    expect(errSpy).toHaveBeenCalledWith('[ERROR] error msg', err);
  });

  test('logs error with non-Error value', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');
    logger.error('error msg', 'string error');
    expect(errSpy).toHaveBeenCalledWith('[ERROR] error msg', 'string error');
  });

  test('does not call Sentry when SENTRY_DSN not set', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.SENTRY_DSN;
    const { logger } = await import('../logger.ts');
    logger.error('fail');
    logger.warn('careful');
    expect(errSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  test('can suppress warn forwarding to Sentry for expected operational fallbacks', async () => {
    process.env.SENTRY_DSN = 'https://test@o123.ingest.sentry.io/456';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');

    logger.warn('fallback warning', { source: 'storage' }, { sentry: false });

    await Promise.resolve();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  test('can suppress error forwarding to Sentry when only local logging is desired', async () => {
    process.env.SENTRY_DSN = 'https://test@o123.ingest.sentry.io/456';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logger } = await import('../logger.ts');

    logger.error('non-actionable error', null, { sentry: false });

    await Promise.resolve();
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
