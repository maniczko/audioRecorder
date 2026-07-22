# Recording and upload scenarios

## REC-001 — Start, pause, resume, and stop recording

### Metadata

- Area: Recording / browser recorder lifecycle
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that the browser recorder can start, pause, resume, and stop a deterministic QA recording, while presenting clear state changes and creating exactly one recoverable recording or queue item.

### Environments

- Local development
- Vercel preview
- Staging
- Production only with a dedicated QA account, synthetic input, and cleanup permission

### Viewports

- Primary: `1440x900`
- Responsive confirmation: `390x844`

### Test data

- User: QA owner or member with recording permission
- Workspace: `QA_WORKSPACE_NAME`
- Audio input: synthetic or browser-provided fake microphone input
- Recording duration: 8–15 seconds
- Title prefix: `qa_rec_001_`

Do not use real customer speech or a personal recording.

### Preconditions

1. `AUTH-001` passes.
2. The QA user can record audio.
3. A deterministic microphone input is available.
4. No recording is active.
5. The initial count of matching QA queue items is known.

### Steps

1. Log in and select `QA_WORKSPACE_NAME`.
2. Open Studio.
3. Select the primary recording action.
4. Accept the recording consent dialog.
5. Grant microphone access.
6. Confirm that active recording state and elapsed time are visible.
7. Record for at least three seconds.
8. Select Pause.
9. Confirm paused state and suspended active timer progression.
10. Select Resume.
11. Confirm the same recording returns to active state.
12. Record for at least three seconds.
13. Select Stop once.
14. Confirm recording state ends.
15. Confirm exactly one queue item or recording is created.
16. Confirm a valid pipeline state is visible.
17. Refresh after the item appears.
18. Confirm the item remains visible and is not duplicated.
19. Inspect console and network failures.
20. Repeat control-layout confirmation at `390x844`.

### Expected result

- One recording session and one queue item are created.
- Pause and resume operate on the same recording.
- Stop releases the active recording state.
- No duplicate upload, recording, or transcription job is created.
- Refresh does not leave a false active state or lose server-backed work.
- Mobile controls remain accessible without horizontal overflow.
- No secret or private audio content appears in evidence.

### Evidence

Capture active, paused, final queue, and mobile-control screenshots; environment; build SHA; before/after item counts; and sanitized console/network failures.

### Cleanup

Delete the QA recording when safe, revoke microphone permission when required, and confirm no recording remains active.

### Failure follow-up

Create a P0 defect referencing `REC-001`, the failed step, browser, viewport, build SHA, before/after counts, and proposed regression test.

### Notes

The automated implementation should use deterministic fake media rather than physical hardware.

---

## REC-002 — Unsupported microphone

### Metadata

- Area: Recording / unsupported browser capability
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: automated
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that a browser without `navigator.mediaDevices` or `MediaRecorder` receives a clear, premium recovery state and does not create recording data.

### Environments

- Local development
- Vercel preview
- Staging

### Viewports

- `1440x900`
- `390x844`

### Test data

- Logged-in QA user
- Browser context with `navigator.mediaDevices` and `MediaRecorder` disabled before application load

### Preconditions

1. The user is logged in.
2. Browser capability override is installed before navigation.
3. Queue and recordings counts are known.

### Steps

1. Open Studio in the unsupported-media browser context.
2. Select the recording action.
3. Accept the consent dialog.
4. Observe the resulting state.
5. Confirm the message explains that microphone recording is unsupported.
6. Confirm an import-audio alternative or clear next action is available.
7. Confirm no active timer, waveform, or Stop control appears.
8. Confirm no queue item, meeting, recording, upload, or transcription request is created.
9. Navigate to another tab and back to Studio.
10. Confirm the error state remains stable and does not repeatedly prompt.
11. Inspect console errors and failed network requests.
12. Repeat at `390x844`.

### Expected result

- The application does not crash.
- The user receives a clear non-technical explanation and alternative action.
- No recording artifacts are created.
- No protected media request is sent.
- The state remains usable after navigation.
- The mobile message and action remain visible.

### Evidence

Capture desktop and mobile unsupported-state screenshots, queue/recording counts, and sanitized console/network evidence.

### Cleanup

Close the browser context. No business data should require cleanup.

### Failure follow-up

Create a P0 defect if the app crashes, creates data, hides the recovery action, or becomes unusable. Reference `REC-002`.

### Notes

This scenario is already substantially automated, but manual browser confirmation should verify the final copy and import action.

---

## REC-003 — Microphone permission denied

### Metadata

- Area: Recording / browser permission
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: automated
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that denied microphone permission is handled safely and distinctly from unsupported hardware.

### Environments

- Local development
- Vercel preview
- Staging

### Viewports

- `1440x900`
- `390x844`

### Test data

- Logged-in QA user
- Browser context returning `NotAllowedError` from `getUserMedia`

### Preconditions

1. Queue and recording counts are known.
2. Permission is configured as denied before recording starts.

### Steps

1. Open Studio.
2. Select the recording action and accept consent.
3. Deny microphone permission or use the deterministic denied fixture.
4. Confirm the application shows a permission-specific message.
5. Confirm the message explains how to change browser permission or use import.
6. Confirm no active recording controls remain.
7. Confirm no queue item, meeting, recording, upload, or job is created.
8. Navigate away and back.
9. Confirm the error does not trigger repeated permission prompts automatically.
10. Change permission to granted in a new controlled context.
11. Confirm the user can start recording normally after an explicit retry.
12. Inspect console/network evidence.
13. Repeat the denied-state layout at `390x844`.

### Expected result

- Permission denial is not shown as a generic fatal error.
- No recording data is created before access is granted.
- Retry is explicit and does not loop.
- Granting permission later allows a new recording attempt.
- No sensitive browser details are logged.

### Evidence

Capture denied and recovered states, before/after data counts, browser/viewport, environment, and build SHA.

### Cleanup

Restore browser permission to the shared QA policy and remove any successful QA recording created during recovery confirmation.

### Failure follow-up

Create a P0 defect when denial creates data, loops, crashes, or prevents later recovery. Reference `REC-003`.

---

## REC-004 — Import short deterministic audio file

### Metadata

- Area: Recording / file import
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: automated
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that a safe deterministic audio fixture can be imported once, uploaded, processed, and opened in Studio.

### Environments

- Local remote-mode development
- Vercel preview with test backend
- Staging
- Production only through controlled smoke

### Viewports

- Primary: `1440x900`
- Import control confirmation: `390x844`

### Test data

- Fixture: `tests/e2e/fixtures/audio/` or `QA_AUDIO_FIXTURE_PATH`
- Duration: 3–15 seconds
- Synthetic speech/tone only
- Filename prefix: `qa_rec_004_`

### Preconditions

1. Authentication and workspace bootstrap pass.
2. Remote media mode is enabled.
3. The fixture is non-private and supported.
4. Initial matching recording count is known.

### Steps

1. Open Nagrania.
2. Activate the import control.
3. Select the deterministic fixture once.
4. Confirm one pending/imported item appears.
5. Confirm the UI presents upload/processing status rather than a false empty transcript.
6. Wait for a terminal result.
7. For success, confirm one recording and one transcript are attached.
8. Open the imported recording in Studio.
9. Confirm title, duration, transcript, and player shell correspond to the imported file.
10. Refresh and confirm the same item remains visible.
11. Confirm no duplicate meeting or recording exists.
12. Inspect upload/transcribe request counts and failures.
13. Confirm the mobile import control is reachable at `390x844`.

### Expected result

- One import creates one meeting/recording path.
- Status progression is understandable.
- Successful processing attaches the transcript once.
- Opening from Nagrania selects the correct Studio recording.
- Refresh preserves the item.
- No raw fixture content appears in logs or screenshots.

### Evidence

Capture import, processing, and Studio result screenshots; fixture name/duration; request counts; item counts; environment; and SHA.

### Cleanup

Delete the imported QA recording and confirm data/storage cleanup where available.

### Failure follow-up

Create a P0 defect for lost, duplicated, falsely completed, or unopenable imports. Reference `REC-004`.

---

## REC-005 — Upload through transcript ready

### Metadata

- Area: Recording pipeline / critical happy path
- Priority: P0
- Type: M + E2E + S
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/audio-pipeline.spec.ts`, production smoke scripts

### Goal

Verify the complete user-visible pipeline from accepted recording/import through upload, queued processing, transcription completion, and durable display of transcript and analysis.

### Environments

- Local remote mode with deterministic mocks
- Staging with real storage/STT
- Production release smoke after blockers are resolved

### Viewports

- `1440x900`
- `390x844` for status visibility

### Test data

- Deterministic short audio fixture
- Dedicated QA user/workspace
- Unique title prefix `qa_rec_005_`

### Preconditions

1. Remote API and media mode are enabled.
2. Required storage and STT configuration is available.
3. Initial queue, job, recording, and storage-object counts are known when observable.

### Steps

1. Start a synthetic recording or import the fixture.
2. Confirm one queue item appears.
3. Confirm upload status is visible.
4. Confirm the upload request succeeds once.
5. Confirm transcription start returns queued/processing rather than synchronous false success.
6. Observe at least one queued/processing status.
7. Confirm the UI does not show a final “no transcript” state while processing.
8. Wait until `done`, controlled `empty`, or explicit failure.
9. For `done`, confirm transcript segments, speaker metadata, and analysis are attached.
10. Open the recording in Studio and Nagrania.
11. Refresh the browser.
12. Confirm final state persists and no active queue item remains unnecessarily.
13. Confirm exactly one upload object and one transcription job were created.
14. Inspect console, network, request IDs, and status durations.
15. In staging/production, download the stored audio and validate non-zero content.

### Expected result

- Every stage is observable and user-safe.
- The final state matches the backend result.
- Completion is durable after refresh.
- No duplicate upload, storage object, or job exists.
- Controlled empty transcript is distinguished from failure.
- Real-provider evidence contains no raw transcript or audio.

### Evidence

Capture status progression, final Studio state, request/job identifiers, durations, deployed SHA, and cleanup result. Production evidence must be redacted.

### Cleanup

Delete the QA recording and verify queue, database, and storage cleanup in staging/production.

### Failure follow-up

Create a P0 defect for skipped stages, false success, lost persistence, duplicate work, or unclassified failure. Reference `REC-005`.

### Notes

Mocked coverage exists. Real staging/production proof remains release-blocking.

---

## REC-006 — Retry after upload failure

### Metadata

- Area: Recording pipeline / retry and idempotency
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: automated with mocks
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that one transient upload failure remains recoverable and a single user retry succeeds without duplicates.

### Environments

- Local remote mode with first-upload failure fixture
- Vercel preview/test backend
- Staging fault-injection environment

### Viewports

- `1440x900`
- `390x844`

### Test data

- Deterministic short audio fixture
- Route fixture failing only the first upload request

### Preconditions

1. The pipeline is able to succeed after the first failure.
2. Initial queue/recording/job counts are known.

### Steps

1. Import the fixture.
2. Force the first upload request to return a controlled transient failure.
3. Confirm the item remains visible as retryable.
4. Confirm the error explains the next action.
5. Refresh before retry and confirm the retryable state persists.
6. Select Retry once.
7. Confirm the retry action becomes busy/disabled while running.
8. Confirm the second upload succeeds.
9. Confirm transcription starts once and reaches terminal state.
10. Confirm exactly one final recording exists.
11. Confirm upload request count is exactly two and job creation count is one.
12. Confirm a second click cannot create concurrent retry work.
13. Inspect console and network output.
14. Confirm the mobile retry action remains visible.

### Expected result

- The first failure is recoverable.
- Retry is explicit, bounded, and idempotent.
- The successful result replaces the failure state.
- No duplicate recording, object, or job is created.
- Refresh does not remove the retry opportunity.

### Evidence

Capture initial error, busy retry, final success, request/job counts, environment, and SHA.

### Cleanup

Delete the final QA recording and confirm no duplicate remains.

### Failure follow-up

Create a P0 defect for hidden retry, endless retry, duplicate work, or false completion. Reference `REC-006`.

---

## REC-007 — Refresh during processing

### Metadata

- Area: Recording pipeline / browser recovery
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target tests: `tests/e2e/audio-pipeline.spec.ts`, `tests/e2e/recordings-queue-smoke.spec.ts`

### Goal

Verify that refreshing the browser while upload/transcription is in progress restores the correct queue state and does not start duplicate work.

### Environments

- Local remote mode with held processing fixture
- Staging

### Viewports

- Primary: `1440x900`
- Recovery-state confirmation: `390x844`

### Test data

- Deterministic short fixture
- Pipeline fixture held in `processing` until released

### Preconditions

1. Queue persistence is enabled.
2. The test can observe upload/job request counts.
3. Processing can be held deterministically.

### Steps

1. Import or record the fixture.
2. Wait until the item displays uploading, queued, or processing.
3. Record current queue item ID, recording ID, and job/request counts.
4. Refresh the page while work remains active.
5. Confirm the application hydrates session and workspace without a loop.
6. Confirm the same queue/recording item is visible.
7. Confirm the status remains processing or a valid recovered state.
8. Confirm no second upload or transcription-start request is issued merely because of refresh.
9. Release the held backend result.
10. Confirm the item reaches done or controlled empty.
11. Refresh again.
12. Confirm final state persists and the processing indicator disappears.
13. Confirm exactly one final recording and one active/completed job exist.
14. Inspect console/network errors.
15. Confirm recovery state remains readable at `390x844`.

### Expected result

- Refresh does not lose the item.
- Refresh does not duplicate upload or job creation.
- Hydration completes once without repeated 401/bootstrap loops.
- Final result is attached and durable.
- No stale processing state remains after completion.

### Evidence

Capture pre-refresh, post-refresh processing, and final states; IDs; request counts; build SHA; and errors.

### Cleanup

Delete the QA recording and clear any test queue residue.

### Failure follow-up

Create a P0 defect for lost queue state, duplicate work, hydration loop, or stale final status. Reference `REC-007`.

---

## REC-008 — Permanent failure remains actionable

### Metadata

- Area: Recording pipeline / permanent failure
- Priority: P0
- Type: M + E2E + V
- Status: ready
- Automation: partial
- Target tests: `tests/e2e/visual-regression.spec.ts`, new permanent-failure E2E

### Goal

Verify that a non-recoverable recording failure remains visible, does not expose a misleading retry action, and guides the user to re-import or delete the item.

### Environments

- Local deterministic failure fixture
- Vercel preview
- Staging

### Viewports

- `320x844`
- `390x844`
- `1440x900`
- `1920x1080`

### Test data

- Queue/recording item with `failed_permanent`
- Safe failure reason such as missing server audio or unsupported permanent storage state

### Preconditions

1. The failure fixture is distinguishable from transient `failed`.
2. The initial item count is known.

### Steps

1. Open Studio or Nagrania with the permanent-failure item.
2. Confirm the item remains visible.
3. Confirm the status clearly indicates that automatic retry is unavailable.
4. Confirm no “Retry processing” action is rendered.
5. Confirm re-import, delete, contact-admin, or another product-approved next action is visible.
6. Open item details and verify the safe user message.
7. Confirm technical diagnostics do not expose secrets or provider payloads.
8. Refresh the page.
9. Confirm the permanent state and next action persist.
10. Navigate between Studio and Nagrania.
11. Confirm both views show consistent status and actions.
12. Attempt keyboard-only access to the available action.
13. Confirm the layout at all required viewports.
14. Delete the failed item when safe and confirm removal persists.

### Expected result

- Permanent failure remains visible until deliberate user action.
- Retry is not offered.
- A clear recovery or cleanup action is provided.
- Studio and Nagrania remain consistent.
- Refresh does not convert or hide the state.
- Mobile layout remains readable and keyboard actions remain accessible.

### Evidence

Capture Studio and Nagrania states at desktop/mobile, available actions, item count, environment, and build SHA.

### Cleanup

Delete the permanent-failure QA item and confirm no queue or meeting residue remains.

### Failure follow-up

Create a P0 defect when permanent failure disappears, exposes retry, has no next action, or differs between views. Reference `REC-008`.
