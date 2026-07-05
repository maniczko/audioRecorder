# Audit Export Compliance Runbook

## Purpose

Workspace audit export gives enterprise operators a deterministic report of security-relevant
workspace events without exporting raw audio or transcript content.

Use it for compliance evidence, customer support investigations, and incident review.

## Endpoint

```http
GET /workspaces/:workspaceId/audit-logs/export
Authorization: Bearer <session-token>
```

Supported query parameters:

| Parameter     | Description                                             |
| ------------- | ------------------------------------------------------- |
| `format`      | `json` by default, or `csv` for a flat report.          |
| `from`        | Inclusive ISO timestamp lower bound for `createdAt`.    |
| `to`          | Inclusive ISO timestamp upper bound for `createdAt`.    |
| `eventType`   | Audit action, for example `recording.audio.downloaded`. |
| `actorUserId` | User id that performed the audited action.              |
| `recordingId` | Recording id when the audited entity is a recording.    |

## Permissions

The endpoint requires `workspace:audit:read`.

Allowed roles:

- `owner`
- `admin`
- `operator`
- `auditor`

Regular `member` and `viewer` roles cannot export audit reports.

## JSON Report Shape

```json
{
  "schemaVersion": "audit-export-v1",
  "generatedAt": "2026-07-05T12:00:00.000Z",
  "generatedBy": "user_123",
  "filters": {
    "workspaceId": "workspace_123",
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-05T00:00:00.000Z",
    "eventType": "recording.audio.downloaded",
    "actorUserId": "user_123",
    "recordingId": "recording_123"
  },
  "eventCount": 1,
  "events": []
}
```

CSV exports include:

- `id`
- `createdAt`
- `workspaceId`
- `actorUserId`
- `eventType`
- `entityType`
- `entityId`
- `recordingId`
- `metadataJson`

## Data Minimization

Exported metadata is sanitized. Keys that can carry raw transcript, audio, prompt, file path,
storage path, payload, or raw provider content are removed from the report metadata.

The export must not be used as a replacement for full workspace data export because it is
intentionally audit-focused and content-minimized.

## Operator Checklist

- Confirm the workspace id and date range before generating the report.
- Prefer narrow filters for event type, actor, and recording when responding to a support request.
- Store exported reports in the approved customer evidence location.
- Do not attach raw audio, transcript text, prompts, provider payloads, API keys, or bearer tokens.
- Re-run the export after remediation when the report is used for incident closure evidence.
