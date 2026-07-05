# Enterprise RBAC Matrix

Issue: #1255

This document defines the workspace-level authorization contract used by the
frontend permission helper and backend route checks. Backend checks are
authoritative; UI visibility is a convenience layer only.

## Roles

| Role       | Purpose                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| `owner`    | Full workspace control, including member removal and destructive admin work. |
| `admin`    | Workspace administration without removing members from the workspace.        |
| `operator` | Production operations for recordings, processing, quotas, and audit review.  |
| `member`   | Normal collaboration: create recordings, edit workspace state, run analysis. |
| `viewer`   | Read-only access to workspace state and recording content.                   |
| `auditor`  | Audit review without content mutation or AI processing.                      |

Unknown roles normalize to `member` for local compatibility. Server-side checks
still require a valid workspace membership before any permission is evaluated.

## Permission Matrix

| Permission                   | owner | admin | operator | member | viewer | auditor |
| ---------------------------- | ----- | ----- | -------- | ------ | ------ | ------- |
| `workspace:state:read`       | yes   | yes   | yes      | yes    | yes    | yes     |
| `workspace:state:write`      | yes   | yes   | yes      | yes    | no     | no      |
| `workspace:retention:manage` | yes   | yes   | no       | no     | no     | no      |
| `workspace:export`           | yes   | yes   | no       | no     | no     | no      |
| `workspace:audit:read`       | yes   | yes   | yes      | no     | no     | yes     |
| `workspace:members:manage`   | yes   | yes   | no       | no     | no     | no      |
| `workspace:members:remove`   | yes   | no    | no       | no     | no     | no      |
| `recordings:read`            | yes   | yes   | yes      | yes    | yes    | yes     |
| `recordings:upload`          | yes   | yes   | yes      | yes    | no     | no      |
| `recordings:download`        | yes   | yes   | yes      | yes    | yes    | no      |
| `recordings:delete`          | yes   | yes   | no       | no     | no     | no      |
| `recordings:process`         | yes   | yes   | yes      | yes    | no     | no      |
| `ai:analyze`                 | yes   | yes   | yes      | yes    | no     | no      |
| `voice-profiles:read`        | yes   | yes   | yes      | yes    | yes    | no      |
| `voice-profiles:create`      | yes   | yes   | yes      | yes    | no     | no      |
| `voice-profiles:manage`      | yes   | yes   | no       | no     | no     | no      |
| `quota:read`                 | yes   | yes   | yes      | no     | no     | no      |
| `storage:cleanup`            | yes   | yes   | no       | no     | no     | no      |

## Backend Enforcement

Current backend enforcement covers:

| Surface                                                   | Permission                   |
| --------------------------------------------------------- | ---------------------------- |
| `PUT/PATCH /state/workspaces/:workspaceId`                | `workspace:state:write`      |
| `PUT /workspaces/:workspaceId/retention`                  | `workspace:retention:manage` |
| `POST /workspaces/:workspaceId/retention/cleanup`         | `workspace:retention:manage` |
| `GET /workspaces/:workspaceId/export`                     | `workspace:export`           |
| `GET /workspaces/:workspaceId/audit-logs`                 | `workspace:audit:read`       |
| `PUT /workspaces/:workspaceId/members/:targetUserId/role` | `workspace:members:manage`   |
| `DELETE /workspaces/:workspaceId/members/:targetUserId`   | `workspace:members:remove`   |
| `GET /voice-profiles`                                     | `voice-profiles:read`        |
| `POST /voice-profiles`                                    | `voice-profiles:create`      |
| `PATCH /voice-profiles/:id/threshold`                     | `voice-profiles:manage`      |
| `DELETE /voice-profiles/:id`                              | `voice-profiles:manage`      |
| `GET /media/quota/usage`                                  | `quota:read`                 |
| `PUT /media/recordings/:recordingId/audio`                | `recordings:upload`          |
| `GET /media/recordings/:recordingId/audio`                | `recordings:download`        |
| `GET /media/recordings/:recordingId/audio/manifest`       | `recordings:download`        |
| `DELETE /media/recordings/:recordingId`                   | `recordings:delete`          |
| `POST /media/recordings/:recordingId/transcribe`          | `recordings:process`         |
| `POST /media/analyze`                                     | `ai:analyze`                 |
| `POST /ai/*` with workspace context                       | `ai:analyze`                 |

## UI Contract

Frontend code should use `getWorkspacePermissions(role)` from
`src/lib/permissions.ts` for action visibility. The UI must not be treated as an
authorization boundary. Backend routes must continue to enforce the matching
permission independently.

Current UI coverage includes workspace member actions:

- role changes are visible when `canManageWorkspaceRoles` is true;
- member removal is visible only when `canRemoveWorkspaceMembers` is true.
