export type SentryContextLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface AudioPipelineSentryContext extends Record<string, unknown> {
  requestId?: string;
  workspaceId?: string;
  recordingId?: string;
  jobId?: string;
  pipelineStage?: string;
  providerId?: string;
  errorCode?: string;
  operation?: string;
  retryable?: boolean;
  traceId?: string;
  spanId?: string;
}

export interface SentryCaptureOptions {
  level?: SentryContextLevel;
  fingerprint?: string[];
}

const REDACTED = '[redacted]';
const MAX_DEPTH = 5;
const SENSITIVE_KEY_PATTERN =
  /(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|password|secret|transcript|segments|audio|buffer|raw|payload)/i;

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

export function sanitizeSentryValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value instanceof Error) return normalizeError(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSentryValue(item, key, depth + 1));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeSentryValue(entryValue, entryKey, depth + 1),
      ])
    );
  }
  return String(value);
}

export function sanitizeSentryContext(
  context: AudioPipelineSentryContext | undefined
): Record<string, unknown> {
  if (!context || !isPlainObject(context)) return {};
  const sanitized = sanitizeSentryValue(context);
  return isPlainObject(sanitized) ? sanitized : {};
}

export function sentryTagsFromContext(context: Record<string, unknown>) {
  const tags: Record<string, string> = {};
  for (const key of [
    'workspaceId',
    'recordingId',
    'jobId',
    'pipelineStage',
    'providerId',
    'errorCode',
    'traceId',
    'spanId',
  ]) {
    const value = context[key];
    if (value !== undefined && value !== null && value !== '') {
      tags[key] = String(value).slice(0, 200);
    }
  }
  return tags;
}
