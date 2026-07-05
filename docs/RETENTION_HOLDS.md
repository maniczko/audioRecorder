# Retention Holds

VoiceLog retention holds preserve selected recordings beyond the workspace retention window.
Use them for legal hold, customer dispute, regulator request, or incident-review evidence.

## Operator workflow

1. Confirm the workspace and recording id.
2. As a workspace owner or admin, create a recording hold with a specific reason:

```http
PUT /workspaces/{workspaceId}/recordings/{recordingId}/retention-hold
Content-Type: application/json

{ "reason": "legal discovery" }
```

3. For a whole-workspace preservation order, create a workspace hold:

```http
PUT /workspaces/{workspaceId}/retention-hold
Content-Type: application/json

{ "reason": "regulator request" }
```

4. Verify active holds:

```http
GET /workspaces/{workspaceId}/retention-holds
```

5. Release the hold only after the preservation requirement ends:

```http
DELETE /workspaces/{workspaceId}/recordings/{recordingId}/retention-hold
Content-Type: application/json

{ "reason": "case closed" }
```

For workspace holds, use:

```http
DELETE /workspaces/{workspaceId}/retention-hold
Content-Type: application/json

{ "reason": "case closed" }
```

## Retention behavior

- Scheduled and manual retention cleanup still checks held recordings.
- Expired recordings with an active recording or workspace hold are skipped and returned as
  `heldRecordingIds`.
- Cleanup audit metadata includes `heldRecordingIds` so operators can explain why an expired
  recording remained in storage.
- Releasing a hold does not delete the recording immediately; the next retention cleanup can remove
  it if it is still older than the workspace retention window.

## Audit events

Retention hold changes are written to `audit_logs`:

- `recording.retention_hold.created`
- `recording.retention_hold.updated`
- `recording.retention_hold.released`
- `workspace.retention_hold.created`
- `workspace.retention_hold.released`

Workspace export includes retention hold history under `operational.retentionHolds`.
