import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('tracing helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('@opentelemetry/exporter-trace-otlp-http');
    vi.doUnmock('@opentelemetry/resources');
    delete process.env.VOICELOG_OTEL_ENABLED;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
  });

  it('keeps tracing disabled by default', async () => {
    const { initTracing, isTracingEnabled, withAudioSpan } = await import('../tracing.ts');

    await expect(initTracing()).resolves.toBe(false);
    expect(isTracingEnabled()).toBe(false);
    await expect(
      withAudioSpan('audio.upload.receive', { recordingId: 'rec_1' }, async () => 'ok')
    ).resolves.toBe('ok');
  });

  it('does not initialize when enabled without an OTLP endpoint', async () => {
    process.env.VOICELOG_OTEL_ENABLED = 'true';
    const { initTracing, isTracingEnabled } = await import('../tracing.ts');

    await expect(initTracing()).resolves.toBe(false);
    expect(isTracingEnabled()).toBe(false);
  });

  it('initializes an OTLP HTTP provider only when explicitly configured', async () => {
    vi.doMock('@opentelemetry/exporter-trace-otlp-http', () => ({
      OTLPTraceExporter: class {
        export(_spans: unknown, callback: (result: { code: number }) => void) {
          callback({ code: 0 });
        }
        shutdown() {
          return Promise.resolve();
        }
      },
    }));
    process.env.VOICELOG_OTEL_ENABLED = 'true';
    process.env.OTEL_SERVICE_NAME = 'voicelog-test';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'authorization=Bearer test, x-scope = audio';
    process.env.RAILWAY_ENVIRONMENT_NAME = 'test';

    try {
      const {
        addAudioTraceEvent,
        getActiveTraceIds,
        initTracing,
        isTracingEnabled,
        shutdownTracingForTests,
        withAudioSpan,
      } = await import('../tracing.ts');

      const firstInit = initTracing();
      await expect(initTracing()).resolves.toBe(true);
      await expect(firstInit).resolves.toBe(true);
      expect(isTracingEnabled()).toBe(true);
      await expect(
        withAudioSpan('audio.test.active', { recordingId: 'rec_active' }, async (span) => {
          addAudioTraceEvent('audio.test.event', {
            recordingId: 'rec_active',
            audioBuffer: 'private',
          });
          const appended = (await import('../tracing.ts')).appendTraceContext({
            requestId: 'req_active',
          });
          expect(getActiveTraceIds()).toEqual({
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
          });
          expect(appended).toEqual({
            requestId: 'req_active',
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
          });
          return 'traced';
        })
      ).resolves.toBe('traced');
      await shutdownTracingForTests();
      expect(isTracingEnabled()).toBe(false);
    } finally {
      vi.doUnmock('@opentelemetry/exporter-trace-otlp-http');
    }
  });

  it('fails closed when OpenTelemetry dependencies cannot initialize', async () => {
    vi.resetModules();
    process.env.VOICELOG_OTEL_ENABLED = 'true';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock('@opentelemetry/resources', () => ({
      resourceFromAttributes: () => {
        throw new Error('resource unavailable');
      },
    }));

    try {
      const { initTracing, isTracingEnabled } = await import('../tracing.ts');

      await expect(initTracing()).resolves.toBe(false);
      expect(isTracingEnabled()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        '[Tracing] Failed to initialize OpenTelemetry:',
        'resource unavailable'
      );
    } finally {
      vi.doUnmock('@opentelemetry/resources');
      warnSpy.mockRestore();
    }
  });

  it('keeps only safe primitive audio metadata on spans', async () => {
    const { sanitizeTraceAttributes } = await import('../tracing.ts');

    expect(
      sanitizeTraceAttributes({
        requestId: 'req_1',
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        meetingId: 'meet_1',
        jobId: 'job_1',
        pipelineStage: 'stt',
        operation: 'transcription.process',
        providerId: 'openai',
        processingMode: 'full',
        sizeBytes: 1024,
        durationMs: Number.NaN,
        partCount: 2,
        queueSize: 3,
        chunkCount: 4,
        statusCode: 202,
        retryable: false,
        accessToken: 'secret-token',
        transcriptJson: 'private transcript',
        segments: [{ text: 'private segment' }],
        filePath: 'C:/private/audio.webm',
      })
    ).toEqual({
      'voicelog.request_id': 'req_1',
      'voicelog.workspace_id': 'ws_1',
      'voicelog.recording_id': 'rec_1',
      'voicelog.meeting_id': 'meet_1',
      'voicelog.job_id': 'job_1',
      'voicelog.pipeline_stage': 'stt',
      'voicelog.operation': 'transcription.process',
      'voicelog.provider_id': 'openai',
      'voicelog.processing_mode': 'full',
      'voicelog.size_bytes': 1024,
      'voicelog.part_count': 2,
      'voicelog.queue_size': 3,
      'voicelog.chunk_count': 4,
      'voicelog.status_code': 202,
      'voicelog.retryable': false,
    });
    expect(sanitizeTraceAttributes(null as never)).toEqual({});
    expect(sanitizeTraceAttributes([] as never)).toEqual({});
    expect(sanitizeTraceAttributes({ requestId: '   ' })).toEqual({});
    expect(
      sanitizeTraceAttributes({ requestId: 'x'.repeat(260) })['voicelog.request_id']
    ).toHaveLength(200);
  });

  it('captures mocked span names and marks failures', async () => {
    const span = {
      setAttributes: vi.fn(),
      addEvent: vi.fn(),
      recordException: vi.fn(),
      setStatus: vi.fn(),
      end: vi.fn(),
      spanContext: vi.fn(() => ({
        traceId: '1234567890abcdef1234567890abcdef',
        spanId: '1234567890abcdef',
        traceFlags: 1,
      })),
    };
    const tracer = {
      startActiveSpan: vi.fn(
        (name: string, options: unknown, callback: (span: typeof span) => unknown) => callback(span)
      ),
    };
    const {
      appendTraceContext,
      setAudioTracerForTests,
      resetAudioTracerForTests,
      withAudioSpan,
      getActiveTraceIds,
    } = await import('../tracing.ts');

    setAudioTracerForTests(tracer as never);
    try {
      expect(appendTraceContext({ requestId: 'req_inactive' })).toEqual({
        requestId: 'req_inactive',
      });
      await expect(
        withAudioSpan(
          'audio.transcription.stt',
          {
            recordingId: 'rec_1',
            workspaceId: 'ws_1',
            providerId: 'openai',
            audioBuffer: 'redacted',
          },
          async () => {
            throw new Error('stt failed');
          }
        )
      ).rejects.toThrow('stt failed');
      await expect(
        withAudioSpan('audio.transcription.non_error', { recordingId: 'rec_2' }, async () => {
          return Promise.reject('string failure');
        })
      ).rejects.toBe('string failure');
    } finally {
      resetAudioTracerForTests();
    }

    expect(tracer.startActiveSpan).toHaveBeenCalledWith(
      'audio.transcription.stt',
      expect.objectContaining({
        attributes: expect.objectContaining({
          'voicelog.recording_id': 'rec_1',
          'voicelog.workspace_id': 'ws_1',
          'voicelog.provider_id': 'openai',
        }),
      }),
      expect.any(Function)
    );
    expect(JSON.stringify(tracer.startActiveSpan.mock.calls[0][1])).not.toContain('redacted');
    expect(span.recordException).toHaveBeenCalledWith(expect.any(Error));
    expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
    expect(span.end).toHaveBeenCalled();
    expect(getActiveTraceIds(span as never)).toEqual({
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: '1234567890abcdef',
    });
    expect(
      getActiveTraceIds({
        spanContext: () => ({
          traceId: '00000000000000000000000000000000',
          spanId: '0000000000000000',
        }),
      } as never)
    ).toEqual({});
  });
});
