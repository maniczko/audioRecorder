/**
 * Structured JSON Logger
 *
 * Production logs are emitted as one JSON object per line so log backends can
 * filter by requestId, workspaceId, recordingId, jobId, route, status, stage,
 * durationMs, and errorCode without scraping text.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  service: string;
  message: string;
  data?: Record<string, unknown>;
}

const SERVICE_NAME = process.env.SERVICE_NAME || 'voicelog-server';
const REDACTED = '[redacted]';
const MAX_REDACTION_DEPTH = 5;
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

function redactValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value instanceof Error) return normalizeError(value);
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (depth >= MAX_REDACTION_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key, depth + 1));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey, depth + 1),
      ])
    );
  }
  return String(value);
}

function normalizeLogData(data?: unknown): Record<string, unknown> | undefined {
  if (data === null || data === undefined) return undefined;
  if (data instanceof Error) return { error: normalizeError(data) };
  if (isPlainObject(data)) {
    const redacted = redactValue(data);
    return isPlainObject(redacted) && Object.keys(redacted).length > 0 ? redacted : undefined;
  }
  return { value: redactValue(data) };
}

function developmentData(data?: unknown) {
  if (data instanceof Error) return data;
  if (data !== null && data !== undefined && !isPlainObject(data)) return data;
  const normalized = normalizeLogData(data);
  return normalized && Object.keys(normalized).length > 0 ? normalized : '';
}

function formatLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    message,
    ...(data && Object.keys(data).length > 0 ? { data } : {}),
  };
  return JSON.stringify(entry);
}

export const structuredLogger = {
  debug(message: string, data?: unknown): void {
    const normalized = normalizeLogData(data);
    if (process.env.LOG_LEVEL === 'debug') {
      if (process.env.NODE_ENV === 'production') {
        process.stdout.write(formatLogEntry('debug', message, normalized) + '\n');
      } else {
        console.debug(`[DEBUG] ${message}`, developmentData(data));
      }
    }
  },

  info(message: string, data?: unknown): void {
    const normalized = normalizeLogData(data);
    if (process.env.NODE_ENV === 'production') {
      process.stdout.write(formatLogEntry('info', message, normalized) + '\n');
    } else {
      console.log(`[INFO] ${message}`, developmentData(data));
    }
  },

  warn(message: string, data?: unknown): void {
    const normalized = normalizeLogData(data);
    if (process.env.NODE_ENV === 'production') {
      process.stderr.write(formatLogEntry('warn', message, normalized) + '\n');
    } else {
      console.warn(`[WARN] ${message}`, developmentData(data));
    }
  },

  error(message: string, data?: unknown): void {
    const normalized = normalizeLogData(data);
    if (process.env.NODE_ENV === 'production') {
      process.stderr.write(formatLogEntry('error', message, normalized) + '\n');
    } else {
      console.error(`[ERROR] ${message}`, developmentData(data));
    }
  },

  child(context: Record<string, unknown>) {
    return {
      debug: (msg: string, data?: Record<string, unknown>) =>
        this.debug(msg, { ...context, ...data }),
      info: (msg: string, data?: Record<string, unknown>) =>
        this.info(msg, { ...context, ...data }),
      warn: (msg: string, data?: Record<string, unknown>) =>
        this.warn(msg, { ...context, ...data }),
      error: (msg: string, data?: Record<string, unknown>) =>
        this.error(msg, { ...context, ...data }),
    };
  },
};

export default structuredLogger;
