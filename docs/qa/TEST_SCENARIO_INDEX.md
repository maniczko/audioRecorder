# Browser test scenario index

This file tracks the canonical scenario inventory. Detailed steps live under `docs/qa/scenarios/`.

## Status legend

- `draft`: incomplete definition.
- `ready`: executable manually.
- `running`: execution in progress.
- `passed`: latest execution passed.
- `failed`: latest execution found a defect.
- `blocked`: prerequisites or environment unavailable.
- `automated`: Playwright coverage exists and is maintained.
- `deprecated`: intentionally retired.

## Phase 1 — critical smoke

| ID | Area | Scenario | Priority | Type | Status | Automation | File |
|---|---|---|---:|---|---|---|---|
| AUTH-001 | Authentication | Successful login and workspace bootstrap | P0 | M + E2E | ready | candidate | `scenarios/auth-session.md` |
| AUTH-002 | Authentication | Invalid credentials show a safe error | P0 | M + E2E | ready | candidate | `scenarios/auth-session.md` |
| AUTH-003 | Authentication | Expired session during navigation | P0 | M + E2E | ready | candidate | `scenarios/auth-session.md` |
| AUTH-004 | Authentication | Expired session during audio upload | P0 | M + E2E | ready | candidate | `scenarios/auth-session.md` |
| REC-001 | Recording | Start, pause, resume, and stop recording | P0 | M + E2E | automated | automated | `scenarios/recording.md` |
| REC-002 | Recording | Unsupported microphone | P0 | M + E2E | automated | automated | `scenarios/recording.md` |
| REC-003 | Recording | Microphone permission denied | P0 | M + E2E | automated | automated | `scenarios/recording.md` |
| REC-004 | Recording | Import short deterministic audio file | P0 | M + E2E | automated | automated | `scenarios/recording.md` |
| REC-005 | Recording pipeline | Upload through transcript ready | P0 | M + E2E + S | ready | partial | `scenarios/recording.md` |
| REC-006 | Recording pipeline | Retry after upload failure | P0 | M + E2E | automated | automated | `scenarios/recording.md` |
| REC-007 | Recording pipeline | Refresh during processing | P0 | M + E2E | ready | candidate | `scenarios/recording.md` |
| REC-008 | Recording pipeline | Permanent failure remains actionable | P0 | M + E2E + V | ready | partial | `scenarios/recording.md` |
| STU-001 | Studio | Open completed recording in Studio | P0 | M + E2E | ready | partial | `scenarios/studio.md` |
| STU-002 | Studio | Player does not cover content | P0 | M + V | ready | partial | `scenarios/studio.md` |
| STU-003 | Studio | Last transcript segment and action item remain reachable | P0 | M + V | ready | candidate | `scenarios/studio.md` |
| SMOKE-001 | Production smoke | Health, auth, upload, processing, persistence, download, and delete | P0 | S + E2E | ready | partial | `scenarios/production-smoke.md` |

## Phase 2 — workspace security and recovery

| ID | Area | Scenario | Priority | Type | Status | Automation | File |
|---|---|---|---:|---|---|---|---|
| WS-001 | Workspace | Default workspace bootstrap | P0 | M + E2E + API | ready | partial | `scenarios/workspace-rbac.md` |
| WS-002 | Workspace | Switch workspace without data leakage | P0 | M + E2E + API | ready | partial | `scenarios/workspace-rbac.md` |
| WS-003 | Workspace security | Backend enforces workspace boundary | P0 | API + E2E | ready | partial | `scenarios/workspace-rbac.md` |
| RBAC-001 | RBAC | Owner permission matrix | P0 | M + E2E + API | ready | partial | `scenarios/workspace-rbac.md` |
| RBAC-002 | RBAC | Viewer remains read-only | P0 | M + E2E + API | ready | partial | `scenarios/workspace-rbac.md` |
| QUE-001 | Queue | Queue survives navigation | P0 | M + E2E | automated | automated | `scenarios/queue-recovery.md` |
| QUE-002 | Queue | Queue survives browser refresh | P0 | M + E2E | ready | candidate | `scenarios/queue-recovery.md` |
| QUE-003 | Recovery | Backend restart while job is queued | P0 | API + S + recovery | blocked | candidate | `scenarios/queue-recovery.md` |
| QUE-004 | Recovery | Backend restart while job is processing | P0 | API + S + recovery | blocked | candidate | `scenarios/queue-recovery.md` |
| QUE-005 | Queue idempotency | Duplicate transcribe request | P0 | API + E2E | ready | partial | `scenarios/queue-recovery.md` |
| QUE-006 | Queue idempotency | Retry completed recording | P0 | API + E2E | ready | partial | `scenarios/queue-recovery.md` |

## Execution history

Execution results should be recorded in GitHub issue comments or release validation reports under `docs/qa/releases/`. Do not turn this index into a verbose execution log.