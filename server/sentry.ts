import * as Sentry from '@sentry/node';
import { logger } from './logger.js';
import {
  sanitizeSentryContext,
  sentryTagsFromContext,
  type AudioPipelineSentryContext,
  type SentryCaptureOptions,
  type SentryContextLevel,
} from './lib/sentryContext.ts';
import { resolveBuildMetadata } from './runtime.js';
import { appendTraceContext } from './tracing.ts';

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
      release: resolveBuildMetadata().gitSha,
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

export function captureException(error: Error, context?: AudioPipelineSentryContext) {
  try {
    capturePipelineException(error, context);
  } catch (err) {
    // Fail silently if Sentry is not initialized
  }
}

export function addBreadcrumb(breadcrumb: Parameters<typeof Sentry.addBreadcrumb>[0]) {
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch (err) {
    // Fail silently if Sentry is not initialized
  }
}

export function addPipelineBreadcrumb(
  message: string,
  context: AudioPipelineSentryContext = {},
  options: {
    category?: string;
    level?: SentryContextLevel;
  } = {}
) {
  addBreadcrumb({
    category: options.category || 'audio.pipeline',
    level: options.level || 'info',
    message,
    data: sanitizeSentryContext(appendTraceContext(context)),
  });
}

export function capturePipelineException(
  error: unknown,
  context: AudioPipelineSentryContext = {},
  options: SentryCaptureOptions = {}
) {
  try {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const sanitizedContext = sanitizeSentryContext(appendTraceContext(context));
    Sentry.withScope((scope) => {
      scope.setLevel(options.level || (sanitizedContext.retryable ? 'warning' : 'error'));
      scope.setContext('audio_pipeline', sanitizedContext);
      for (const [key, value] of Object.entries(sentryTagsFromContext(sanitizedContext))) {
        scope.setTag(key, value);
      }
      if (options.fingerprint?.length) {
        scope.setFingerprint(options.fingerprint);
      }
      Sentry.captureException(normalizedError);
    });
  } catch (err) {
    // Fail silently if Sentry is not initialized
  }
}

export { sanitizeSentryContext };
