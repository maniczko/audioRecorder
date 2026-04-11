import type { logger as loggerType } from '../logger.ts';

type LoggerLike = typeof loggerType;
type ListenErrno = NodeJS.ErrnoException & {
  address?: string;
  port?: number;
};

export function handleServerListenError(
  error: unknown,
  host: string,
  port: number,
  logger: LoggerLike
): { shouldExit: boolean } {
  const errno = error as ListenErrno | null;

  if (errno?.code === 'EADDRINUSE') {
    logger.warn(
      `[Bootstrap] Port ${host}:${port} is already in use. Another VoiceLog server may already be running.`,
      {
        code: errno.code,
        address: errno.address || host,
        port: errno.port || port,
      },
      { sentry: false }
    );

    return { shouldExit: true };
  }

  logger.error('SERVER ERROR:', error);
  return { shouldExit: false };
}
