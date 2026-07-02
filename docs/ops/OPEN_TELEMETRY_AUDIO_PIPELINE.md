# OpenTelemetry Audio Pipeline Tracing

This runbook covers optional OpenTelemetry tracing for the VoiceLog audio path:
upload -> storage -> transcription job -> STT -> diarization -> AI cleanup -> persistence.

Tracing is off by default. The server exports spans only when both conditions are true:

- `VOICELOG_OTEL_ENABLED=true`
- `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set

## Local Collector

Example local collector endpoint:

```powershell
$env:VOICELOG_OTEL_ENABLED='true'
$env:OTEL_SERVICE_NAME='voicelog-server'
$env:OTEL_EXPORTER_OTLP_ENDPOINT='http://localhost:4318/v1/traces'
pnpm run start:server
```

If the collector requires headers, use standard OTLP headers:

```powershell
$env:OTEL_EXPORTER_OTLP_HEADERS='authorization=Bearer <token>'
```

Do not commit real collector tokens. Use local shell variables, Railway variables,
or the target observability provider's secret store.

## Production Setup

Set these Railway variables for the backend service:

```text
VOICELOG_OTEL_ENABLED=true
OTEL_SERVICE_NAME=voicelog-server
OTEL_EXPORTER_OTLP_ENDPOINT=https://<collector-host>/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=authorization=Bearer <collector-token>
```

Use `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` instead of `OTEL_EXPORTER_OTLP_ENDPOINT`
when the provider gives a traces-specific URL.

## Span Map

Core API spans:

- `audio.upload.receive`
- `audio.upload.validate`
- `audio.upload.normalize`
- `audio.upload.split_parts`
- `audio.upload.store`
- `audio.transcription.request`
- `audio.transcription.retry`

Worker and processing spans:

- `audio.transcription.enqueue`
- `audio.transcription.acquire`
- `audio.transcription.run`
- `audio.transcription.materialize`
- `audio.transcription.audio_quality`
- `audio.transcription.attempt`
- `audio.transcription.preprocess`
- `audio.transcription.vad`
- `audio.transcription.stt`
- `audio.transcription.stt_provider`
- `audio.transcription.diarization`
- `audio.transcription.verification`
- `audio.transcription.persist`
- `audio.transcription.status_update`
- `audio.transcription.postprocess`
- `audio.analysis.transcript_cleanup`
- `audio.analysis.llm`

## Safe Attributes

Only allowlisted primitive metadata is attached to spans. Safe search keys include:

- `voicelog.request_id`
- `voicelog.workspace_id`
- `voicelog.recording_id`
- `voicelog.meeting_id`
- `voicelog.job_id`
- `voicelog.pipeline_stage`
- `voicelog.operation`
- `voicelog.provider_id`
- `voicelog.error_code`
- `voicelog.processing_mode`
- `voicelog.storage_mode`
- `voicelog.size_bytes`
- `voicelog.duration_ms`
- `voicelog.part_count`
- `voicelog.segment_count`

Transcript text, segment payloads, audio buffers, file paths, raw request payloads,
API keys, authorization headers, and tokens are intentionally excluded.

## Verification

1. Start the backend with tracing enabled and a reachable collector.
2. Upload a short audio recording.
3. Start transcription.
4. Search traces by `voicelog.recording_id`.
5. Confirm the trace contains upload, job, STT, diarization, AI cleanup, and persistence spans.
6. Confirm logs and Sentry events for the same request include `traceId` and `spanId` when the event occurs inside an active span.

If no spans appear, first confirm `VOICELOG_OTEL_ENABLED=true` and that the OTLP URL points to the HTTP trace endpoint, usually `/v1/traces`.
