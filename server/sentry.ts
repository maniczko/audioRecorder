import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('[Sentry] No DSN provided, skipping initialization.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1, // Reduced sample rate to save memory/bandwidth
      environment: process.env.NODE_ENV || 'development',
      // Disable automatic console capturing — our logger handles Sentry
      // reporting explicitly via { sentry: true/false } options.
      // Without this, console.warn() calls bypass our sentry:false flag
      // and generate noise (e.g. EADDRINUSE, legacy file cleanup warnings).
      integrations: (defaults) => defaults.filter((i) => i.name !== 'Console'),
    });

    logger.info(`[Sentry] Initialized for environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err: any) {
    logger.warn(`[Sentry] Failed to initialize: ${err.message}`);
  }
}

export function captureException(error: Error) {
  try {
    Sentry.captureException(error);
  } catch (err) {
    // Fail silently if Sentry is not initialized
  }
}
