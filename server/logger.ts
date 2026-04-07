// Sentry is initialized in sentry.ts via initSentry() — no duplicate init here.
// Lazy-load @sentry/node to avoid pulling ~25MB into memory at startup.
let _Sentry: any = null;
let _sentryLoading: Promise<any> | null = null;

interface LoggerOptions {
  sentry?: boolean;
}

// Async version for when we need guaranteed Sentry access
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

export const logger = {
  info: (msg: string, meta: any = {}) => {
    console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : '');
  },
  warn: (msg: string, meta: any = {}, options: LoggerOptions = {}) => {
    console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? meta : '');
    if (process.env.SENTRY_DSN && options.sentry !== false) {
      getSentryAsync().then((s) => s?.captureMessage(msg, 'warning'));
    }
  },
  error: (msg: string, err: any = null, options: LoggerOptions = {}) => {
    console.error(`[ERROR] ${msg}`, err || '');
    if (process.env.SENTRY_DSN && options.sentry !== false) {
      getSentryAsync().then((s) => {
        if (err instanceof Error) {
          s?.captureException(err);
        } else {
          s?.captureMessage(msg, 'error');
        }
      });
    }
  },
};
