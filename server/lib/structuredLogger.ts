/**
 * Structured JSON Logger
 *
 * Replaces console.log/warn/error with structured JSON output
 * for better observability in production (log aggregation, filtering, alerting).
 *
 * Usage:
 *   import { logger } from './lib/structuredLogger.ts';
 *   logger.info('Server started', { port: 4000, env: 'production' });
 *   logger.error('Database connection failed', { error: err.message, code: err.code });
 *
 * Output format:
 *   {"level":"info","timestamp":"2026-04-04T12:00:00.000Z","message":"Server started","data":{"port":4000,"env":"production"}}
 */

import { format } from 'node:util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
  requestId?: string;
  service?: string;
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'voicelog-server';

function formatLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
  return JSON.stringify(entry);
}

/**
 * Structured logger that outputs JSON logs in production
 * and human-readable logs in development.
 */
export const structuredLogger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.LOG_LEVEL === 'debug') {
      if (process.env.NODE_ENV === 'production') {
        process.stdout.write(formatLogEntry('debug', message, data) + '\n');
      } else {
        console.debug(`[DEBUG] ${message}`, data ? format(data) : '');
      }
    }
  },

  info(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
      process.stdout.write(formatLogEntry('info', message, data) + '\n');
    } else {
      console.log(`[INFO] ${message}`, data ? format(data) : '');
    }
  },

  warn(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
      process.stderr.write(formatLogEntry('warn', message, data) + '\n');
    } else {
      console.warn(`[WARN] ${message}`, data ? format(data) : '');
    }
  },

  error(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
      process.stderr.write(formatLogEntry('error', message, data) + '\n');
    } else {
      console.error(`[ERROR] ${message}`, data ? format(data) : '');
    }
  },

  /**
   * Create a child logger with default context (e.g., requestId).
   */
  child(context: Record<string, unknown>) {
    return {
      debug: (msg: string, data?: Record<string, unknown>) =>
        this.debug(msg, { ...context, ...data }),
      info: (msg: string, data?: Record<string, unknown>) =>
        this.info(msg, { ...context, ...data }),
      warn: (msg: string, data?: Record<string, unknown>) =>
        this.warn(msg, { ...context, ...data }),
      error: (msg: string, data?: Record<string, unknown>) =>
        this.error(msg, { ...context, ...data }),
    };
  },
};

export default structuredLogger;
