import { SpanStatusCode, trace, type Span, type Tracer } from '@opentelemetry/api';
import { resolveBuildMetadata } from './runtime.ts';

type TraceAttributeValue = string | number | boolean;
type TraceContext = Record<string, unknown>;

const SERVICE_NAME = 'voicelog-server';
const MAX_ATTRIBUTE_STRING_LENGTH = 200;

const ATTRIBUTE_ALLOWLIST: Record<string, string> = {
  requestId: 'voicelog.request_id',
  workspaceId: 'voicelog.workspace_id',
  recordingId: 'voicelog.recording_id',
  meetingId: 'voicelog.meeting_id',
  jobId: 'voicelog.job_id',
  pipelineStage: 'voicelog.pipeline_stage',
  operation: 'voicelog.operation',
  providerId: 'voicelog.provider_id',
  errorCode: 'voicelog.error_code',
  processingMode: 'voicelog.processing_mode',
  storageMode: 'voicelog.storage_mode',
  contentType: 'voicelog.content_type',
  profile: 'voicelog.profile',
  retryable: 'voicelog.retryable',
  idempotent: 'voicelog.idempotent',
  sizeBytes: 'voicelog.size_bytes',
  sourceSizeBytes: 'voicelog.source_size_bytes',
  normalizedSizeBytes: 'voicelog.normalized_size_bytes',
  contentLength: 'voicelog.content_length',
  durationMs: 'voicelog.duration_ms',
  statusCode: 'voicelog.status_code',
  partCount: 'voicelog.part_count',
  queueSize: 'voicelog.queue_size',
  attemptCount: 'voicelog.attempt_count',
  speakerCount: 'voicelog.speaker_count',
  segmentCount: 'voicelog.segment_count',
  chunkCount: 'voicelog.chunk_count',
  chunksAttempted: 'voicelog.chunks_attempted',
  chunksSentToStt: 'voicelog.chunks_sent_to_stt',
  chunksFailedAtStt: 'voicelog.chunks_failed_at_stt',
};

let initialized = false;
let initPromise: Promise<boolean> | null = null;
let shutdownTracing: (() => Promise<void>) | null = null;
let tracerForTests: Tracer | null = null;

function isTruthy(value: unknown) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

function normalizeAttributeValue(value: unknown): TraceAttributeValue | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, MAX_ATTRIBUTE_STRING_LENGTH) : null;
  }
  return null;
}

export function isTracingEnabled() {
  return initialized;
}

export function sanitizeTraceAttributes(input: TraceContext = {}) {
  const attributes: Record<string, TraceAttributeValue> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return attributes;

  for (const [sourceKey, targetKey] of Object.entries(ATTRIBUTE_ALLOWLIST)) {
    const value = normalizeAttributeValue(input[sourceKey]);
    if (value !== null) attributes[targetKey] = value;
  }

  return attributes;
}

function parseOtlpHeaders(value: string | undefined) {
  if (!value) return undefined;
  const headers: Record<string, string> = {};
  for (const pair of value.split(',')) {
    const [rawKey, ...rawValue] = pair.split('=');
    const key = rawKey?.trim();
    const headerValue = rawValue.join('=').trim();
    if (key && headerValue) headers[key] = headerValue;
  }
  return Object.keys(headers).length ? headers : undefined;
}

export async function initTracing() {
  if (initialized) return true;
  if (!isTruthy(process.env.VOICELOG_OTEL_ENABLED)) return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!endpoint) return false;

    try {
      const [
        { BasicTracerProvider, BatchSpanProcessor },
        { OTLPTraceExporter },
        { resourceFromAttributes },
        { AsyncLocalStorageContextManager },
      ] = await Promise.all([
        import('@opentelemetry/sdk-trace-base'),
        import('@opentelemetry/exporter-trace-otlp-http'),
        import('@opentelemetry/resources'),
        import('@opentelemetry/context-async-hooks'),
      ]);

      const exporter = new OTLPTraceExporter({
        url: endpoint,
        headers: parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      });
      const provider = new BasicTracerProvider({
        resource: resourceFromAttributes({
          'service.name': process.env.OTEL_SERVICE_NAME || SERVICE_NAME,
          'service.version': resolveBuildMetadata().gitSha,
          'deployment.environment.name':
            process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || 'development',
        }),
        spanProcessors: [new BatchSpanProcessor(exporter)],
      });

      const { context } = await import('@opentelemetry/api');
      context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
      trace.setGlobalTracerProvider(provider);
      shutdownTracing = () => provider.shutdown();
      initialized = true;
      return true;
    } catch (error) {
      initialized = false;
      console.warn(
        '[Tracing] Failed to initialize OpenTelemetry:',
        (error as Error)?.message || error
      );
      return false;
    }
  })();

  return initPromise;
}

export async function shutdownTracingForTests() {
  const shutdown = shutdownTracing;
  shutdownTracing = null;
  initialized = false;
  initPromise = null;
  if (shutdown) await shutdown();
  const { context } = await import('@opentelemetry/api');
  trace.disable();
  context.disable();
}

export function getAudioTracer() {
  return tracerForTests || trace.getTracer(SERVICE_NAME);
}

export function setAudioTracerForTests(tracer: Tracer) {
  tracerForTests = tracer;
}

export function resetAudioTracerForTests() {
  tracerForTests = null;
}

export function getActiveTraceIds(span: Span | null = trace.getActiveSpan() || null) {
  const context = span?.spanContext?.();
  const traceId = context?.traceId;
  const spanId = context?.spanId;
  if (!traceId || !spanId || /^0+$/.test(traceId) || /^0+$/.test(spanId)) return {};
  return { traceId, spanId };
}

export function appendTraceContext<T extends TraceContext>(
  context: T
): T & { traceId?: string; spanId?: string } {
  const ids = getActiveTraceIds();
  return Object.keys(ids).length
    ? ({ ...context, ...ids } as T & { traceId?: string; spanId?: string })
    : context;
}

export function addAudioTraceEvent(name: string, context: TraceContext = {}) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.addEvent(name, sanitizeTraceAttributes(context));
}

export async function withAudioSpan<T>(
  name: string,
  context: TraceContext,
  callback: (span: Span) => Promise<T> | T
): Promise<T> {
  const tracer = getAudioTracer();
  return tracer.startActiveSpan(
    name,
    {
      attributes: sanitizeTraceAttributes(context),
    },
    async (span) => {
      try {
        const result = await callback(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    }
  );
}
