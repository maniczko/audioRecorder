import { describe, expect, test, vi } from 'vitest';
import {
  createGracefulShutdown,
  normalizeProcessFailureReason,
  registerFatalProcessHandlers,
} from '../../lib/processLifecycle.ts';

describe('process lifecycle policy', () => {
  test('closes HTTP server, stops cleanup timer, shuts down database, then exits', async () => {
    const events: string[] = [];
    const cleanupTimer = { unref: vi.fn() };
    const logger = {
      info: vi.fn((message: string) => events.push(message)),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) => {
        events.push('server.close');
        callback?.();
        return server;
      }),
    };
    const db = {
      shutdown: vi.fn(async () => {
        events.push('db.shutdown');
      }),
    };
    const clearCleanupTimer = vi.fn((timer: typeof cleanupTimer) => {
      expect(timer).toBe(cleanupTimer);
      events.push('cleanupTimer.clear');
    });
    const exit = vi.fn((code: number) => {
      events.push(`exit:${code}`);
    });

    const shutdown = createGracefulShutdown({
      server,
      db,
      cleanupTimer,
      logger,
      clearCleanupTimer,
      exit,
      forceExitTimeoutMs: 100,
    });

    await shutdown('SIGTERM', 0);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(db.shutdown).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      '[Process] Received SIGTERM. Starting graceful shutdown...',
      'cleanupTimer.clear',
      'server.close',
      '[Process] HTTP server closed.',
      'db.shutdown',
      '[Process] Database shutdown complete.',
      '[Process] Graceful shutdown complete.',
      'exit:0',
    ]);
  });

  test('keeps shutdown idempotent when multiple signals arrive', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) => {
        callback?.();
        return server;
      }),
    };
    const db = {
      shutdown: vi.fn(async () => {}),
    };
    const exit = vi.fn();
    const shutdown = createGracefulShutdown({
      server,
      db,
      logger,
      exit,
      forceExitTimeoutMs: 100,
    });

    await shutdown('SIGTERM', 0);
    await shutdown('SIGINT', 0);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(db.shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Process] Shutdown already in progress. Ignoring SIGINT.'
    );
  });

  test('normalizes non-Error rejection reasons into Error instances', () => {
    const normalized = normalizeProcessFailureReason('database promise rejected');

    expect(normalized).toBeInstanceOf(Error);
    expect(normalized.message).toBe('database promise rejected');
  });

  test('fatal process handlers log context and exit through graceful shutdown', async () => {
    const listeners: Record<string, (...args: unknown[]) => Promise<void> | void> = {};
    const processLike = {
      pid: 1234,
      uptime: vi.fn(() => 42.5),
      on: vi.fn((event: string, listener: (...args: unknown[]) => Promise<void> | void) => {
        listeners[event] = listener;
        return processLike;
      }),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const shutdown = vi.fn(async () => {});
    const error = new Error('boom');

    registerFatalProcessHandlers(processLike, { logger, shutdown });
    await listeners.uncaughtException(error);

    expect(processLike.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    expect(processLike.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    expect(logger.error).toHaveBeenCalledWith(
      '[Process] Fatal uncaughtException; pid=1234; uptime=42.5s. Starting graceful shutdown.',
      error
    );
    expect(shutdown).toHaveBeenCalledWith('uncaughtException', 1);
  });

  test('fatal process handlers normalize unhandled rejection reasons', async () => {
    const listeners: Record<string, (...args: unknown[]) => Promise<void> | void> = {};
    const processLike = {
      pid: 4321,
      uptime: vi.fn(() => 7),
      on: vi.fn((event: string, listener: (...args: unknown[]) => Promise<void> | void) => {
        listeners[event] = listener;
        return processLike;
      }),
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const shutdown = vi.fn(async () => {});

    registerFatalProcessHandlers(processLike, { logger, shutdown });
    await listeners.unhandledRejection('promise failed');

    expect(logger.error).toHaveBeenCalledWith(
      '[Process] Fatal unhandledRejection; pid=4321; uptime=7.0s. Starting graceful shutdown.',
      expect.objectContaining({ message: 'promise failed' })
    );
    expect(shutdown).toHaveBeenCalledWith('unhandledRejection', 1);
  });
});
