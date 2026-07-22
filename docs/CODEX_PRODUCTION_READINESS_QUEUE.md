# Codex Production Readiness Queue

This document defines the queue workflow for the production-readiness backlog created from the production audit.

Source of truth: GitHub issue `#1263`.

Audit prompt source: the production readiness audit prompt requires a detailed repo audit, production scoring, blocker list, and Codex-ready implementation backlog. The resulting issue queue is implemented as GitHub issues `#1225` through `#1263`.

## Goal

Codex should execute one production-readiness issue at a time, in queue order, and leave a reviewable PR for humans and CI before the next issue starts.

## Queue rules

1. `#1263` is the backlog index and queue order.
2. Work starts from the first unchecked `- [ ] #issue` line in `#1263`.
3. Do not start a new issue when any open production-readiness issue has:
   - `codex:in-progress`
   - `codex:pr-open`
4. Codex must implement exactly one issue per run.
5. Codex must not merge PRs.
6. Human review and CI remain the release gate.
7. A linked PR with failing or pending checks must not allow the next queue item to start.

## Labels

The queue workflows use these labels:

- `production-readiness`
- `priority:P0`
- `priority:P1`
- `priority:P2`
- `priority:P3`
- `codex:ready`
- `codex:in-progress`
- `codex:pr-open`
- `codex:checks-failed`
- `codex:blocked`
- `codex:review`
- `codex:done`

The workflow `.github/workflows/codex-production-readiness-queue.yml` can create or update these labels when run with `mode=bootstrap-labels`.

## Recommended start sequence

Run the workflow manually first:

1. `Codex Production Readiness Queue` -> `workflow_dispatch` -> `mode=bootstrap-labels`.
2. `Codex Production Readiness Queue` -> `workflow_dispatch` -> `mode=reconcile`.
3. `Codex Production Readiness Queue` -> `workflow_dispatch` -> `mode=dispatch-next`.
4. Confirm that the selected issue gets a `@codex` dispatch comment and `codex:in-progress`.
5. Wait for Codex to open a PR.
6. Review CI and merge manually.
7. The workflow will mark the linked issue as done and dispatch the next queue item.

## Reconciliation mode

`mode=reconcile` is the safety net for cases where Codex opens a PR but the issue status does not update through the normal `pull_request` event.

Reconciliation does this:

1. Scans open PRs in the repository.
2. Reads each PR body.
3. Finds `Closes #<issue>`, `Fixes #<issue>`, or `Resolves #<issue>`.
4. Confirms the linked issue exists in `#1263`.
5. Moves the linked issue to:
   - `production-readiness`
   - `codex:pr-open`
   - `codex:review`
6. Removes stale queue states from the linked issue:
   - `codex:in-progress`
   - `codex:ready`
   - `codex:blocked`
7. Checks the PR status checks and adds `codex:checks-failed` when checks are failing or pending.

The workflow also runs reconciliation automatically on an hourly schedule.

## GitHub Codex integration assumption

The dispatch workflow posts a `@codex` comment on the selected issue.

This assumes the repository has a GitHub Codex integration or agent that reacts to `@codex` issue comments. If that integration is not active, run Codex manually using:

```text
Use .github/codex/prompts/execute-next-production-issue.md and execute the next production-readiness issue from #1263.
```

## Codex issue execution contract

When Codex starts an issue:

1. Comment that work has started.
2. Add `codex:in-progress`.
3. Remove `codex:ready`.
4. Create a dedicated branch, preferably `production-readiness/<issue-number>-<short-slug>` or `codex/<issue-number>-<short-slug>` when allowed.
5. Implement only the selected issue.
6. Run relevant tests.
7. Open a PR with `Closes #<issue-number>`.
8. Add summary, tests, risks, and rollback notes to the PR body.
9. Do not merge.

## PR status sync

When a PR is opened and its body contains `Closes #<issue-number>`, the workflow marks that issue as `codex:pr-open`, adds `codex:review`, and removes `codex:in-progress`.

When that PR has failing or pending checks, the workflow adds `codex:checks-failed` to both the linked issue and the PR.

When that PR is merged, the workflow:

1. Adds `codex:done`.
2. Removes active queue labels.
3. Removes `codex:checks-failed`.
4. Checks the issue line in `#1263`.
5. Dispatches the next unchecked issue.

## Audio E2E readiness

Issue `#1241` adds a dedicated deterministic browser audio gate:

```powershell
pnpm run test:e2e:audio
```

The runner starts Playwright with both `PLAYWRIGHT_DATA_PROVIDER=remote` and
`PLAYWRIGHT_MEDIA_PROVIDER=remote`, so browser requests stay on the same-origin mock
layer. It mocks capture APIs instead of using real microphone hardware, and exercises record,
pause, resume, stop, upload, processing, retry, transcript attach, and fixture
audio import paths.

## Blocked work

If Codex cannot complete an issue:

1. Remove `codex:in-progress`.
2. Add `codex:blocked`.
3. Comment with:
   - blocker
   - attempted approach
   - decision needed
   - next recommended action

The queue runner skips blocked issues until a human removes `codex:blocked` and adds `codex:ready` again.

## Safety rules

- Never auto-merge P0/P1 PRs.
- Never run two production-readiness issues in parallel.
- Never dispatch the next issue while any production-readiness PR has `codex:pr-open`.
- Never remove privacy, security, or auth checks to make tests pass.
- Never print secrets in issue comments, PR bodies, logs, screenshots, or artifacts.
- Prefer small PRs over broad refactors.
- Migration, storage, privacy, and job-queue changes require explicit rollback notes.

## Minimal production gate before starting P1

P1 should not begin until these P0 issues are merged or explicitly deferred with a dated exception:

- `#1225`
- `#1226`
- `#1227`
- `#1228`
- `#1229`
- `#1230`
- `#1231`
- `#1232`
