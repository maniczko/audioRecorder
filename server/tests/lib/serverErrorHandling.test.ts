import { describe, expect, test, vi } from 'vitest';
import { handleServerListenError } from '../../lib/serverErrorHandling.ts';

describe('handleServerListenError', () => {
  test('Regression: #0 — EADDRINUSE is treated as local startup noise and not sent to Sentry', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    const result = handleServerListenError(
      Object.assign(new Error('listen EADDRINUSE'), {
        code: 'EADDRINUSE',
        address: '127.0.0.1',
        port: 4000,
      }),
      '127.0.0.1',
      4000,
      logger
    );

    expect(result).toEqual({ shouldExit: true });
    expect(logger.warn).toHaveBeenCalledWith(
      '[Bootstrap] Port 127.0.0.1:4000 is already in use. Another VoiceLog server may already be running.',
      {
        code: 'EADDRINUSE',
        address: '127.0.0.1',
        port: 4000,
      },
      { sentry: false }
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('passes unknown server errors through to logger.error', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
    const error = new Error('socket exploded');

    const result = handleServerListenError(error, '0.0.0.0', 4000, logger);

    expect(result).toEqual({ shouldExit: false });
    expect(logger.error).toHaveBeenCalledWith('SERVER ERROR:', error);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('Regression: #0 — missing listen address metadata falls back to requested host and port', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    const result = handleServerListenError(
      Object.assign(new Error('listen EADDRINUSE'), {
        code: 'EADDRINUSE',
      }),
      '0.0.0.0',
      4100,
      logger
    );

    expect(result).toEqual({ shouldExit: true });
    expect(logger.warn).toHaveBeenCalledWith(
      '[Bootstrap] Port 0.0.0.0:4100 is already in use. Another VoiceLog server may already be running.',
      {
        code: 'EADDRINUSE',
        address: '0.0.0.0',
        port: 4100,
      },
      { sentry: false }
    );
  });
});
