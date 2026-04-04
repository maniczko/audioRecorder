import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('structuredLogger.ts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('info', () => {
    test('logs info message with data in development', async () => {
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.info('Server started', { port: 4000 });

      expect(logSpy).toHaveBeenCalled();
    });

    test('logs info message as JSON in production', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.info('Server started', { port: 4000 });

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Server started');
      expect(parsed.data).toEqual({ port: 4000 });
      expect(parsed).toHaveProperty('timestamp');
    });
  });

  describe('warn', () => {
    test('logs warning in development', async () => {
      process.env.NODE_ENV = 'development';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.warn('Deprecated API used');

      expect(warnSpy).toHaveBeenCalled();
    });

    test('logs warning as JSON in production', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.warn('Deprecated API used', { endpoint: '/v1/old' });

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('warn');
      expect(parsed.message).toBe('Deprecated API used');
    });
  });

  describe('error', () => {
    test('logs error in development', async () => {
      process.env.NODE_ENV = 'development';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.error('Something broke', { code: 'ERR_001' });

      expect(errorSpy).toHaveBeenCalled();
    });

    test('logs error as JSON in production', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.error('Database error', { code: 'DB_CONN_FAILED' });

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Database error');
      expect(parsed.data).toEqual({ code: 'DB_CONN_FAILED' });
    });
  });

  describe('debug', () => {
    test('does not log when LOG_LEVEL is not debug', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.debug('Verbose debug info');

      expect(debugSpy).not.toHaveBeenCalled();
    });

    test('logs debug when LOG_LEVEL=debug', async () => {
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'debug';
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.debug('Verbose debug info');

      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('child logger', () => {
    test('child logger inherits context', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      const child = structuredLogger.child({ requestId: 'req-123' });
      child.info('Processing request');

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed.data).toEqual({ requestId: 'req-123' });
    });

    test('child logger merges additional data', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      const child = structuredLogger.child({ requestId: 'req-123' });
      child.info('User action', { userId: 'u1' });

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed.data).toEqual({ requestId: 'req-123', userId: 'u1' });
    });
  });

  describe('empty data handling', () => {
    test('omits data field when empty object passed', async () => {
      process.env.NODE_ENV = 'production';
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const { structuredLogger } = await import('../lib/structuredLogger.js');

      structuredLogger.info('Simple message');

      expect(writeSpy).toHaveBeenCalled();
      const output = (writeSpy.mock.calls[0][0] as string).trim();
      const parsed = JSON.parse(output);
      expect(parsed).not.toHaveProperty('data');
    });
  });
});
