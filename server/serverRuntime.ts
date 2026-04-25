import type { Server } from 'node:http';
import type { logger as loggerType } from './logger.ts';
import { handleServerListenError } from './lib/serverErrorHandling.ts';
import { createGracefulShutdown, registerFatalProcessHandlers } from './lib/processLifecycle.ts';
import { startPeriodicTempCleanup } from './lib/periodicCleanup.ts';

type LoggerLike = typeof loggerType;
type TimerLike = ReturnType<typeof setInterval>;
type ShutdownFunction = (signal: string, exitCode?: number) => Promise<void>;

interface RuntimeDatabaseLike {
  shutdown?: () => Promise<void>;
}

interface RuntimeProcessLike {
  pid: number;
  uptime: () => number;
  on: (
    event: 'uncaughtException' | 'unhandledRejection' | 'SIGTERM' | 'SIGINT',
    listener: (reason?: unknown) => Promise<void> | void
  ) => unknown;
}

interface StartVoiceLogServerOptions {
  server: Server;
  db: RuntimeDatabaseLike;
  host: string;
  port: number;
  uploadDir: string;
  logger: LoggerLike;
  processLike?: RuntimeProcessLike;
  exit?: (code: number) => void;
  startPeriodicCleanup?: (options: { uploadDir: string; logger: LoggerLike }) => TimerLike;
  createShutdown?: typeof createGracefulShutdown;
  registerFatalHandlers?: typeof registerFatalProcessHandlers;
  handleListenError?: typeof handleServerListenError;
}

export function startVoiceLogServer({
  server,
  db,
  host,
  port,
  uploadDir,
  logger,
  processLike = process,
  exit = process.exit,
  startPeriodicCleanup = startPeriodicTempCleanup,
  createShutdown = createGracefulShutdown,
  registerFatalHandlers = registerFatalProcessHandlers,
  handleListenError = handleServerListenError,
}: StartVoiceLogServerOptions): { cleanupTimer: TimerLike; shutdown: ShutdownFunction } {
  logger.info(`Attempting to listen on ${host}:${port}...`);

  server.on('error', async (error) => {
    const result = handleListenError(error, host, port, logger);
    if (!result.shouldExit) {
      return;
    }

    try {
      await db.shutdown?.();
    } catch (_) {
      // Best effort shutdown to avoid leaving workers around on failed boot.
    }
    exit(1);
  });

  server.listen(port, host, () => {
    logger.info(`VoiceLog API listening on http://${host}:${port} (test-ready architecture)`);
  });

  const cleanupTimer = startPeriodicCleanup({ uploadDir, logger });
  const shutdown = createShutdown({
    server,
    db,
    cleanupTimer,
    logger,
    exit,
  });

  registerFatalHandlers(processLike, { logger, shutdown });
  processLike.on('SIGTERM', () => void shutdown('SIGTERM', 0));
  processLike.on('SIGINT', () => void shutdown('SIGINT', 0));

  return { cleanupTimer, shutdown };
}
