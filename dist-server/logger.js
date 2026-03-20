const Sentry = require("@sentry/node");
const IS_PROD = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: 1.0,
        debug: !IS_PROD,
    });
}
const logger = {
    info: (msg, meta = {}) => {
        console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : '');
    },
    warn: (msg, meta = {}) => {
        console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? meta : '');
        if (process.env.SENTRY_DSN) {
            Sentry.captureMessage(msg, "warning");
        }
    },
    error: (msg, err = null) => {
        console.error(`[ERROR] ${msg}`, err || '');
        if (process.env.SENTRY_DSN && err instanceof Error) {
            Sentry.captureException(err);
        }
        else if (process.env.SENTRY_DSN) {
            Sentry.captureMessage(msg, "error");
        }
    }
};
module.exports = { logger };
