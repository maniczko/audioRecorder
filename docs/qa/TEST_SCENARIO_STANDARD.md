# Browser test scenario standard

Every browser scenario must be executable without guessing product behavior, data, or expected results.

## Required metadata

Each scenario must contain:

- unique ID,
- title,
- area,
- priority,
- execution type,
- goal,
- supported environment,
- required viewport or viewport matrix,
- test data,
- preconditions,
- numbered steps,
- expected result for each important action,
- evidence requirements,
- cleanup instructions,
- automation status and target test file.

## Identifier convention

Use an area prefix and a three-digit sequence:

```text
AUTH-001
REC-001
LIB-001
STU-001
TRN-001
TSK-001
PPL-001
VOICE-001
WS-001
RBAC-001
GGL-001
UX-001
RES-001
SMOKE-001
```

Do not reuse an identifier after a scenario is deprecated.

## Priorities

- `P0`: critical path or production blocker.
- `P1`: core user workflow or high regression risk.
- `P2`: secondary workflow, responsive, accessibility, or quality hardening.
- `P3`: enterprise, exploratory, or low-frequency workflow.

## Execution types

- `M`: manual browser execution.
- `E2E`: functional Playwright automation.
- `V`: visual Playwright comparison.
- `S`: staging or production smoke.
- `E`: exploratory testing.

A scenario may use more than one type, for example `M + E2E + V`.

## Scenario status

Allowed values in the index:

- `draft`
- `ready`
- `running`
- `passed`
- `failed`
- `blocked`
- `automated`
- `deprecated`

## Step-writing rules

Each step must describe one observable action. Use visible names and stable test identifiers rather than coordinates.

Good:

```text
1. Open the Login page.
2. Enter the QA owner email in the Email field.
3. Enter the configured QA password in the Password field.
4. Select Log in.
5. Wait until the Studio page and workspace switcher are visible.
```

Bad:

```text
1. Log in and verify everything works.
```

## Expected-result rules

Expected results must be observable in the UI, browser state, network response, or stored test data.

Good:

```text
- The URL no longer points to the authentication page.
- The workspace switcher displays `QA Standard Workspace`.
- No uncaught error is written to the browser console.
- The workspace bootstrap request returns 200.
```

Avoid subjective expectations such as `the screen looks good` unless the scenario defines a specific visual contract.

## Test data rules

- Use stable QA names with a `qa_` prefix where practical.
- Store credentials only in secrets or local environment variables.
- Never embed access tokens, passwords, private audio, or production transcripts.
- Declare whether the test can create, update, or delete data.
- Define cleanup for created data.

## Evidence contract

For every execution record:

- report `PASS`, `FAIL`, or `BLOCKED`,
- identify the failed step,
- capture screenshots for failures and all visual scenarios,
- record relevant console errors,
- record failed network requests with method, route, and status,
- include build SHA and environment,
- link a follow-up issue when a defect is found.

Do not attach secrets, authentication headers, raw private transcripts, or private audio to evidence.

## Viewport matrix

Use only viewports relevant to the scenario. The release matrix is:

```text
320x844
390x844
768x1024
1024x768
1366x768
1440x900
1600x900
1920x1080
```

Critical responsive scenarios should include at least `390x844`, `1024x768`, and `1440x900`.

## Automation decision

Set one of:

- `none`: manual or exploratory only,
- `candidate`: should be automated later,
- `automated`: Playwright coverage exists,
- `partial`: only part of the manual scenario is automated.

Critical smoke, authentication, upload, queue-state, retry, and regression scenarios should normally become automated.

## Scenario template

```markdown
# <ID> — <title>

## Metadata

- Area:
- Priority:
- Type:
- Status: ready
- Automation: none / candidate / partial / automated
- Target test:

## Goal

## Environments

## Viewports

## Test data

## Preconditions

## Steps

1.
2.

## Expected result

## Evidence

## Cleanup

## Failure follow-up

## Notes
```
