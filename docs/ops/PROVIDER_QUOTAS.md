# Provider quota controls

VoiceLog gates costly provider paths before making external calls. Quotas use
the existing `ai_quota_counters` store and are keyed by provider family, user,
workspace, endpoint, and IP.

## Covered paths

- AI: `/ai/*`, `/media/analyze`, voice coaching.
- STT: recording transcription and retry transcription.
- Live transcription: `/transcribe/live`.
- Image generation: sketchnote generation.
- Embeddings: voice profile enrollment.

Quota failures return HTTP `429`, set `Retry-After`, and include:

```json
{
  "code": "stt_quota_exceeded",
  "message": "Przekroczono limit uzycia dostawcy. Sprobuj ponownie pozniej.",
  "retryAfter": 3600,
  "providerFamily": "stt",
  "endpoint": "recording-transcribe"
}
```

## Defaults

| Family             | User / hour | Workspace / day | IP / minute |
| ------------------ | ----------: | --------------: | ----------: |
| AI                 |          20 |             200 |          30 |
| STT                |          20 |             300 |          20 |
| Live transcription |         120 |            1200 |          60 |
| Image              |           8 |              60 |           5 |
| Embedding          |          40 |             400 |          20 |

## Environment overrides

Global provider defaults:

- `VOICELOG_PROVIDER_USER_QUOTA_PER_HOUR`
- `VOICELOG_PROVIDER_WORKSPACE_QUOTA_PER_DAY`
- `VOICELOG_PROVIDER_IP_QUOTA_PER_MINUTE`

Family overrides:

- `VOICELOG_STT_USER_QUOTA_PER_HOUR`
- `VOICELOG_STT_WORKSPACE_QUOTA_PER_DAY`
- `VOICELOG_LIVE_TRANSCRIPTION_USER_QUOTA_PER_HOUR`
- `VOICELOG_IMAGE_USER_QUOTA_PER_HOUR`
- `VOICELOG_EMBEDDING_USER_QUOTA_PER_HOUR`

Endpoint overrides use the normalized family and endpoint name:

- `VOICELOG_STT_RECORDING_TRANSCRIBE_USER_QUOTA_PER_HOUR`
- `VOICELOG_STT_RETRY_TRANSCRIBE_USER_QUOTA_PER_HOUR`
- `VOICELOG_IMAGE_SKETCHNOTE_USER_QUOTA_PER_HOUR`
- `VOICELOG_AI_MEDIA_ANALYZE_WORKSPACE_QUOTA_PER_DAY`

## Operator visibility

Owners, admins, and operators can inspect workspace counters without raw meeting
content:

```bash
curl -H "Authorization: Bearer <token>" \
  "https://<api-host>/media/quota/usage?workspaceId=<workspace-id>"
```

The response contains counter keys, counts, and reset times only. It does not
include prompts, transcripts, audio paths, provider payloads, or generated
content.

## Store selection

`VOICELOG_AI_QUOTA_STORE=auto` uses the DB-backed store outside local/test when
a DB adapter is available. Use `memory` only for local development or isolated
tests.
