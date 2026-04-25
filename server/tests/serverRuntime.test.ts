import { describe, expect, test, vi } from 'vitest';
import type { Server } from 'node:http';
import type { logger as loggerType } from '../logger.ts';
import { createGracefulShutdown, registerFatalProcessHandlers } from '../lib/processLifecycle.ts';
import { handleServerListenError } from '../lib/serverErrorHandling.ts';
import { startVoiceLogServer } from '../serverRuntime.ts';

type LoggerLike = typeof loggerType;

function createLogger(): LoggerLike {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as LoggerLike;
}

function createServerDouble() {
  const listeners: Record<string, (error?: unknown) => Promise<void> | void> = {};
  const server = {
    on: vi.fn((event: string, listener: (error?: unknown) => Promise<void> | void) => {
      listeners[event] = listener;
      return server;
    }),
    listen: vi.fn((port: number, host: string, callback?: () => void) => {
      callback?.();
      return server;
    }),
    close: vi.fn((callback?: () => void) => {
      callback?.();
      return server;
    }),
  } as unknown as Server;

  return { server, listeners };
}

function createProcessDouble() {
  const listeners: Record<string, (reason?: unknown) => Promise<void> | void> = {};
  const processLike = {
    pid: 1234,
    uptime: vi.fn(() => 42),
    on: vi.fn((event: string, listener: (reason?: unknown) => Promise<void> | void) => {
      listeners[event] = listener;
      return processLike;
    }),
  };

  return { processLike, listeners };
}

describe('server runtime startup', () => {
  test('starts listening, starts cleanup, and registers shutdown handlers', () => {
    const logger = createLogger();
    const { server } = createServerDouble();
    const { processLike } = createProcessDouble();
    const cleanupTimer = { unref: vi.fn() } as ReturnType<typeof setInterval>;
    const shutdown = vi.fn(async () => {});
    const startPeriodicCleanup = vi.fn(() => cleanupTimer);
    const createShutdown = vi.fn(() => shutdown) as unknown as typeof createGracefulShutdown;
    const registerFatalHandlers = vi.fn() as unknown as typeof registerFatalProcessHandlers;

    const result = startVoiceLogServer({
      server,
      db: {},
      host: '127.0.0.1',
      port: 4000,
      uploadDir: '/tmp/uploads',
      logger,
      processLike,
      startPeriodicCleanup,
      createShutdown,
      registerFatalHandlers,
    });

    expect(server.listen).toHaveBeenCalledWith(4000, '127.0.0.1', expect.any(Function));
    expect(startPeriodicCleanup).toHaveBeenCalledWith({ uploadDir: '/tmp/uploads', logger });
    expect(createShutdown).toHaveBeenCalledWith({
      server,
      db: {},
      cleanupTimer,
      logger,
      exit: expect.any(Function),
    });
    expect(registerFatalHandlers).toHaveBeenCalledWith(processLike, { logger, shutdown });
    expect(processLike.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processLike.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(result).toEqual({ cleanupTimer, shutdown });
  });

  test('shuts down the database and exits when listen error is terminal', async () => {
    const logger = createLogger();
    const { server, listeners } = createServerDouble();
    const { processLike } = createProcessDouble();
    const db = { shutdown: vi.fn(async () => {}) };
    const exit = vi.fn();
    const cleanupTimer = { unref: vi.fn() } as ReturnType<typeof setInterval>;

    startVoiceLogServer({
      server,
      db,
      host: '0.0.0.0',
      port: 4000,
      uploadDir: '/tmp/uploads',
      logger,
      processLike,
      exit,
      startPeriodicCleanup: vi.fn(() => cleanupTimer),
      createShutdown: vi.fn(() =>
        vi.fn(async () => {})
      ) as unknown as typeof createGracefulShutdown,
      registerFatalHandlers: vi.fn() as unknown as typeof registerFatalProcessHandlers,
      handleListenError: vi.fn(() => ({
        shouldExit: true,
      })) as unknown as typeof handleServerListenError,
    });

    await listeners.error?.(new Error('address in use'));

    expect(db.shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('keeps running when listen error is non-terminal', async () => {
    const logger = createLogger();
    const { server, listeners } = createServerDouble();
    const { processLike } = createProcessDouble();
    const db = { shutdown: vi.fn(async () => {}) };
    const exit = vi.fn();
    const cleanupTimer = { unref: vi.fn() } as ReturnType<typeof setInterval>;

    startVoiceLogServer({
      server,
      db,
      host: '0.0.0.0',
      port: 4000,
      uploadDir: '/tmp/uploads',
      logger,
      processLike,
      exit,
      startPeriodicCleanup: vi.fn(() => cleanupTimer),
      createShutdown: vi.fn(() =>
        vi.fn(async () => {})
      ) as unknown as typeof createGracefulShutdown,
      registerFatalHandlers: vi.fn() as unknown as typeof registerFatalProcessHandlers,
      handleListenError: vi.fn(() => ({
        shouldExit: false,
      })) as unknown as typeof handleServerListenError,
    });

    await listeners.error?.(new Error('socket warning'));

    expect(db.shutdown).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
