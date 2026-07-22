# Workspace and RBAC scenarios

## WS-001 — Default workspace bootstrap

### Metadata

- Area: Workspace / authenticated bootstrap
- Priority: P0
- Type: M + E2E + API
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/auth-session.spec.ts`, `tests/e2e/remote-api.spec.js`, workspace store tests

### Goal

Verify that a valid authenticated session resolves one intended default workspace, loads its state exactly once, and never resets visible data because of duplicate or out-of-order bootstrap responses.

### Environments

- Local remote mode
- Vercel preview with test backend
- Staging
- Production smoke with a dedicated QA workspace

### Viewports

- Primary: `1440x900`
- Responsive confirmation: `390x844`

### Test data

- User: `QA_OWNER_EMAIL`
- Expected workspace: `QA_WORKSPACE_NAME`
- Fixture state:
  - at least one completed meeting,
  - one task,
  - one person,
  - one note or meeting note,
  - no private production content.

### Preconditions

1. The QA user belongs to the expected workspace.
2. The account has a configured default workspace.
3. Browser storage is cleared or the previous session is removed.
4. Network and console inspection are available.
5. The initial backend state version or updated timestamp is known when supported.

### Steps

1. Open the authentication page in a clean browser context.
2. Log in with the QA owner account.
3. Observe requests to `/auth/session`, `/state/bootstrap`, workspace capabilities, integrations, and profile endpoints.
4. Confirm the authentication response identifies the expected user and workspace.
5. Confirm the application shows a loading/skeleton state while bootstrap is pending.
6. Confirm the shell becomes interactive only after a coherent workspace state is available.
7. Confirm the workspace switcher displays `QA_WORKSPACE_NAME`.
8. Open Studio and confirm the seeded meeting is visible.
9. Open Zadania and confirm the seeded task is visible.
10. Open Osoby and confirm the seeded person is visible.
11. Confirm no fixture disappears when later bootstrap, capability, or integration requests finish.
12. Confirm no duplicate copy of the seeded meeting, task, or person appears.
13. Refresh the page once.
14. Confirm the same workspace is restored.
15. Confirm the same fixture state remains visible after refresh.
16. Simulate a delayed duplicate bootstrap response where test tooling permits it.
17. Confirm an older response does not overwrite newer workspace state.
18. Inspect console errors, unhandled promise rejections, and unexpected `4xx`/`5xx` responses.
19. Repeat login and bootstrap at `390x844`.
20. Confirm loading, shell, workspace switcher, and navigation remain usable without horizontal overflow.

### Expected result

- One intended user and default workspace are resolved.
- Bootstrap shows an explicit loading state rather than stale or empty interactive data.
- The shell renders one coherent workspace snapshot.
- Duplicate or delayed bootstrap responses do not reset newer state.
- The seeded meeting, task, and person appear once.
- Refresh restores the same workspace and data.
- No foreign workspace data appears.
- No unexpected `401`, `403`, `409`, or `5xx` occurs.
- No token, cookie, authorization header, or private fixture content appears in evidence.

### Evidence

Capture:

- post-bootstrap desktop screenshot,
- mobile workspace-switcher screenshot,
- environment and build SHA,
- sanitized request sequence with status and duration,
- observed workspace ID/name,
- before/after counts for fixture entities,
- console errors with secrets removed.

### Cleanup

1. Log out or clear the QA session according to shared-account policy.
2. Do not delete the stable workspace fixture.
3. Close the browser context.

### Failure follow-up

Create a P0 defect when bootstrap loops, loads the wrong workspace, loses state, duplicates entities, allows stale responses to overwrite new data, or renders foreign data. Reference `WS-001` and the failed step.

---

## WS-002 — Switch workspace without data leakage

### Metadata

- Area: Workspace / switching and isolation
- Priority: P0
- Type: M + E2E + API
- Status: ready
- Automation: partial
- Target tests: new `tests/e2e/workspace-rbac.spec.ts`, workspace store integration tests

### Goal

Verify that switching between two workspaces replaces every workspace-scoped surface atomically, persists the selection, and never exposes entities from the previous workspace.

### Environments

- Local remote mode
- Vercel preview
- Staging

### Viewports

- `1440x900`
- `390x844`

### Test data

- QA user belonging to two workspaces:
  - `QA Workspace Alpha`,
  - `QA Workspace Beta`.
- Alpha contains uniquely named meeting/task/person/tag values with prefix `qa_alpha_`.
- Beta contains uniquely named values with prefix `qa_beta_`.

### Preconditions

1. `WS-001` passes.
2. The QA user is a member of both workspaces.
3. The workspaces contain no overlapping fixture names.
4. The selected workspace before the test is Alpha.
5. The executor can inspect state/bootstrap and integration requests.

### Steps

1. Log in and confirm Alpha is selected.
2. Open Studio, Nagrania, Zadania, Osoby, Notatki, and Kalendarz.
3. Confirm Alpha fixture values are visible in each applicable surface.
4. Open the workspace switcher.
5. Select Beta once.
6. Confirm the switcher enters a pending/disabled state that prevents duplicate switching.
7. Confirm the UI does not temporarily combine Alpha and Beta data.
8. Wait for Beta bootstrap to finish.
9. Confirm Beta is displayed as selected.
10. Revisit every core tab.
11. Confirm Beta fixture values are visible.
12. Confirm no `qa_alpha_` value remains visible, searchable, selectable, or actionable.
13. Open command palette and notifications where they contain workspace-scoped items.
14. Confirm those surfaces also reflect Beta only.
15. Refresh the browser.
16. Confirm Beta remains selected and its data remains visible.
17. Switch back to Alpha.
18. Confirm the same isolation assertions in the opposite direction.
19. Inspect network requests and confirm workspace IDs match the active selection.
20. Attempt rapid Alpha → Beta → Alpha switching where deterministic test tooling permits it.
21. Confirm the final selected workspace wins and no stale response overwrites it.
22. Repeat the normal Alpha → Beta switch on mobile.

### Expected result

- The active workspace changes once per deliberate action.
- All workspace-scoped data changes together.
- No previous-workspace meeting, recording, task, person, note, tag, calendar item, or integration state remains visible.
- Requests use the active workspace ID.
- Refresh preserves the final selection.
- Rapid switching does not produce mixed state or stale-response overwrite.
- Mobile switcher remains usable and focus returns predictably after selection.

### Evidence

Capture Alpha and Beta screenshots for at least Studio and Zadania, sanitized bootstrap request metadata, final workspace ID, and any stale-data selectors found during failure.

### Cleanup

Return to the default QA workspace and clear transient browser state created by rapid-switch testing.

### Failure follow-up

Create a P0 security/data-isolation issue when data from one workspace is visible or actionable in another. Include `WS-002`, both workspace IDs, affected entity type, screenshot, request IDs, and suspected store/query path.

---

## WS-003 — Backend enforces workspace boundary

### Metadata

- Area: Workspace / authorization boundary
- Priority: P0
- Type: API + E2E
- Status: ready
- Automation: partial
- Target tests: backend workspace/media/state route tests and `tests/e2e/workspace-rbac.spec.ts`

### Goal

Verify that changing a workspace identifier in a browser or direct API request cannot read or mutate another workspace, even when the UI action is hidden.

### Environments

- Local integration environment
- Staging
- Production smoke only with two isolated QA workspaces

### Test data

- User A: member of Workspace Alpha only.
- Workspace Beta: exists but User A is not a member.
- Known Beta entity IDs for controlled negative testing:
  - meeting,
  - recording,
  - task or state object.

### Preconditions

1. Test identities and workspace membership are deterministic.
2. The executor has sanitized fixture IDs but no private content.
3. User A has a valid session for Alpha.
4. Test cleanup is not required because all operations should be rejected.

### Steps

1. Log in as User A.
2. Confirm Alpha loads normally.
3. Request Beta workspace bootstrap using User A's session.
4. Expect `403` or the documented authorization error.
5. Request a known Beta meeting/recording through its direct route.
6. Expect `403` or a non-enumerating `404` according to policy.
7. Attempt to patch Beta workspace state.
8. Expect rejection and no state change.
9. Attempt to upload/finalize/transcribe against a Beta recording identifier.
10. Expect rejection before provider or storage cost is incurred.
11. Attempt to delete a Beta recording or task.
12. Expect rejection and confirm the entity remains unchanged.
13. In the browser, modify a workspace query/header through request interception where supported.
14. Confirm the UI shows a safe permission/session message and does not render Beta data.
15. Confirm logs record a sanitized authorization event without exposing tokens or Beta contents.
16. Confirm rate limiting and error handling do not convert the authorization failure into a `500`.

### Expected result

- Every foreign-workspace read and mutation is rejected server-side.
- UI hiding is not the only control.
- No storage, STT, LLM, or other paid operation starts for unauthorized requests.
- Error responses do not reveal sensitive entity contents.
- Beta data remains unchanged.
- Audit/log records identify route, actor, target workspace, and result without secrets.

### Evidence

Record method, route pattern, status, request ID, actor workspace, target workspace, and post-test unchanged-state assertion. Do not include authorization headers or private payloads.

### Cleanup

None expected. Verify that no unauthorized job or storage object was created.

### Failure follow-up

Any successful foreign-workspace read or mutation is a P0 security defect. Reference `WS-003`, affected route, actor role, target workspace, and sanitized proof.

---

## RBAC-001 — Owner permission matrix

### Metadata

- Area: RBAC / owner role
- Priority: P0
- Type: M + E2E + API
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/workspace-rbac.spec.ts`, backend permission matrix tests

### Goal

Verify that an owner can perform all intended owner actions, that each destructive or privileged action is explicit and auditable, and that no hidden backend permission mismatch causes false failures.

### Test data

- Dedicated owner account and disposable QA workspace.
- Disposable meeting, recording, task, person, voice profile, and member fixture.

### Preconditions

1. The permission matrix for owner is documented.
2. Destructive fixtures are disposable.
3. Audit/event inspection is available.
4. External-provider actions are mocked or bounded.

### Steps

1. Log in as owner.
2. Confirm owner role is visible in workspace/profile settings.
3. Create and edit a meeting.
4. Start or import a recording after consent.
5. Create, edit, move, complete, and delete a task.
6. Add, edit, and delete a manual person fixture.
7. Create or manage a voice profile using synthetic data.
8. Export permitted workspace/meeting data.
9. Invite or add a disposable member where supported.
10. Change that member's role.
11. Remove that member after confirmation.
12. Change workspace-level settings.
13. Delete a disposable recording and confirm persistence after refresh.
14. Confirm destructive actions require confirmation or a clear reversible path.
15. Inspect API responses for unexpected `403` or `500`.
16. Confirm audit events exist for privileged/destructive operations without raw audio/transcript data.
17. Repeat critical owner actions on mobile where exposed.

### Expected result

- Documented owner actions succeed.
- No undocumented privileged action is exposed.
- Destructive actions have confirmation, undo, or documented irreversible behavior.
- Changes persist after refresh.
- Audit records are sanitized and attributable.
- No owner action bypasses consent, workspace boundary, retention, or storage rules.

### Evidence

Capture representative owner UI states, action/status results, refresh persistence, and sanitized audit references.

### Cleanup

Delete all disposable entities, remove the disposable member, and confirm no queue/storage/job artifact remains.

### Failure follow-up

Create a P0/P1 defect when a documented owner action fails unexpectedly, bypasses a required control, or does not persist. Reference `RBAC-001` and the matrix row.

---

## RBAC-002 — Viewer remains read-only

### Metadata

- Area: RBAC / viewer role
- Priority: P0
- Type: M + E2E + API
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/workspace-rbac.spec.ts`, backend authorization tests

### Goal

Verify that a viewer can read allowed workspace information but cannot create, edit, delete, export restricted data, record audio, manage profiles, or mutate workspace membership through UI or direct API calls.

### Test data

- Viewer account in a QA workspace containing one meeting, recording, task, person, note, and voice profile.

### Preconditions

1. Owner-created fixtures exist.
2. Viewer role is confirmed in backend membership data.
3. The intended viewer read/export policy is documented.
4. API request inspection is available.

### Steps

1. Log in as viewer.
2. Confirm permitted read-only pages load.
3. Open Studio and Nagrania and confirm allowed data is readable.
4. Open Zadania, Osoby, Notatki, Kalendarz, and profile/settings.
5. Confirm create/edit/delete controls are hidden or disabled according to policy.
6. Confirm the global recording action is unavailable or disabled with an accessible reason.
7. Confirm workspace member-management controls are unavailable.
8. Confirm voice-profile mutation controls are unavailable.
9. Attempt keyboard shortcuts for recording or mutation.
10. Confirm they do not bypass the role restriction.
11. Attempt direct API calls for meeting edit, task create, recording delete, workspace patch, member update, voice-profile mutation, and restricted export.
12. Expect `403` or the documented safe denial.
13. Confirm no mutation occurred by reloading as owner or fetching state.
14. Confirm denied actions do not start paid provider/storage work.
15. Inspect logs/audit for sanitized denied-action records.
16. Repeat key UI checks at `390x844` and ensure hidden controls do not leave broken layout gaps.

### Expected result

- Viewer can access only documented read capabilities.
- All mutations are denied server-side.
- Hidden UI controls cannot be invoked through shortcuts, crafted requests, or stale client state.
- No business data changes.
- Denied requests are controlled and do not become `500`.
- Mobile layout remains coherent.

### Evidence

Capture read-only UI, disabled/absent recording action, sanitized API denial statuses, unchanged entity counts/versions, and owner-side verification when needed.

### Cleanup

None expected. Confirm the workspace state hash/version remains unchanged apart from harmless read telemetry.

### Failure follow-up

Any viewer mutation is a P0 security defect. Reference `RBAC-002`, route/action, before/after state, and role evidence.