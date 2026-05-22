import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

function getSentryRelease() {
  return String(import.meta.env.VITE_BUILD_ID || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || '')
    .trim()
    .toLowerCase();
}

export function initSentry() {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: getSentryRelease() || undefined,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  });
}

export { Sentry };
