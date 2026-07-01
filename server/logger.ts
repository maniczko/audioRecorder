// Sentry is initialized in sentry.ts via initSentry() - no duplicate init here.
// Lazy-load @sentry/node to avoid pulling ~25MB into memory at startup.
import {
  sanitizeSentryContext,
  sentryTagsFromContext,
  type AudioPipelineSentryContext,
  type SentryContextLevel,
} from './lib/sentryContext.ts';
import { structuredLogger } from './lib/structuredLogger.ts';

let _Sentry: any = null;
let _sentryLoading: Promise<any> | null = null;

interface LoggerOptions {
  sentry?: boolean;
  sentryContext?: AudioPipelineSentryContext;
  sentryLevel?: SentryContextLevel;
  fingerprint?: string[];
}

async function getSentryAsync(): Promise<any> {
  if (_Sentry) return _Sentry;
  if (!process.env.SENTRY_DSN) return null;
  if (!_sentryLoading) {
    _sentryLoading = import('@sentry/node')
      .then((mod) => {
        _Sentry = mod;
        return mod;
      })
      .catch(() => null);
  }
  return _sentryLoading;
}

function resolveSentryContext(data: unknown, options: LoggerOptions) {
  if (options.sentryContext) return sanitizeSentryContext(options.sentryContext);
  if (data && typeof data === 'object' && !(data instanceof Error) && !Array.isArray(data)) {
    return sanitizeSentryContext(data as AudioPipelineSentryContext);
  }
  return {};
}

function captureWithContext(
  sentry: any,
  action: (scope: any) => void,
  context: Record<string, unknown>,
  options: LoggerOptions
) {
  if (!sentry?.withScope) {
    action(null);
    return;
  }
  sentry.withScope((scope: any) => {
    if (options.sentryLevel) scope.setLevel(options.sentryLevel);
    if (Object.keys(context).length > 0) {
      scope.setContext('audio_pipeline', context);
      for (const [key, value] of Object.entries(sentryTagsFromContext(context))) {
        scope.setTag(key, value);
      }
    }
    if (options.fingerprint?.length) {
      scope.setFingerprint(options.fingerprint);
    }
    action(scope);
  });
}

export const logger = {
  info: (msg: string, meta: any = {}) => {
    structuredLogger.info(msg, meta);
  },
  warn: (msg: string, meta: any = {}, options: LoggerOptions = {}) => {
    structuredLogger.warn(msg, meta);
    if (process.env.SENTRY_DSN && options.sentry !== false) {
      const context = resolveSentryContext(meta, options);
      getSentryAsync().then((s) => {
        if (!s) return;
        captureWithContext(
          s,
          () => s.captureMessage(msg, options.sentryLevel || 'warning'),
          context,
          options
        );
      });
    }
  },
  error: (msg: string, err: any = null, options: LoggerOptions = {}) => {
    structuredLogger.error(msg, err);
    if (process.env.SENTRY_DSN && options.sentry !== false) {
      const context = resolveSentryContext(err, options);
      getSentryAsync().then((s) => {
        if (!s) return;
        captureWithContext(
          s,
          () => {
            if (err instanceof Error) {
              s.captureException(err);
            } else {
              s.captureMessage(msg, options.sentryLevel || 'error');
            }
          },
          context,
          options
        );
      });
    }
  },
};
