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
