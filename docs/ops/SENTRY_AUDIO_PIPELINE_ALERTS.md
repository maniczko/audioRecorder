# Sentry Audio Pipeline Alerts

## Scope

This runbook covers Sentry alert setup for recording upload, transcription queue,
STT pipeline, retry, fallback analysis, and stuck-job failures. Events must be
safe to inspect: use ids and status fields only, never raw audio, transcript,
segments, prompts, API keys, tokens, or request payloads.

## Required Event Context

Backend events use the `audio_pipeline` context. Frontend queue events use the
`recording_queue` context.

Required searchable tags:

- `workspaceId`
- `recordingId`
- `jobId` when a durable job exists
- `pipelineStage`
- `providerId` when the STT or AI provider is known
- `errorCode`

Expected warning-level events:

- upload validation failures
- rate limits and retryable provider failures
- AI analysis fallback after transcript preservation
- background post-process failures

Error-level events:

- non-retryable STT failure
- queue failure after retries are exhausted
- upload storage failures such as `ENOSPC`
- transcription start/retry failures that return 5xx without a retryable code

## Alert Rules

Create these Sentry issue or metric alerts after deploy.

### High Failed Transcription Rate

- Filter: `errorCode:TRANSCRIPTION_JOB_FAILED OR errorCode:stt_failed OR errorCode:stt_rate_limited`
- Environment: `production`
- Threshold: more than 5 events in 10 minutes
- Grouping: `errorCode`, `providerId`, `pipelineStage`
- Action: page/on-call if non-retryable, Slack/email if retryable.

### Stuck Jobs

- Filter: `pipelineStage:job_capacity_wait OR errorCode:BACKGROUND_TRANSCRIPTION_PENDING`
- Environment: `production`
- Threshold: more than 10 warning events in 30 minutes
- Action: check Railway memory, queue depth, durable job leases, and `/health`.

### No-Key Or Fallback Analysis Rate

- Filter: `pipelineStage:ai_analysis AND errorCode:AI_ANALYSIS_FAILED`
- Environment: `production`
- Threshold: more than 3 warning events in 15 minutes
- Action: verify AI provider keys, quota, fallback mode, and user-visible status.

### Upload Validation Spike

- Filter: `pipelineStage:upload_validation`
- Environment: `production`
- Threshold: more than 20 warning events in 10 minutes
- Action: inspect content types, max-size failures, browser/client release, and abuse signals.

## Manual Verification Checklist

After deploy:

- Upload one valid short audio file and confirm no error-level Sentry event is created.
- Trigger one invalid MIME upload in staging or preview and confirm a warning event has `pipelineStage=upload_validation`.
- Trigger or simulate one transcription failure and confirm the event includes `workspaceId`, `recordingId`, `pipelineStage`, and `errorCode`.
- Confirm the event payload does not contain transcript text, segment text, audio bytes, tokens, or raw request payloads.
- Confirm frontend queue failure events use `recording_queue` context and the same `recordingId`.

## Release Evidence

Attach to the PR or release note:

- Sentry issue/event link for the test validation failure.
- Sentry issue/event link for the simulated pipeline failure.
- Screenshot or export of alert rules.
- Test command output for Sentry context redaction and queue failure coverage.
