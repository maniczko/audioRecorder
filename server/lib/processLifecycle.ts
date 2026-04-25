import type { Server } from 'node:http';
import type { logger as loggerType } from '../logger.ts';

type LoggerLike = typeof loggerType;
type TimerLike = ReturnType<typeof setTimeout>;

interface ShutdownDatabase {
  shutdown?: () => Promise<void>;
  pool?: {
    end?: () => Promise<void>;
  };
}

interface GracefulShutdownOptions {
  server: Pick<Server, 'close'> & Partial<Pick<Server, 'closeAllConnections'>>;
  db?: ShutdownDatabase;
  cleanupTimer?: TimerLike | { unref?: () => void };
  logger: LoggerLike;
  exit?: (code: number) => void;
  setForceExitTimeout?: typeof setTimeout;
  clearForceExitTimeout?: typeof clearTimeout;
  clearCleanupTimer?: (timer: NonNullable<GracefulShutdownOptions['cleanupTimer']>) => void;
  forceExitTimeoutMs?: number;
}

type ShutdownFunction = (signal: string, exitCode?: number) => Promise<void>;

interface ProcessLike {
  pid: number;
  uptime: () => number;
  on: (
    event: 'uncaughtException' | 'unhandledRejection',
    listener: (reason: unknown) => Promise<void> | void
  ) => unknown;
}

interface FatalProcessHandlerOptions {
  logger: LoggerLike;
  shutdown: ShutdownFunction;
}

function closeServer(server: GracefulShutdownOptions['server']) {
  return new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function clearTimer(timer: unknown) {
  clearTimeout(timer as TimerLike);
}

async function shutdownDatabase(db: ShutdownDatabase | undefined) {
  if (!db) return false;
  if (typeof db.shutdown === 'function') {
    await db.shutdown();
    return true;
  }
  if (typeof db.pool?.end === 'function') {
    await db.pool.end();
    return true;
  }
  return false;
}

export function normalizeProcessFailureReason(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error(String(reason));
}

export function createGracefulShutdown({
  server,
  db,
  cleanupTimer,
  logger,
  exit = process.exit,
  setForceExitTimeout = setTimeout,
  clearForceExitTimeout = clearTimer,
  clearCleanupTimer = clearTimer,
  forceExitTimeoutMs = 20_000,
}: GracefulShutdownOptions): ShutdownFunction {
  let shutdownStarted = false;

  return async (signal: string, exitCode = 0) => {
    if (shutdownStarted) {
      logger.warn(`[Process] Shutdown already in progress. Ignoring ${signal}.`);
      return;
    }

    shutdownStarted = true;
    logger.info(`[Process] Received ${signal}. Starting graceful shutdown...`);

    const forceExit = setForceExitTimeout(() => {
      logger.error('[Process] Shutdown timed out. Force exiting.');
      try {
        server.closeAllConnections?.();
      } catch (error) {
        logger.warn('[Process] Failed to close HTTP connections during forced shutdown:', error);
      }
      exit(1);
    }, forceExitTimeoutMs);
    forceExit.unref?.();

    try {
      if (cleanupTimer) {
        clearCleanupTimer(cleanupTimer);
      }

      await closeServer(server);
      logger.info('[Process] HTTP server closed.');

      const databaseWasClosed = await shutdownDatabase(db);
      if (databaseWasClosed) {
        logger.info('[Process] Database shutdown complete.');
      }

      clearForceExitTimeout(forceExit);
      logger.info('[Process] Graceful shutdown complete.');
      exit(exitCode);
    } catch (error) {
      clearForceExitTimeout(forceExit);
      logger.error('[Process] Error during shutdown:', error);
      exit(1);
    }
  };
}

export function registerFatalProcessHandlers(
  processLike: ProcessLike,
  { logger, shutdown }: FatalProcessHandlerOptions
) {
  const handleFatal = async (
    event: 'uncaughtException' | 'unhandledRejection',
    reason: unknown
  ) => {
    const error = normalizeProcessFailureReason(reason);
    logger.error(
      `[Process] Fatal ${event}; pid=${processLike.pid}; uptime=${processLike.uptime().toFixed(1)}s. Starting graceful shutdown.`,
      error
    );

    try {
      await shutdown(event, 1);
    } catch (shutdownError) {
      logger.error('[Process] Fatal shutdown failed:', shutdownError);
    }
  };

  processLike.on('uncaughtException', (error) => handleFatal('uncaughtException', error));
  processLike.on('unhandledRejection', (reason) => handleFatal('unhandledRejection', reason));
}
