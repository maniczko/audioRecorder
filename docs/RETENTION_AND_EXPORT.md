# Retention and Workspace Export

## Retention policy

Workspace retention is stored as `retentionDays` in workspace state and mirrored in
`workspace_state.retention_days`. A value of `0` disables automatic expiry.

Admin API:

```http
PUT /workspaces/:workspaceId/retention
Content-Type: application/json

{ "retentionDays": 365 }
```

Only workspace owners and admins can change retention or run cleanup.

## Cleanup

Manual API:

```http
POST /workspaces/:workspaceId/retention/cleanup
Content-Type: application/json

{}
```

Local maintenance:

```powershell
pnpm exec tsx server/scripts/run-retention-maintenance.ts
```

Optional scope:

```powershell
$env:VOICELOG_RETENTION_WORKSPACE_ID='workspace_id'
pnpm exec tsx server/scripts/run-retention-maintenance.ts
```

Cleanup is repeatable. Expired recordings are deleted through `deleteMediaAsset`,
which removes storage references, RAG chunks, media rows, and writes audit logs.

## Export

Admin API:

```http
GET /workspaces/:workspaceId/export
```

The export payload is machine-readable and includes workspace metadata, members,
workspace state, meeting metadata, transcripts, diarization/AI metadata, RAG
chunks, audit logs, and durable transcription job metadata.

## Audit

The following actions are logged in `audit_logs`:

- `workspace.retention.updated`
- `retention.cleanup.completed`
- `recording.deleted`
- `workspace.export.generated`
