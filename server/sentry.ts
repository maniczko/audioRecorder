import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { config } from './config.js';
import { logger } from './logger.js';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN || config.SENTRY_DSN;

  if (!dsn) {
    logger.info('[Sentry] No DSN provided, skipping initialization.');
    return;
  }

  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    environment: config.NODE_ENV || 'development',
  });

  logger.info(`[Sentry] Initialized for environment: ${config.NODE_ENV || 'development'}`);
}
