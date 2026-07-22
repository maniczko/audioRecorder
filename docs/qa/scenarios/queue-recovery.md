# Queue, job, retry, and recovery scenarios

## QUE-001 — Queue survives navigation

### Metadata

- Area: Recording queue / navigation persistence
- Priority: P0
- Type: M + E2E
- Status: automated
- Automation: automated
- Target test: `tests/e2e/recordings-queue-smoke.spec.ts`

### Goal

Verify that a fresh local or pending recording remains visible and coherent while the user moves between Studio and Nagrania, without duplicate queue items or status resets.

### Environments

- Local development
- Vercel preview
- Staging

### Viewports

- `1440x900`
- `390x844`

### Test data

- One deterministic queue item with unique prefix `qa_que_001_`.
- Known recording ID, meeting ID, workspace ID, status, attempts, and timestamps.

### Preconditions

1. User is authenticated in the intended workspace.
2. Exactly one matching queue item exists.
3. Queue processing is held in a deterministic pending/queued state where needed.
4. No previous item with the same IDs exists.

### Steps

1. Open Studio.
2. Confirm the queue item is represented by the expected meeting title or status.
3. Navigate to Nagrania.
4. Confirm exactly one matching row/card exists.
5. Confirm its status maps correctly to queued/uploading/processing rather than a false final state.
6. Navigate to Zadania and back to Studio.
7. Confirm the queue item remains visible and retains the same recording/meeting IDs.
8. Return to Nagrania.
9. Confirm no duplicate item appeared.
10. Inspect local persisted queue state and visible meeting state where allowed by the test environment.
11. Repeat navigation on mobile using the hamburger menu.
12. Inspect console errors and unexpected failed requests.

### Expected result

- Navigation does not remove or duplicate the queue item.
- The visible status remains consistent between Studio and Nagrania.
- Workspace and meeting association remain correct.
- No unexpected processing restart occurs solely because of navigation.
- Mobile navigation preserves the same queue state.

### Evidence

Capture Studio and Nagrania views, matching item counts, persisted queue summary, environment, SHA, and sanitized console/network evidence.

### Cleanup

Remove the deterministic queue fixture or allow the test harness to reset browser storage.

### Failure follow-up

Create a P0 defect when navigation loses, duplicates, reassigns, or falsely completes the item. Reference `QUE-001`.

---

## QUE-002 — Queue survives browser refresh

### Metadata

- Area: Recording queue / refresh recovery
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target tests: new queue recovery Playwright scenario, recorder store and processor tests

### Goal

Verify that refreshing the browser during queued, uploading, or processing work restores the queue safely and resumes or reattaches exactly once.

### Environments

- Local remote mode
- Vercel preview
- Staging

### Test data

Run the scenario separately for:

- queued but not uploaded,
- upload completed and transcription not started,
- transcription processing,
- retryable failed item waiting for user action.

Use unique prefix `qa_que_002_`.

### Preconditions

1. Queue persistence is enabled.
2. The item includes stable IDs and normalized timestamps.
3. Remote requests can be held or mocked deterministically.
4. Initial upload/start/status request counts are known.

### Steps

1. Create or seed the first target queue state.
2. Confirm the UI shows the expected status.
3. Record item IDs, retry count, attempts, and current request counts.
4. Refresh the browser once.
5. Wait for session/workspace/queue hydration.
6. Confirm exactly one queue item with the same IDs is restored.
7. Confirm the restored status is normalized to a valid state.
8. Confirm processing resumes only when the state contract allows it.
9. Confirm no second meeting or recording row is created.
10. Confirm upload is not repeated when already completed.
11. Confirm transcription start is not duplicated when an active backend job exists.
12. Confirm status polling reconnects with bounded cadence.
13. Repeat for all declared target states.
14. Refresh twice rapidly during processing.
15. Confirm the final state remains single and coherent.
16. Inspect console/network behavior and persisted queue state.
17. Repeat a key processing-state refresh at `390x844`.

### Expected result

- Refresh restores one queue item with stable identity.
- Hydration does not downgrade completed upload or create duplicate work.
- Active backend jobs are reattached/polled rather than restarted.
- Retryable failures remain explicit and user-actionable.
- Rapid refresh does not cause duplicate requests beyond documented idempotent checks.
- Queue and meeting views agree after recovery.

### Evidence

Record state before/after refresh, request counts, IDs, persisted queue snapshot without blob/private content, screenshots, and timing.

### Cleanup

Finish or delete all test items and confirm no `qa_que_002_` artifacts remain.

### Failure follow-up

Create a P0 issue when refresh loses work, repeats upload/transcription, changes identity, creates duplicates, or enters a loop. Reference `QUE-002` and the failed target state.

---

## QUE-003 — Backend restart while job is queued

### Metadata

- Area: Durable transcription jobs / restart recovery
- Priority: P0
- Type: API + S + recovery
- Status: blocked
- Automation: candidate
- Target tests: staging recovery workflow, durable-job integration tests

### Goal

Verify that a queued transcription job remains durable across backend restart or redeploy and is eventually leased and processed exactly once.

### Environments

- Isolated staging or sandbox only
- Production release rehearsal after durable storage and database are proven

### Test data

- Dedicated workspace and recording with synthetic audio.
- Job created with unique prefix `qa_que_003_`.
- Job remains queued before the restart begins.

### Preconditions

1. PostgreSQL production-mode configuration is active.
2. Audio is stored remotely and durably.
3. Job queue is database-backed.
4. Restart/redeploy can be triggered safely.
5. Monitoring and job-table inspection are available.
6. Cleanup permission exists.

### Steps

1. Authenticate as the recovery-test user.
2. Upload and finalize the deterministic audio fixture.
3. Start transcription while worker pickup is paused or controlled.
4. Confirm one queued job exists with recording/workspace linkage.
5. Record job ID, recording ID, created time, attempt count, lease fields, and deployed SHA.
6. Restart or redeploy the backend before the job is leased.
7. Wait for `/health/live` and `/ready` to recover.
8. Confirm the queued job still exists after restart.
9. Enable or wait for worker processing.
10. Confirm exactly one worker leases the job.
11. Confirm job progresses to processing and terminal result.
12. Confirm no duplicate job is created.
13. Confirm meeting/recording state receives one terminal result.
14. Confirm audio remains available.
15. Confirm request/job logs contain correlation IDs but no raw transcript/audio.
16. Reload the frontend and verify the result.
17. Delete the QA recording and confirm job/storage cleanup according to policy.

### Expected result

- The queued job survives restart.
- Exactly one active lease exists.
- One terminal result is persisted.
- No duplicate provider request or job is created.
- The frontend reconnects to the recovered result.
- Cleanup is complete and auditable.

### Evidence

Retain redacted job-state timeline, before/after restart SHA, health/readiness timestamps, lease/attempt counts, request IDs, final status, and cleanup result.

### Cleanup

Delete recording, meeting, job/test metadata, and storage object. Confirm no orphan job remains queued or processing.

### Failure follow-up

Any lost or duplicated queued job is a release-blocking P0 defect. Reference `QUE-003` and attach sanitized recovery evidence.

---

## QUE-004 — Backend restart while job is processing

### Metadata

- Area: Durable transcription jobs / lease recovery
- Priority: P0
- Type: API + S + recovery
- Status: blocked
- Automation: candidate
- Target tests: staging restart workflow, lease-expiry integration tests

### Goal

Verify that a job interrupted while processing is recovered through lease expiry, heartbeat, or provider reconciliation without permanent loss or duplicate finalization.

### Environments

- Isolated staging/sandbox
- Production rehearsal after P0 storage/database blockers are closed

### Test data

- Synthetic audio long enough to observe processing.
- Unique prefix `qa_que_004_`.
- One durable job with active lease and heartbeat.

### Preconditions

1. Worker leasing and heartbeat are enabled.
2. Lease duration and recovery policy are documented.
3. Provider operation can be safely repeated or reconciled idempotently.
4. Restart can be initiated while the job is verifiably processing.

### Steps

1. Upload and start transcription.
2. Wait until the job is in processing state with an active lease.
3. Record lease owner, expiry, heartbeat, attempt, job ID, recording ID, and request correlation ID.
4. Restart or terminate the active worker/backend instance.
5. Confirm the frontend does not falsely mark the job failed immediately unless policy requires it.
6. Wait for lease expiry or recovery process.
7. Confirm another worker or restarted worker claims the job only after the previous lease is no longer valid.
8. Confirm attempt/recovery metadata changes once.
9. Confirm provider status is reconciled before issuing duplicate expensive work where supported.
10. Wait for terminal status.
11. Confirm only one transcript/result is attached.
12. Confirm no duplicate analysis, task, recording, or storage object exists.
13. Confirm permanent failure is used only after bounded attempts are exhausted.
14. Reload the frontend and verify coherent final state.
15. Review logs and metrics for lease expiration, recovery, duration, and outcome.

### Expected result

- Processing interruption does not lose the job.
- Lease ownership prevents simultaneous processing.
- Recovery is bounded and observable.
- One terminal result is persisted.
- The user sees delayed/recovering state rather than false success.
- No duplicate paid work is created when provider reconciliation can avoid it.

### Evidence

Capture redacted lease timeline, job attempts, restart timestamps, provider reconciliation outcome, final record counts, frontend state, and cleanup.

### Cleanup

Remove QA entities and verify no active lease, queued job, storage object, or smoke artifact remains.

### Failure follow-up

Create a P0 incident/defect when the job is lost, processed concurrently, finalized twice, or remains stuck beyond the documented recovery window. Reference `QUE-004`.

---

## QUE-005 — Duplicate transcribe request is idempotent

### Metadata

- Area: Transcription API / idempotency
- Priority: P0
- Type: API + E2E
- Status: ready
- Automation: partial
- Target tests: media route integration tests and new remote E2E scenario

### Goal

Verify that repeated transcription-start requests for the same recording result in one active job or one existing terminal result, not duplicated provider work.

### Environments

- Local backend integration
- Staging
- Production smoke using a disposable recording

### Test data

- One uploaded/finalized recording.
- Unique recording ID and optional idempotency key.
- Deterministic provider mock for local integration.

### Preconditions

1. Audio upload is complete.
2. Recording belongs to the authenticated workspace.
3. No prior active job exists for the first run.
4. Job table and provider call count can be inspected.

### Steps

1. Send the first transcription-start request.
2. Confirm a queued/processing response and record job ID.
3. Immediately send the same request again.
4. Send two additional requests concurrently.
5. Confirm responses identify the same active job or documented idempotent state.
6. Confirm exactly one active job exists for the recording.
7. Confirm provider start/invocation count is one.
8. Wait for completion.
9. Send the request again after completion.
10. Confirm the existing completed result is returned or no-op behavior occurs.
11. Confirm no second transcript, analysis, or job appears.
12. Repeat with a stable idempotency key if the API supports one.
13. Repeat from two browser tabs or clients where practical.
14. Confirm logs show idempotent reuse without exposing tokens/payloads.

### Expected result

- One recording has at most one active transcription job under normal policy.
- Concurrent duplicate requests converge on the same job/result.
- Provider work is not multiplied.
- Post-completion retry returns existing state or one explicit replay contract.
- UI remains coherent and does not show duplicate processing items.

### Evidence

Record response statuses, job IDs, provider call count, database active-job count, final transcript count, and request IDs.

### Cleanup

Delete the disposable recording/result and confirm associated job/storage cleanup.

### Failure follow-up

Create a P0 cost/data-integrity defect when duplicate requests create multiple active jobs, provider calls, or terminal results. Reference `QUE-005`.

---

## QUE-006 — Retry completed recording does not duplicate work

### Metadata

- Area: Transcription API / completed-state retry
- Priority: P0
- Type: API + E2E
- Status: ready
- Automation: partial
- Target tests: retry route tests, production smoke idempotency step

### Goal

Verify that retrying or re-requesting transcription for an already completed recording returns the existing result or one explicitly authorized replay path without duplicate transcript, analysis, tasks, or provider charge.

### Environments

- Local integration
- Staging
- Production smoke

### Test data

- One completed QA recording with transcript and analysis.
- Known job ID, recording ID, transcript segment count, and analysis version.

### Preconditions

1. The recording is terminal `done` or equivalent.
2. Transcript and analysis are persisted.
3. Initial job/result/provider counts are known.
4. User is authorized for the recording.

### Steps

1. Open the completed recording in Studio.
2. Record current transcript segment count, analysis fields, job count, and provider invocation count.
3. Invoke the normal transcribe endpoint again.
4. Confirm the response references completed state or existing result.
5. Invoke the retry endpoint once.
6. Confirm the product applies the documented policy:
   - no-op/existing result, or
   - one explicit replay only after confirmation and a new version.
7. Confirm no duplicate transcript segments are appended.
8. Confirm action items/tasks are not duplicated.
9. Confirm analysis is not duplicated invisibly.
10. Refresh Studio and Nagrania.
11. Confirm one coherent recording/result remains.
12. Repeat the request concurrently from two clients where supported.
13. Confirm provider and job counts remain within the documented policy.
14. Confirm audit history identifies the retry/no-op decision.

### Expected result

- Completed work is not accidentally restarted.
- Existing results remain stable.
- Any authorized replay is explicit, versioned, and idempotent.
- No duplicate transcript, tasks, analysis, meeting, recording, or storage object exists.
- UI remains single and coherent after refresh.

### Evidence

Capture before/after counts, response/job IDs, visible Studio result, audit event reference, and provider call count.

### Cleanup

Remove only replay/test artifacts according to policy; do not delete the stable shared fixture unless it is disposable.

### Failure follow-up

Create a P0 defect when a completed retry duplicates work, content, provider cost, or visible entities. Reference `QUE-006`.