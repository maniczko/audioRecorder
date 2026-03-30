import { logger } from './logger.js';

let Sentry: typeof import('@sentry/node') | null = null;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('[Sentry] No DSN provided, skipping initialization.');
    return;
  }

  try {
    // Dynamic import to avoid loading native modules when not needed
    Sentry = require('@sentry/node');

    Sentry!.init({
      dsn,
      tracesSampleRate: 0.2,
      environment: process.env.NODE_ENV || 'development',
    });

    logger.info(`[Sentry] Initialized for environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err: any) {
    logger.warn(`[Sentry] Failed to initialize: ${err.message}`);
  }
}

export function captureException(error: Error) {
  if (Sentry) {
    Sentry.captureException(error);
  }
}
