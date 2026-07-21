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

Run the full lifecycle at:

- `1440x900`

Run a responsive control-layout confirmation at:

- `390x844`

### Test data

- User: QA owner or member with recording permission
- Workspace: provided through `QA_WORKSPACE_NAME`
- Audio input: synthetic or browser-provided fake microphone input
- Recommended recording duration: 8–15 seconds
- Recommended generated title prefix: `qa_rec_001_`

Do not use a real customer meeting, private speech, personal microphone recording, or production transcript as test data.

### Preconditions

1. `AUTH-001` passes in the same environment.
2. The QA user has permission to create recordings in the selected workspace.
3. The browser exposes a deterministic synthetic or fake microphone input.
4. Microphone permission can be granted to the target origin.
5. No other recording is active in the current browser context.
6. The executor can inspect browser console, network requests, and the recording queue or list.
7. The executor knows the initial count of visible QA recordings or queue items matching the `qa_rec_001_` prefix.

If deterministic microphone input is unavailable, mark the scenario `BLOCKED`; do not substitute private speech.

### Steps

1. Log in using the configured QA account.
2. Confirm that the workspace switcher displays `QA_WORKSPACE_NAME`.
3. Open Studio or the primary recording surface.
4. Locate the primary action used to start a new recording.
5. Select the start-recording action.
6. Grant microphone permission when the browser requests it.
7. Confirm that the UI changes from idle to an active recording state.
8. Confirm that an elapsed-time indicator or equivalent recording-progress state becomes visible.
9. Allow the synthetic input to record for at least three seconds.
10. Select the Pause action.
11. Confirm that the UI displays a paused state.
12. Observe the elapsed-time indicator for at least two seconds and confirm that it does not continue as an active recording timer beyond expected UI tolerance.
13. Confirm that a Resume action is available.
14. Select Resume.
15. Confirm that the UI returns to the active recording state.
16. Allow recording to continue for at least three seconds.
17. Select Stop once.
18. Confirm that the UI leaves the active recording state.
19. Confirm that exactly one new queue item, recording card, or recording row is created for this recording.
20. Confirm that the item has a valid initial pipeline status such as uploading, queued, processing, review, ready, or an explicit recoverable failure.
21. Confirm that the item is associated with the selected workspace.
22. Confirm that start, pause, resume, and stop actions were not duplicated by double rendering or delayed responses.
23. Inspect browser console output for uncaught exceptions.
24. Inspect relevant media/upload requests for unexpected `4xx` or `5xx` responses.
25. Refresh the page once after the recording item is visible.
26. Confirm that the recording or queue item remains visible after refresh, unless the product explicitly marks it as a recoverable local-only item with clear guidance.
27. At viewport `390x844`, reopen the recording surface.
28. Confirm that start, pause/resume, and stop controls fit the viewport, remain readable, and are reachable by touch or keyboard without horizontal scrolling.

### Expected result

- Starting recording requests microphone access only when needed.
- Granting permission starts exactly one recording session.
- The active state is visually and programmatically distinguishable from idle.
- Pause changes the visible state and suspends active capture or timer progression according to the product contract.
- Resume continues the same recording rather than creating a second recording.
- Stop finishes the recording once and returns the recorder to a stable non-recording state.
- Exactly one recording or queue item is created.
- The item belongs to the selected workspace.
- The item has a clear pipeline status and next action.
- Refresh does not silently lose a server-backed recording or leave a false active-recording state.
- No duplicate upload, media asset, queue item, recording row, or transcription job is created by the normal lifecycle.
- No uncaught browser exception occurs.
- Unexpected authorization, upload, or server failures do not occur.
- No token, cookie, authorization header, private audio content, or transcript content is exposed in screenshots, console logs, or artifacts.
- At `390x844`, all critical recorder controls remain usable without horizontal overflow or overlap.

### Evidence

Capture:

- screenshot of the active recording state,
- screenshot of the paused state,
- screenshot of the final queue or recording item,
- mobile screenshot showing recorder controls,
- environment and build SHA,
- selected workspace name,
- generated QA recording identifier or visible title,
- count of matching queue/recording items before and after execution,
- sanitized request method, route, and status for failures,
- uncaught console errors with sensitive values removed.

Do not attach the raw audio fixture or recorded audio to an issue or PR unless a repository-approved synthetic fixture is already versioned for that purpose.

### Cleanup

1. Wait until the item reaches a stable state or an explicit failure state.
2. Delete the created QA recording or queue item using the product UI when a safe delete action is available.
3. Confirm that the item no longer appears in the active recording list.
4. Revoke microphone permission for the target origin when required by the shared-browser policy.
5. Confirm that no recording remains active before closing the browser context.

### Failure follow-up

Create a P0 defect issue when:

- recording cannot start with valid permission and deterministic input,
- pause does not change state or capture continues unexpectedly,
- resume creates a second recording,
- stop does not end the active recording,
- multiple queue items or recordings are created,
- refresh loses a server-backed item,
- controls are inaccessible on mobile,
- the UI exposes sensitive data,
- an unexpected `500` occurs in the critical flow.

The defect issue must include:

- `REC-001` in the title or body,
- failed step number,
- environment and build SHA,
- browser and viewport,
- before/after item counts,
- sanitized console and network evidence,
- proposed regression-test location.

### Notes

- Permission denial and unsupported microphone behavior are covered separately by `REC-002` and `REC-003`.
- File import is covered by `REC-004`.
- Upload, processing, retry, refresh, and permanent failure states are covered by `REC-005` through `REC-008`.
- The Playwright implementation should use deterministic browser media flags or a mocked `MediaRecorder`/`getUserMedia` contract rather than physical hardware.