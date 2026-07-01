import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const REDACTED = '[redacted]';
const MAX_DEPTH = 5;
const SENSITIVE_KEY_PATTERN =
  /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|password|secret|transcript|segments|audio|buffer|raw|payload)/i;

type QueueSentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface QueueSentryContext extends Record<string, unknown> {
  workspaceId?: string;
  recordingId?: string;
  jobId?: string;
  pipelineStage?: string;
  providerId?: string;
  errorCode?: string;
  retryable?: boolean;
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeError(error: Error) {
  const enriched = error as Error & {
    code?: unknown;
    errorCode?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  return {
    name: error.name,
    message: error.message,
    ...(enriched.code ? { code: String(enriched.code) } : {}),
    ...(enriched.errorCode ? { errorCode: String(enriched.errorCode) } : {}),
    ...(enriched.status ? { status: Number(enriched.status) } : {}),
    ...(enriched.statusCode ? { statusCode: Number(enriched.statusCode) } : {}),
  };
}

export function sanitizeSentryContext(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value instanceof Error) return normalizeError(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => sanitizeSentryContext(item, key, depth + 1));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeSentryContext(entryValue, entryKey, depth + 1),
      ])
    );
  }
  return String(value);
}

function normalizeContext(context?: QueueSentryContext) {
  const sanitized = sanitizeSentryContext(context || {});
  return isPlainObject(sanitized) ? sanitized : {};
}

function applyQueueScope(scope: any, context: Record<string, unknown>, level: QueueSentryLevel) {
  scope.setLevel?.(level);
  scope.setContext?.('recording_queue', context);
  for (const key of [
    'workspaceId',
    'recordingId',
    'jobId',
    'pipelineStage',
    'providerId',
    'errorCode',
  ]) {
    const value = context[key];
    if (value !== undefined && value !== null && value !== '') {
      scope.setTag?.(key, String(value).slice(0, 200));
    }
  }
}

export function addQueueBreadcrumb(
  message: string,
  context: QueueSentryContext = {},
  options: { level?: QueueSentryLevel; category?: string } = {}
) {
  Sentry.addBreadcrumb?.({
    category: options.category || 'recording.queue',
    level: options.level || 'info',
    message,
    data: normalizeContext(context),
  });
}

export function captureQueueException(
  error: unknown,
  context: QueueSentryContext = {},
  options: { level?: QueueSentryLevel; fingerprint?: string[] } = {}
) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const sanitizedContext = normalizeContext(context);
  Sentry.withScope?.((scope) => {
    applyQueueScope(
      scope,
      sanitizedContext,
      options.level || (sanitizedContext.retryable ? 'warning' : 'error')
    );
    if (options.fingerprint?.length) {
      scope.setFingerprint?.(options.fingerprint);
    }
    Sentry.captureException?.(normalizedError);
  });
}

export { Sentry };
