# Codex Queue Operations

This runbook explains how to operate the production-readiness queue.

## Source of truth

- Backlog index: `#1263`
- Active task status labels:
  - `codex:ready`
  - `codex:in-progress`
  - `codex:pr-open`
  - `codex:checks-failed`
  - `codex:blocked`
  - `codex:review`
  - `codex:done`

## Normal flow

1. Run `Codex Production Readiness Queue` with `mode=dispatch-next`.
2. The workflow reconciles open PRs first.
3. If no active work exists, it dispatches the first unchecked open issue from `#1263`.
4. Codex opens a PR with `Closes #<issue-number>`.
5. The workflow marks the linked issue as `codex:pr-open` and `codex:review`.
6. Humans review and merge.
7. The workflow marks the issue as `codex:done`, checks it off in `#1263`, then dispatches the next item.

## Reconcile flow

Run `mode=reconcile` when any of these happen:

- Codex says it opened a PR, but the issue still has `codex:in-progress`.
- A PR exists with `Closes #<issue>`, but the linked issue is not `codex:pr-open`.
- A PR has failing checks and should be flagged on the issue.
- The queue appears stuck.

Reconcile scans open PRs and syncs linked issues based on `Closes/Fixes/Resolves #<issue>` in the PR body.

## Expected active states

### No active work

No open issue should have `codex:in-progress` or `codex:pr-open`.

### Codex is working

Exactly one issue should have:

- `production-readiness`
- priority label
- `codex:in-progress`

### PR is open

Exactly one issue should have:

- `production-readiness`
- priority label
- `codex:pr-open`
- `codex:review`

The linked PR should also have `production-readiness`, priority label, `codex:pr-open`, and `codex:review`.

### PR checks are failing or pending

The linked issue and PR should also have:

- `codex:checks-failed`

Do not dispatch the next issue until the PR is merged and the checks/review state is acceptable.

## Manual recovery

If a queue item is incorrectly stuck in `codex:in-progress` but a linked PR exists:

1. Run `mode=reconcile`.
2. Confirm the issue changes to `codex:pr-open`.
3. Confirm the PR has `Closes #<issue-number>`.
4. Continue with review/merge.

If no linked PR exists:

1. Leave the issue as `codex:in-progress` only if Codex is actually working.
2. Otherwise set `codex:blocked` and comment with the exact failure.
3. Restart Codex only after removing the stale blocker or clarifying the task.

## Do not

- Do not start the next issue while any issue has `codex:in-progress` or `codex:pr-open`.
- Do not merge P0/P1 PRs without human review.
- Do not remove `codex:checks-failed` manually unless the checks were rerun and verified.
- Do not rely on Codex's text summary alone; verify the GitHub PR exists.
