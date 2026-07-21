# Premium test coverage plan

## Objective

VoiceLog OS should be considered premium-tested only when the application is covered as a complete business system, not only as a collection of isolated components.

Premium coverage means that every critical feature is verified across:

1. happy path,
2. loading and in-progress states,
3. empty states,
4. validation errors,
5. recoverable failures and retry,
6. permanent failures,
7. authorization and workspace boundaries,
8. refresh, restart, and persistence,
9. keyboard and touch interaction,
10. mobile, tablet, and desktop layouts,
11. browser compatibility,
12. privacy, consent, and audit behavior,
13. performance and capacity,
14. production observability and cleanup.

A feature is not premium-covered when it only has a render test or a mocked happy-path test.

## Current coverage audit

### Strong existing foundations

The repository already has strong engineering foundations:

- frontend and backend Vitest suites,
- Playwright smoke and production tests,
- deterministic audio fixtures,
- mocked remote audio pipeline coverage,
- visual regression at eight release viewports,
- accessibility, CSS, repository-hygiene, security, and build-warning audits,
- production system and persistence test harnesses,
- request/trace diagnostics and production monitoring,
- a release rehearsal and production smoke scripts.

The current audio Playwright suite already covers:

- start, pause, resume, and stop,
- unsupported microphone,
- permission denied,
- deterministic audio import,
- upload and transcription polling,
- retry after one failed upload,
- transcript and analysis attachment.

The visual suite already covers the core tabs at:

- 320x844,
- 390x844,
- 768x1024,
- 1024x768,
- 1366x768,
- 1440x900,
- 1600x900,
- 1920x1080.

### Material gaps

The application is not yet premium-covered because the following areas remain incomplete or insufficiently proven:

1. Browser E2E is effectively Chromium-only.
2. Production audio tests can still be skipped when secrets are missing.
3. Production persistence verifies meeting deletion, but not the full audio-storage lifecycle.
4. Authentication UI journeys are not comprehensively automated end to end.
5. Session expiry during upload and navigation needs deterministic browser coverage.
6. Password reset is not production-complete.
7. Backend consent enforcement is not yet covered because it is not yet implemented.
8. Workspace and RBAC permissions need a role-by-action matrix in E2E and API tests.
9. Tasks need lifecycle, concurrency, recurrence, conflict, delete/undo, and dependency coverage.
10. Google and Microsoft integrations need disconnected, expired-token, conflict, and reconnect scenarios.
11. Visual tests use strong deterministic fixtures, but many real interaction states remain uncovered.
12. Accessibility audits need keyboard journey, focus management, screen-reader semantics, and contrast evidence.
13. Critical backend modules are excluded from the main coverage calculation.
14. Frontend tests are excluded from the main TypeScript project.
15. Load tests and capacity baselines are not yet trustworthy.
16. Backup and restore verification does not yet have a green staging run.
17. Active CI and monitoring failures prevent the suite from acting as a reliable release signal.
18. There is no one current GO/NO-GO release evidence document.

## Premium quality targets

### Critical path automation target

- P0 business journeys: 100% automated.
- P1 core journeys: at least 90% automated.
- P2 secondary journeys: at least 75% automated or explicitly manual.
- Every production bug: regression test required.
- Every destructive action: confirmation, persistence, refresh, and authorization test required.
- Every asynchronous operation: queued, running, success, retryable failure, permanent failure, timeout, and refresh states required.

### Coverage target

Do not use one artificial global percentage as the only quality signal.

Critical areas should meet at minimum:

- lines/statements: 75%,
- branches: 65%,
- pure policy and normalization modules: 90%+,
- no critical module excluded without owner, reason, issue, and expiry.

### Browser target

- Chromium: full required suite.
- Microsoft Edge: release smoke.
- Firefox: core auth, recording import, navigation, tasks, and Studio smoke.
- WebKit/Safari: core auth, audio import, player, responsive, and permission-state smoke.

Physical microphone recording should be tested separately from deterministic fake-media automation.

## Test layers

| Layer | Purpose | Release role |
|---|---|---|
| Unit | Policies, reducers, normalization, validation, state transitions | Required for every behavior change |
| Component | Rendering, actions, accessibility semantics, error and loading states | Required for UI components |
| API integration | Auth, workspace, media, storage, jobs, audit, permissions | Required for backend changes |
| Browser E2E mocked | Deterministic UI and workflow validation | Required for every P0/P1 journey |
| Browser E2E remote | Frontend and real backend contract | Required for critical paths |
| Production smoke | Exact deployed SHA and real providers/storage | Release blocking |
| Visual regression | Layout and state consistency | Release blocking for UI changes |
| Accessibility | Automated scan plus keyboard journey | Release blocking for critical UI |
| Performance | API, upload, queue, and real-provider capacity | Required before broad rollout |
| Recovery | Restart, restore, retry, idempotency, cleanup | Release blocking for data workflows |

## Definition of done for a premium feature

A feature cannot be marked complete until all applicable checks are present:

- [ ] business acceptance criteria are automated,
- [ ] validation and unsafe input are tested,
- [ ] loading, empty, and error states are tested,
- [ ] retry and duplicate-prevention behavior is tested,
- [ ] unauthorized role behavior is tested,
- [ ] refresh and persistence are tested,
- [ ] keyboard and mobile behavior are tested,
- [ ] console and unexpected network errors are rejected,
- [ ] analytics/audit/monitoring evidence is sanitized,
- [ ] test data cleanup is deterministic,
- [ ] the scenario is listed in `TEST_SCENARIO_INDEX.md`,
- [ ] release-critical scenarios are linked to a Playwright or API test.

# Scenario catalogue

Status meanings used below:

- `covered`: existing automated coverage substantially verifies the scenario,
- `partial`: some unit/component/mock coverage exists, but the complete business result is not proven,
- `missing`: no adequate automated evidence was identified,
- `blocked`: depends on production configuration or an open production-readiness issue.

## 1. Authentication and session

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| AUTH-001 | P0 | Successful login and workspace bootstrap | UI login, session created, expected workspace, refresh remains authenticated, no console/5xx errors | partial |
| AUTH-002 | P0 | Invalid credentials | Generic message, 401 not 500, no session, no account enumeration, form remains usable | partial |
| AUTH-003 | P0 | Expired session during navigation | Protected request returns 401, stale data disabled, login recovery, no redirect loop | partial |
| AUTH-004 | P0 | Expired session during upload | Upload not falsely successful, no infinite retry, no duplicate queue item, re-login recovery | missing |
| AUTH-005 | P1 | Logout current session | Token/session revoked, protected requests fail, browser state cleared, back button does not restore access | missing |
| AUTH-006 | P1 | Logout in second tab | Session revocation propagates or next protected request signs out both tabs | missing |
| AUTH-007 | P1 | Registration success | Account and default workspace created once, duplicate submission prevented | partial |
| AUTH-008 | P1 | Duplicate registration | Safe conflict response, no duplicate user/workspace, no account enumeration | partial |
| AUTH-009 | P1 | Weak password rejected | Shared frontend/backend policy, accessible guidance, no password logging | blocked |
| AUTH-010 | P0 | Password reset request | Real delivery or explicit disabled state, non-enumerating response, rate limit | blocked |
| AUTH-011 | P1 | Password reset success | Single-use token, expiry, old sessions revoked, login with new password | blocked |
| AUTH-012 | P1 | Wrong/expired/reset token reuse | Controlled rejection, attempt limit, no token leakage | blocked |
| AUTH-013 | P1 | Google sign-in success | Correct workspace, reload persistence, no duplicate local account | partial |
| AUTH-014 | P1 | Google sign-in failure/cancel | Clear recovery, no partial session, no infinite spinner | missing |
| AUTH-015 | P1 | Concurrent login submissions | Exactly one session result and one navigation | missing |

## 2. Workspace and RBAC

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| WS-001 | P0 | Default workspace bootstrap | Correct workspace and state loaded once, no duplicate bootstrap requests causing state reset | partial |
| WS-002 | P0 | Switch workspace | All visible data changes scope, no data leakage, selected workspace persists after refresh | partial |
| WS-003 | P0 | Workspace boundary enforcement | API rejects another workspace ID with 403, UI never renders foreign data | partial |
| WS-004 | P1 | Create workspace | One workspace created, owner membership, safe retry/idempotency | partial |
| WS-005 | P1 | Join by invite | Valid invite works once, invalid/expired invite safe error | missing |
| WS-006 | P1 | Remove member | Permission checked, member loses access immediately, audit event written | partial |
| WS-007 | P1 | Change member role | Backend authoritative, UI updates, refresh persists | partial |
| WS-008 | P1 | Delete or archive workspace | Confirmation, dependent data policy, no orphaned access | missing |
| RBAC-001 | P0 | Owner permissions | All owner actions allowed and audited | partial |
| RBAC-002 | P0 | Viewer read-only | No create/edit/delete/export/record operations | partial |
| RBAC-003 | P1 | Operator permissions | Recording operations allowed only within matrix | partial |
| RBAC-004 | P1 | Auditor permissions | Audit read/export allowed, business data mutation denied | partial |
| RBAC-005 | P1 | UI hidden action cannot bypass backend | Direct API request still returns 403 | partial |
| RBAC-006 | P1 | Role change during active session | Next protected action uses new permissions | missing |

## 3. Recording capture and import

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| REC-001 | P0 | Start, pause, resume, stop | One session and queue item, correct visible states, no duplicate recording | covered |
| REC-002 | P0 | Unsupported microphone | Safe message, no queue item, alternative import action | covered |
| REC-003 | P0 | Permission denied | Safe message, browser guidance, no queue item | covered |
| REC-004 | P0 | Import deterministic short audio | One upload, transcript attached, opening imported meeting works | covered |
| REC-005 | P0 | Upload to transcript ready | Upload, start job, polling, done, transcript and analysis visible | covered with mocks |
| REC-006 | P0 | Retry one failed upload | Retryable state, one controlled retry, no duplicate transcription job | covered with mocks |
| REC-007 | P0 | Refresh while processing | Queue restored, processing resumes, meeting remains visible | partial |
| REC-008 | P0 | Permanent upload failure | No retry action, re-import/delete guidance, state persists after refresh | partial |
| REC-009 | P1 | Stop during startup race | No orphan meeting, no active tracks, no duplicate queue item | missing |
| REC-010 | P1 | Double-click start/stop | Debounced/idempotent, one recording only | missing |
| REC-011 | P1 | Browser tab hidden during recording | Defined behavior, timer and capture state consistent | missing |
| REC-012 | P1 | Browser refresh during active local recording | Explicit warning or recoverable policy, no false success | missing |
| REC-013 | P1 | Local storage quota exceeded | Clear error, audio not silently lost, export/retry guidance | partial |
| REC-014 | P1 | Offline before upload | Queue remains local, offline message, resumes once online | partial |
| REC-015 | P1 | Network loss mid-upload | Bounded retry, resumable chunk state, no duplicate object | partial |
| REC-016 | P1 | Unsupported file type | Validation before upload, safe message, no meeting pollution | partial |
| REC-017 | P1 | Oversized file | Upload policy enforced in UI and backend, no partial orphan | partial |
| REC-018 | P1 | Zero-byte/corrupt file | Rejected safely, no job, actionable message | partial |
| REC-019 | P2 | Multiple files selected | Product policy enforced consistently, predictable queue ordering | missing |
| REC-020 | P2 | Long recording policy | Client preprocessing skipped when required, upload remains stable | partial |

## 4. Queue, jobs, retry, and recovery

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| QUE-001 | P0 | Queue survives navigation | Fresh local recording remains visible in Studio and Recordings | covered |
| QUE-002 | P0 | Queue survives refresh | Persisted item normalizes and processing resumes once | partial |
| QUE-003 | P0 | Backend restart during queued job | Durable lease/recovery, no lost job, no duplicate completion | blocked |
| QUE-004 | P0 | Backend restart during processing | Job recovered or expired lease reclaimed | blocked |
| QUE-005 | P0 | Duplicate transcribe request | Idempotent result, one active job | partial |
| QUE-006 | P0 | Retry completed recording | No duplicate job; returns current completed state | partial |
| QUE-007 | P1 | Retry transient failure | Retry count/backoff changes, final success or controlled failure | partial |
| QUE-008 | P1 | Retry limit reached | Converts to permanent failure with next action | partial |
| QUE-009 | P1 | Poll timeout | User sees delayed state, queue remains recoverable | missing |
| QUE-010 | P1 | Dead-letter/manual replay | Failed job visible to operator, replay audited and idempotent | blocked |
| QUE-011 | P1 | Two tabs process same item | Only one owner/lease, no duplicate upload/job | missing |
| QUE-012 | P1 | Delete queued item | Stops local processing, cleans storage/job references safely | partial |
| QUE-013 | P2 | Queue ordering | Stable deterministic order and no starvation | partial |
| QUE-014 | P2 | Memory pressure postpones work | Durable item retained, no data loss, observability event | missing |
| QUE-015 | P2 | Queue diagnostics | Operator can identify stage, attempts, request ID, and reason without secrets | partial |

## 5. Recordings library

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| LIB-001 | P0 | List recordings and queue states | Correct rows and user-facing state mapping | partial |
| LIB-002 | P1 | Open recording in Studio | Correct meeting/recording selected and survives refresh | partial |
| LIB-003 | P1 | Search by title | Correct filtering, clear no-results state | partial |
| LIB-004 | P1 | Filter by status/date/tag | Combined filters deterministic and resettable | partial |
| LIB-005 | P1 | Sort columns | Stable sorting and keyboard-accessible header control | partial |
| LIB-006 | P1 | Delete recording | Confirmation, backend/storage deletion, refresh persistence, audit | partial |
| LIB-007 | P1 | Delete failure | Row remains, safe error, retry available | missing |
| LIB-008 | P1 | Empty library | Premium empty state and clear primary action | visual partial |
| LIB-009 | P1 | Backend unavailable | Existing local queue visible, remote data error is actionable | partial |
| LIB-010 | P1 | Pagination/large list | Virtualization or pagination, stable selection, acceptable performance | missing |
| LIB-011 | P2 | Download audio | Authorized download, filename/content type, error state | partial |
| LIB-012 | P2 | Export transcript/notes | Correct content, encoding, permissions, empty-state behavior | partial |

## 6. Studio workspace

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| STU-001 | P0 | Open completed recording | Transcript, analysis, speakers, and player load without runtime error | partial |
| STU-002 | P0 | Player never covers content | Last action item and transcript segment reachable on all release viewports | visual partial |
| STU-003 | P0 | Audio loading/error/retry | Loading shell, one manual retry, no repeated 404 loop | component covered |
| STU-004 | P1 | Tabs preserve selected meeting | Switching analysis tabs does not reset selection or edits | partial |
| STU-005 | P1 | Meeting header and actions | Correct metadata, permissions, responsive action hierarchy | visual partial |
| STU-006 | P1 | Add/edit brief | Save success/error/loading, refresh persistence, validation | missing |
| STU-007 | P1 | Export actions | Permission checked, correct file, no export on empty data | partial |
| STU-008 | P1 | Degraded capability banner | Short message, details, keyboard, mobile wrap | visual partial |
| STU-009 | P1 | AI analysis fallback | Transcript remains usable, fallback clearly identified | partial |
| STU-010 | P1 | Source-linked analysis evidence | Citation opens matching transcript segment; unsupported claim flagged | component covered |
| STU-011 | P1 | Action item creates task | Source meeting/quote retained, one task only | partial |
| STU-012 | P1 | Active playback segment | Audio time highlights correct segment and scroll behavior is controlled | partial |
| STU-013 | P1 | Speaker rename persistence | Save, error, refresh, remote profile option | partial |
| STU-014 | P1 | Transcript edit persistence | Save, optimistic rollback, conflict/error, refresh | missing |
| STU-015 | P1 | Empty transcript | Diagnostic, retry, no false analysis content | component covered |
| STU-016 | P2 | Mobile tabbed layout | Summary/transcript/tasks accessible without compressed two-column view | missing |

## 7. Transcript and speaker workflow

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| TRN-001 | P1 | Search transcript | Matching text highlighted, count/navigation, no-results state | partial |
| TRN-002 | P1 | Replace text | Preview/confirmation, correct scope, undo or safe rollback | missing |
| TRN-003 | P1 | Timestamp seeks audio | Correct time, play state preserved, keyboard accessible | partial |
| TRN-004 | P1 | Edit segment text | Validation, save, error rollback, refresh persistence | partial |
| TRN-005 | P1 | Rename speaker | All intended segments updated, unrelated speakers unchanged | partial |
| TRN-006 | P1 | Assign verified voice profile | Only valid profiles listed, save error visible, refresh persists | partial |
| TRN-007 | P1 | Copy quote | Correct text copied, accessible confirmation | partial |
| TRN-008 | P1 | Create task/note from quote | Source link retained and duplicate creation prevented | missing |
| TRN-009 | P1 | Long transcript virtualization | Search, active segment, and edit remain stable | missing |
| TRN-010 | P1 | Multi-speaker diarization | Names, colors, percentages, and segment mapping consistent | partial |
| TRN-011 | P1 | Diarization unavailable | Transcript usable, limitation explained, manual rename works | partial |
| TRN-012 | P2 | Keyboard-only segment actions | Menu, rename, copy, seek, edit reachable with focus visible | missing |
| TRN-013 | P2 | Screen-reader semantics | Speaker, time, text, active state, and actions announced clearly | missing |
| TRN-014 | P2 | Special characters and long words | No truncation corruption or horizontal overflow | visual partial |

## 8. Tasks

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| TSK-001 | P0 | Create task | Required validation, one task, selected workspace, refresh persistence | partial |
| TSK-002 | P1 | Edit task | Title, notes, dates, priority, assignees, tags persist | partial |
| TSK-003 | P1 | Canonical lifecycle across views | Same status in list, Kanban, details, filters, and counts | missing |
| TSK-004 | P1 | Move task in Kanban | Status/order persists and keyboard alternative exists | partial |
| TSK-005 | P1 | Reorder repeatedly | Stable order after many operations and rebalance | missing |
| TSK-006 | P1 | Complete/reopen | History/event created and all views update | partial |
| TSK-007 | P1 | Recurring task idempotency | One next occurrence despite double click/retry/sync | missing |
| TSK-008 | P1 | Dependency blocker | Blocked badge, exact blockers, completion rejected | missing |
| TSK-009 | P1 | Delete and undo | Consistent list/Kanban/detail state, refresh persistence | missing |
| TSK-010 | P1 | Bulk complete/delete | Same lifecycle rules and undo behavior as single action | partial |
| TSK-011 | P1 | Workspace concurrent edit | Conflict detected; local/remote/merge resolution persists | missing |
| TSK-012 | P1 | Google task conflict | Conflict UI and chosen resolution persist | partial |
| TSK-013 | P1 | Google import/export idempotency | No duplicates, list selection required, errors actionable | partial |
| TSK-014 | P2 | My Day | Correct smart list, badge, refresh persistence | missing |
| TSK-015 | P2 | Reminder display | Clear semantics; no false promise of push notification | missing |
| TSK-016 | P2 | Large task set | Performance, selection, filtering, virtualized/table overflow | missing |

## 9. Calendar, notes, people, and profiles

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| CAL-001 | P1 | Month navigation | Correct dates and timezone behavior | partial |
| CAL-002 | P1 | Create/reschedule meeting | Save and refresh persistence, conflict handling | partial |
| CAL-003 | P1 | Open meeting/task from calendar | Correct target selection and back navigation | partial |
| CAL-004 | P1 | Google event conflict | Conflict visible and resolution safe | missing |
| CAL-005 | P2 | DST/timezone boundary | Date/time remains correct through timezone changes | missing |
| NTE-001 | P1 | Create manual note | Validation, persistence, workspace scope | partial |
| NTE-002 | P1 | Open meeting note | Correct source meeting and analysis links | partial |
| NTE-003 | P1 | Empty/loading/error states | Premium state and retry | visual partial |
| PPL-001 | P1 | People list to detail | Correct person and back navigation | partial |
| PPL-002 | P1 | Edit person | Save, error, refresh persistence | partial |
| PPL-003 | P1 | Delete person | Confirmation, relationship policy, error rollback | partial |
| PPL-004 | P2 | Large people list | Search/filter/performance/mobile | missing |
| VOICE-001 | P1 | Create profile from sample | Embedding required, durable storage, metadata | partial |
| VOICE-002 | P1 | Create profile from transcript speaker | Correct segment/speaker association | partial |
| VOICE-003 | P1 | Empty embedding rejected | No invalid profile row saved | missing |
| VOICE-004 | P1 | Add sample to existing profile | Upsert instead of duplicate profile | missing |
| VOICE-005 | P1 | Permission matrix | Viewer denied, owner/admin allowed | partial |
| VOICE-006 | P2 | Confidence review | Ambiguous labels require confirmation and correction | missing |

## 10. Google and Microsoft integrations

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| INT-001 | P1 | Integration disconnected state | Clear connect action and no repeated errors | visual partial |
| INT-002 | P1 | OAuth connect success | Correct account/scopes, refresh persistence | partial |
| INT-003 | P1 | OAuth cancel/failure | No partial connection, recovery action | missing |
| INT-004 | P1 | Expired provider token | Clear reconnect state, core app remains usable | partial |
| INT-005 | P1 | Disconnect | Tokens revoked/removed, UI updates, no background calls | partial |
| INT-006 | P1 | Google Calendar refresh | Events imported once, timezone correct | partial |
| INT-007 | P1 | Google Tasks list required | Safe message and selection path | partial |
| INT-008 | P1 | Microsoft Calendar refresh | Events imported once, errors isolated | partial |
| INT-009 | P1 | Microsoft Tasks import/export | Idempotency and conflict behavior | partial |
| INT-010 | P2 | Provider outage | Core app continues, retry/backoff, monitoring sanitized | missing |

## 11. Accessibility, visual quality, and responsive behavior

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| UX-001 | P0 | No horizontal overflow in core tabs | Eight release viewports, main states | visual partial |
| UX-002 | P1 | Mobile navigation | Open/close, Escape, overlay, focus return, route selection | partial |
| UX-003 | P1 | Keyboard-only critical journey | Login, navigation, recording, task, transcript, logout | missing |
| UX-004 | P1 | Modal focus trap | Initial focus, Tab loop, Escape, return focus | partial |
| UX-005 | P1 | Popover/menu focus | Arrow/Tab behavior, outside click, layer ordering | partial |
| UX-006 | P1 | Live status announcements | Queue, errors, retry, notification status use correct aria-live behavior | partial |
| UX-007 | P1 | Contrast and focus visibility | All interactive states meet approved contrast | audit partial |
| UX-008 | P1 | Zoom 200% | Core workflows remain usable without content loss | missing |
| UX-009 | P2 | Reduced motion | No essential information depends on animation | partial |
| UX-010 | P2 | High text length/localization | Long Polish/English labels and errors do not break layout | missing |
| UX-011 | P2 | Touch targets | Critical controls meet minimum target size | audit partial |
| UX-012 | P2 | Screen-reader landmarks/headings | Logical navigation and names across core tabs | missing |
| VIS-001 | P1 | Loading/empty/error visual matrix | Every core tab has stable screenshots | partial |
| VIS-002 | P1 | Overlay/layer matrix | Modal, popover, toast, player, mobile sidebar | partial |
| VIS-003 | P2 | Premium reference screens | Approved reference fixture drift reviewed deliberately | covered |

## 12. Security, privacy, and compliance

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| SEC-001 | P0 | Backend consent required | Missing/stale/wrong-workspace consent rejected | blocked |
| SEC-002 | P0 | Production database fail closed | No SQLite fallback in production/Railway | blocked |
| SEC-003 | P0 | Persistent storage fail closed | No local filesystem production fallback | blocked |
| SEC-004 | P1 | Session token hashing/revocation | Raw token absent from DB/logs; logout/revoke immediate | blocked |
| SEC-005 | P1 | Browser token storage | No new production bearer token in localStorage/IDB | blocked |
| SEC-006 | P1 | CSRF protection | Cross-site state-changing requests rejected | blocked |
| SEC-007 | P1 | CSP | No unsafe-eval; allowed providers explicitly tested | blocked |
| SEC-008 | P1 | Password policy | Shared server/client policy and rate limits | blocked |
| SEC-009 | P1 | IDOR workspace/media | Cross-workspace IDs rejected consistently | partial |
| SEC-010 | P1 | Upload payload/content type limits | Backend authoritative and safe errors | partial |
| SEC-011 | P1 | Audit redaction | No token, raw transcript, audio, prompt, or provider payload | partial |
| SEC-012 | P2 | Secret hygiene | Repository, artifacts, screenshots, and logs scanned | audit covered |

## 13. Production, recovery, and operations

| ID | P | Scenario | Mandatory assertions | Current |
|---|---:|---|---|---|
| SMOKE-001 | P0 | Mandatory production audio journey | Exact SHA, auth, upload, transcribe, reload, download, retry, delete | blocked |
| SMOKE-002 | P0 | Storage persistence across redeploy | Audio and transcript survive backend restart | blocked |
| SMOKE-003 | P0 | Missing smoke configuration | Required gate fails, never reports skipped success | blocked |
| OPS-001 | P0 | PostgreSQL startup validation | Missing/malformed URL stops server before listen | blocked |
| OPS-002 | P0 | Backup restore verification | Isolated staging restore and machine-readable evidence | blocked |
| OPS-003 | P1 | Health/readiness contract | DB/storage/provider status accurate and redacted | partial |
| OPS-004 | P1 | Monitoring issue correlation | Request ID/trace ID links failure without sensitive data | partial |
| OPS-005 | P1 | Scheduled maintenance idempotency | Dry run/apply, no uncontrolled deletion, artifacts retained | partial |
| OPS-006 | P1 | Retention cleanup | Policy applied, holds/exceptions respected, audit written | partial |
| OPS-007 | P1 | Release rollback rehearsal | Previous build restored and data migration constraints checked | missing |
| PERF-001 | P1 | API baseline | P50/P90/P95/P99 and error rate recorded | blocked |
| PERF-002 | P1 | Upload baseline | Sizes/durations, throughput, memory, failures | blocked |
| PERF-003 | P1 | Queue capacity | Sustainable recordings/hour and backlog thresholds | blocked |
| PERF-004 | P1 | Long audio capacity | 5/15/30/60/90-minute fixtures with bounded cost | blocked |
| PERF-005 | P2 | Soak test | Memory/handle/storage leakage over sustained operation | blocked |

# Required implementation waves

## Wave 0 — make the test signal trustworthy

1. Close active CI quality-gate failures.
2. Stabilize Node/pnpm/native dependency workflow setup.
3. Add critical-path coverage instead of excluding critical modules.
4. Add Firefox and WebKit smoke projects.
5. Make skipped P0 tests fail required release jobs.

## Wave 1 — public-production blockers

Automate and prove:

- AUTH-001 through AUTH-004,
- SEC-001 through SEC-003,
- REC-001 through REC-008,
- QUE-001 through QUE-006,
- SMOKE-001 through SMOKE-003,
- OPS-001 and OPS-002.

## Wave 2 — premium core product

Automate:

- Studio and transcript P0/P1,
- tasks lifecycle and conflicts,
- workspace/RBAC matrix,
- recordings library destructive actions,
- integration expiry/reconnect paths,
- keyboard-only critical journey.

## Wave 3 — scale and enterprise quality

Automate and measure:

- performance/capacity,
- restore/rollback exercises,
- extended browser matrix,
- audit/export/retention scenarios,
- supply-chain and reproducible-build evidence.

# CI suite design

## Pull request suite

Target duration: under 20 minutes.

- typecheck and lint,
- focused unit/component tests,
- backend route/integration tests,
- Chromium mocked critical E2E,
- visual state subset,
- accessibility strict audit,
- secret/security audit.

## Main branch suite

- complete unit/component/backend suite,
- Chromium full browser suite,
- Firefox/WebKit core smoke,
- complete visual matrix,
- critical-path coverage,
- remote API E2E,
- workflow contract tests.

## Release candidate suite

- release rehearsal,
- exact-SHA production/staging audio journey,
- persistent storage/redeploy test,
- backup restore evidence,
- load/capacity smoke,
- active-monitoring review,
- GO/NO-GO report.

# Evidence requirements

Every failed premium scenario should retain:

- Playwright trace,
- failure screenshot,
- video for browser failures,
- sanitized console errors,
- sanitized failed request method/route/status,
- environment and Git SHA,
- fixture identifiers,
- cleanup outcome,
- linked GitHub issue.

Production evidence must never contain credentials, bearer tokens, raw audio, private transcript content, or provider request payloads.

# Premium exit criteria

The application may be described as premium-covered only when:

- [ ] all P0 scenarios are automated and green,
- [ ] all critical production scenarios cannot be skipped,
- [ ] exact deployed SHA is verified,
- [ ] persistent audio is proven across restart/redeploy,
- [ ] restore verification is green,
- [ ] critical auth/session/consent/storage tests are measured by coverage,
- [ ] Chromium full suite and Firefox/WebKit smoke are green,
- [ ] keyboard and mobile critical journeys are green,
- [ ] no active release-blocking monitoring issue exists,
- [ ] three consecutive production/staging release rehearsals pass,
- [ ] one GO/NO-GO report links all retained evidence.
