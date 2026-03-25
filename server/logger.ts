import * as Sentry from '@sentry/node';
import { config } from './config.ts';

const IS_PROD = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';

if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    debug: !IS_PROD,
  });
}

export const logger = {
  info: (msg: string, meta: any = {}) => {
    console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : '');
  },
  warn: (msg: string, meta: any = {}) => {
    console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? meta : '');
    if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(msg, 'warning');
    }
  },
  error: (msg: string, err: any = null) => {
    console.error(`[ERROR] ${msg}`, err || '');
    if (process.env.SENTRY_DSN && err instanceof Error) {
      Sentry.captureException(err);
    } else if (process.env.SENTRY_DSN) {
      Sentry.captureMessage(msg, 'error');
    }
  },
};
