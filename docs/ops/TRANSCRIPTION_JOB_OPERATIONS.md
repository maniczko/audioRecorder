# Transcription Job Operations

Issue #1245 adds an API-only operator workflow for inspecting and safely acting on durable transcription jobs without direct database access.

## Access

All endpoints require the production ops token through one of these headers:

```bash
Authorization: Bearer $VOICELOG_ADMIN_TOKEN
```

or:

```bash
X-Admin-Token: $VOICELOG_ADMIN_TOKEN
```

If `VOICELOG_ADMIN_TOKEN` is not configured, the endpoints return `403` and stay disabled.

## List Jobs

```bash
curl -sS "$VOICELOG_API_URL/api/admin/transcription-jobs?workspaceId=ws_123&status=failed&olderThanMinutes=30&limit=25" \
  -H "Authorization: Bearer $VOICELOG_ADMIN_TOKEN"
```

Supported filters:

- `workspaceId`
- `status`: `queued`, `running`, `retryable_failed`, `failed`, `completed`, `cancelled`
- `recordingId`
- `olderThanMinutes`
- `limit`, capped at 100

The response includes job metadata, timing, lock state, and the last safe error fields. It does not include transcript text, audio paths, or raw audio content.

## Inspect Diagnostics

```bash
curl -sS "$VOICELOG_API_URL/api/admin/transcription-jobs/tj_123" \
  -H "Authorization: Bearer $VOICELOG_ADMIN_TOKEN"
```

Use this before mutating a job. Confirm `workspaceId`, `recordingId`, current `status`, `attemptCount`, and `diagnostics.lastErrorMessage`.

## Retry A Job

```bash
curl -sS -X POST "$VOICELOG_API_URL/api/admin/transcription-jobs/tj_123/retry" \
  -H "Authorization: Bearer $VOICELOG_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"operator retry after provider outage"}'
```

This clears locks and previous error fields, resets attempts to `0`, sets the job to `queued`, and syncs the media asset status to `queued`.

## Cancel A Job

```bash
curl -sS -X POST "$VOICELOG_API_URL/api/admin/transcription-jobs/tj_123/cancel" \
  -H "Authorization: Bearer $VOICELOG_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"duplicate upload superseded by a newer recording"}'
```

This marks the durable job as `cancelled`, clears any lease, and syncs the media asset to the failed/attention state used by the recording UI. A running STT provider request is not force-aborted; the database guard prevents a late completion from overwriting the cancelled job.

## Mark Failed

```bash
curl -sS -X POST "$VOICELOG_API_URL/api/admin/transcription-jobs/tj_123/mark-failed" \
  -H "Authorization: Bearer $VOICELOG_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"audio source unavailable after storage incident"}'
```

This marks the durable job as `failed`, clears any lease, records `OPERATOR_MARK_FAILED`, and syncs the media asset to `failed`.

## Audit And Safety

Every mutating action writes a best-effort audit event:

- `operator.transcription_job.retry`
- `operator.transcription_job.cancel`
- `operator.transcription_job.mark_failed`

The audit metadata includes job id, recording id, meeting id, resulting status, and reason. Do not put secrets, transcript text, file paths, or raw provider payloads in the `reason`.
