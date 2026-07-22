# Authentication and session scenarios

## AUTH-001 — Successful login and workspace bootstrap

### Metadata

- Area: Authentication / workspace bootstrap
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/auth-session.spec.ts`

### Goal

Verify that a valid QA user can log in, the authenticated session is established, and the application loads the expected workspace without console or bootstrap errors.

### Environments

- Local development
- Vercel preview
- Staging
- Production only with the dedicated QA account and no destructive actions

### Viewports

Run the primary execution at:

- `1440x900`

Run responsive confirmation at:

- `390x844`

### Test data

- User role: workspace owner or admin
- User email: provided through `QA_OWNER_EMAIL`
- User password: provided through `QA_OWNER_PASSWORD`
- Expected workspace: provided through `QA_WORKSPACE_NAME`
- Recommended stable display name: `QA Standard Workspace`

Credentials must never be copied into this file, screenshots, console output, issue comments, or artifacts.

### Preconditions

1. The target application environment is reachable.
2. The QA user exists and is active.
3. The QA user belongs to the expected workspace.
4. Required environment secrets are available to the executor.
5. Browser storage is cleared or the user is logged out before execution.

### Steps

1. Open the target application URL.
2. Confirm that the authentication page is visible.
3. Confirm that the Email and Password fields have visible labels or accessible names.
4. Enter the value from `QA_OWNER_EMAIL` in the Email field.
5. Enter the value from `QA_OWNER_PASSWORD` in the Password field.
6. Select the primary login action.
7. Wait until authentication processing finishes.
8. Confirm that the application leaves the authentication page.
9. Confirm that the main application shell is visible.
10. Confirm that the workspace switcher displays the workspace from `QA_WORKSPACE_NAME`.
11. Open Studio from the main navigation if Studio is not already selected.
12. Confirm that the Studio page renders a stable loaded, empty, or populated state rather than a fatal error.
13. Refresh the browser page once.
14. Confirm that the user remains authenticated after refresh.
15. Confirm that the same workspace remains selected after refresh.
16. Inspect browser console output for uncaught exceptions.
17. Inspect relevant network requests for authentication and workspace bootstrap failures.
18. Repeat steps 1–15 at viewport `390x844` and confirm that the login form and post-login navigation remain usable without horizontal overflow.

### Expected result

- Valid credentials are accepted.
- The login action has a visible processing state or prevents duplicate submission while the request is pending.
- The application navigates away from the authentication page.
- The main application shell is visible.
- The expected workspace is selected.
- Studio renders without a fatal error.
- Refresh preserves the authenticated session according to the product session policy.
- Refresh preserves or correctly restores the selected workspace.
- No uncaught browser exception occurs.
- Authentication and workspace bootstrap requests do not return unexpected `4xx` or `5xx` responses.
- No password, token, session cookie, or authorization header is exposed in visible UI, console logs, screenshots, or artifacts.
- At `390x844`, the login and application shell remain usable without horizontal scrolling.

### Evidence

Capture:

- one post-login desktop screenshot,
- one post-login mobile screenshot,
- environment and build SHA,
- final URL path without sensitive query parameters,
- relevant failed request method, route, and status if the scenario fails,
- uncaught console error text if present, with sensitive values removed.

Do not capture the password field while it contains a value.

### Cleanup

1. Log out if the environment or shared QA-account policy requires session cleanup.
2. Close the browser context.
3. Do not delete the QA user or workspace.

### Failure follow-up

Create a defect issue when any of the following occurs:

- valid credentials are rejected,
- the app remains stuck in a loading state,
- workspace bootstrap fails,
- refresh loses the session unexpectedly,
- the selected workspace changes unexpectedly,
- a secret appears in logs or UI,
- mobile layout prevents completing login or using navigation.

The defect issue must include:

- `AUTH-001` in the title or body,
- failed step number,
- environment and build SHA,
- sanitized console/network evidence,
- expected and actual behavior,
- proposed regression-test location.

### Notes

This scenario validates the happy path only. Invalid credentials, expired sessions, and upload-time session expiry are covered by `AUTH-002`, `AUTH-003`, and `AUTH-004`.

---

## AUTH-002 — Invalid credentials show a safe error

### Metadata

- Area: Authentication / error handling
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/auth-session.spec.ts`

### Goal

Verify that invalid credentials are rejected safely, the user remains on the authentication page, and the application does not disclose whether the email exists or expose sensitive authentication data.

### Environments

- Local development
- Vercel preview
- Staging
- Production only with the dedicated QA account and a single controlled attempt

### Viewports

- Primary: `1440x900`
- Responsive confirmation: `390x844`

### Test data

- Existing QA email: provided through `QA_OWNER_EMAIL`
- Deliberately invalid password: provided through `QA_INVALID_PASSWORD`

`QA_INVALID_PASSWORD` must not match any real account password and must never be committed to the repository.

### Preconditions

1. The authentication page is reachable.
2. The browser is logged out and has no active application session.
3. Rate limits or account lockout policies permit one controlled invalid attempt.
4. The executor can inspect browser console and network requests.

### Steps

1. Open the authentication page.
2. Enter `QA_OWNER_EMAIL` in the Email field.
3. Enter `QA_INVALID_PASSWORD` in the Password field.
4. Select the primary login action once.
5. Observe the pending state of the login action.
6. Wait for the authentication response.
7. Confirm that the application remains on the authentication page.
8. Read the visible error message.
9. Confirm that the Password field remains masked.
10. Confirm that the page remains usable and the user can correct the credentials.
11. Inspect the authentication request status.
12. Inspect browser storage and cookies for a newly created authenticated session.
13. Inspect browser console output for uncaught errors or sensitive data.
14. Repeat steps 1–10 at `390x844`.

### Expected result

- The invalid credentials are rejected.
- The login action does not submit repeatedly while the request is pending.
- The response is a controlled authentication failure such as `401`; it is not an unexpected `500`.
- The visible message is generic and does not reveal whether the email exists.
- The user remains on the authentication page.
- No authenticated session, access token, or workspace bootstrap is created.
- The Password field remains masked and is either cleared or remains safely editable according to product policy.
- The UI does not become stuck or unusable after the error.
- No password, token, authorization header, or session identifier appears in the UI, console, screenshot, or artifact.
- The mobile form remains fully usable without horizontal overflow.

### Evidence

Capture:

- screenshot of the sanitized error state with the Password field empty or redacted,
- environment and build SHA,
- authentication request method, route, and status,
- exact visible error copy,
- any console error after removing sensitive values.

Do not capture request payloads, password values, cookies, or authorization headers.

### Cleanup

1. Clear the Email and Password fields.
2. Confirm that no authenticated session was created.
3. Close the browser context.

### Failure follow-up

Create a defect issue when:

- invalid credentials are accepted,
- the app returns an unexpected server error,
- the message confirms whether an account exists,
- an authenticated token or session is created,
- sensitive data appears in logs or UI,
- the form cannot recover from the failed attempt.

The issue must reference `AUTH-002`, the failed step, environment, build SHA, sanitized evidence, and the expected regression-test location.

### Notes

Do not perform repeated invalid attempts against production because this may trigger account lockout or rate limits.

---

## AUTH-003 — Expired session during navigation

### Metadata

- Area: Authentication / session expiry
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/auth-session.spec.ts`

### Goal

Verify that an expired or removed session is detected on the next protected navigation or data request, the user is returned to authentication safely, and stale workspace data is not left interactive.

### Environments

- Local development
- Vercel preview
- Staging
- Do not execute destructive session manipulation on a personal production account

### Viewports

- Primary: `1440x900`
- Responsive confirmation: `390x844`

### Test data

- Valid QA owner account from `QA_OWNER_EMAIL` and `QA_OWNER_PASSWORD`
- Stable workspace from `QA_WORKSPACE_NAME`

### Preconditions

1. `AUTH-001` passes in the same environment.
2. The executor can clear browser cookies and application storage for the target origin.
3. A protected page such as Studio, Recordings, Tasks, or Workspace settings is available.
4. The browser console and network panel are available.

### Steps

1. Log in using the QA owner account.
2. Confirm that the expected workspace and main navigation are visible.
3. Open Studio or another protected page.
4. Record the current page name and URL path without sensitive parameters.
5. Clear authentication cookies and application authentication/session storage for the target origin without using the product Logout action.
6. Do not clear unrelated test fixture data unless it contains authentication state.
7. Select a different protected navigation item, such as Recordings or Tasks.
8. Wait for the first protected request or authentication check to complete.
9. Confirm that the application no longer presents protected workspace data as an active authenticated view.
10. Confirm that the authentication page or session-expired recovery state is displayed.
11. Confirm that a clear user action is available to log in again.
12. Inspect protected requests for a controlled `401` or equivalent session-expired response.
13. Confirm that the application does not enter an infinite loading or redirect loop.
14. Inspect console output for uncaught errors or sensitive values.
15. Repeat the expiry and recovery check at `390x844`.

### Expected result

- The next protected action detects the missing or expired session.
- Protected workspace data is no longer interactive after expiry is detected.
- The user is redirected to the authentication page or shown an explicit session-expired recovery state.
- The recovery action is clear and usable.
- The application handles the failure as an authentication event, not a generic fatal error.
- No endless retry, redirect loop, blank page, or persistent spinner occurs.
- A protected request may return a controlled `401`; unexpected `500` responses do not occur.
- No stale token, password, cookie value, or authorization header is exposed.
- Mobile navigation and recovery remain usable without horizontal overflow.

### Evidence

Capture:

- screenshot of the post-expiry recovery state,
- environment and build SHA,
- the protected route that triggered detection,
- sanitized request method, route, and status,
- any redirect loop or console error details if the scenario fails.

Do not capture cookie values, storage values, tokens, or authorization headers.

### Cleanup

1. Clear remaining authentication storage for the target origin.
2. Log in again only when needed for the next scenario.
3. Close the browser context.

### Failure follow-up

Create a defect issue when:

- protected data remains interactive after session removal,
- the application fails with a blank page or fatal error,
- the app retries indefinitely,
- the app redirects repeatedly,
- login recovery is unavailable,
- secrets appear in evidence.

The issue must reference `AUTH-003`, the failed step, triggering route, environment, build SHA, and proposed automated regression coverage.

### Notes

The preferred Playwright implementation should expire the session deterministically by replacing or removing the test session before a protected request, not by waiting for real time-based expiry.

---

## AUTH-004 — Expired session during audio upload

### Metadata

- Area: Authentication / recording upload
- Priority: P0
- Type: M + E2E
- Status: ready
- Automation: candidate
- Target test: `tests/e2e/audio-pipeline.spec.ts`

### Goal

Verify that session expiry during an active or pending audio upload stops protected transfer safely, shows an actionable authentication state, does not create uncontrolled retries or duplicate uploads, and preserves recoverable local work where supported.

### Environments

- Local development
- Vercel preview
- Staging
- Do not execute on production unless a dedicated QA account, disposable fixture, and cleanup path are configured

### Viewports

- Primary: `1440x900`
- Responsive confirmation of the resulting error/recovery state: `390x844`

### Test data

- Valid QA owner account
- Deterministic non-private audio fixture from `QA_AUDIO_FIXTURE_PATH`
- Recommended duration: 3–15 seconds
- Recommended name: `qa_auth_expiry_upload.wav`

### Preconditions

1. `AUTH-001` passes.
2. The fixture is safe, synthetic, and contains no private speech.
3. The environment supports audio import or recording upload.
4. Browser network throttling is available, or the fixture/upload path is slow enough to invalidate the session before final protected completion.
5. The executor can clear authentication cookies and storage after upload begins.
6. The executor can inspect queue state, network requests, and browser console output.

### Steps

1. Log in with the QA owner account.
2. Open the recording import or recording workflow.
3. Select the deterministic fixture from `QA_AUDIO_FIXTURE_PATH`.
4. Start the upload.
5. Confirm that an upload or queued item becomes visible before final processing completes.
6. If needed, apply network throttling so the upload remains active long enough to perform the next step.
7. Clear authentication cookies and application authentication/session storage for the target origin.
8. Allow the next protected upload, finalize, status, or transcription request to execute.
9. Observe the queue item and global authentication state.
10. Confirm that the application surfaces a session/authentication problem rather than silently retrying forever.
11. Confirm that a clear action is available to log in again.
12. Confirm that the queue does not create duplicate items for the same fixture.
13. Confirm that the app does not report the upload as successfully completed when the protected request failed.
14. Inspect relevant request statuses for a controlled `401` or equivalent authentication failure.
15. Inspect console output for uncaught errors or sensitive values.
16. Log in again using the QA account.
17. Confirm that the application either preserves a recoverable local queue item or clearly explains that the import must be retried.
18. Retry only once when the UI explicitly supports retry.
19. Confirm that the retry does not create a duplicate recording or duplicate upload job.
20. At `390x844`, open the resulting authentication or queue recovery state and confirm that the message and primary action are visible and usable.

### Expected result

- Session expiry is detected by the protected upload/finalize/status flow.
- The upload is not falsely marked successful.
- The application does not retry indefinitely.
- The user receives a clear authentication or session-expired message and login action.
- The same source does not create duplicate queue items, recordings, media assets, or transcription jobs.
- Recoverable local state is preserved when supported; otherwise the UI clearly requires a fresh retry.
- After reauthentication, one controlled retry can continue or restart the flow without duplication.
- A controlled authentication failure such as `401` may occur; unexpected `500` responses do not occur.
- No audio content, password, token, cookie value, or authorization header is exposed in UI, logs, screenshots, or artifacts.
- The mobile recovery state is readable and actionable without horizontal overflow.

### Evidence

Capture:

- screenshot of the queue/authentication error state,
- screenshot after reauthentication and recovery decision,
- environment and build SHA,
- fixture filename and duration but not the audio content,
- sanitized sequence of request methods, routes, and statuses,
- count of queue items or recordings before and after retry,
- uncaught console errors with sensitive values removed.

### Cleanup

1. Delete the QA recording or queue item created by the scenario when a safe delete action exists.
2. Confirm that no duplicate QA recording remains.
3. Remove network throttling.
4. Log out or clear the QA session.
5. Do not upload or attach the fixture audio as issue evidence.

### Failure follow-up

Create a P0 defect issue when:

- the upload continues successfully under an invalid session,
- the UI enters an endless retry loop,
- duplicate queue items, recordings, media assets, or jobs are created,
- the recording is falsely shown as completed,
- the user cannot reauthenticate or recover,
- sensitive values or audio content appear in evidence.

The defect issue must reference `AUTH-004`, the failed step, environment, build SHA, sanitized request sequence, duplicate counts, and the proposed Playwright regression-test location.

### Notes

For automation, prefer deterministic request interception or a test session invalidation hook over timing-dependent manual storage removal. The manual scenario remains valid for browser-level exploratory confirmation.