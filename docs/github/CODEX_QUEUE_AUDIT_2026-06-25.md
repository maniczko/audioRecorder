# Codex Queue Configuration Audit — 2026-06-25

## Finding

The production-readiness queue was mostly configured correctly, but it lacked a reconciliation path for cases where Codex opens a PR and the linked issue status is not updated through the normal `pull_request` event.

Observed case:

- Active issue: `#1225`
- Active PR: `#1270`
- PR body includes `Closes #1225`
- Linked issue needed manual status cleanup before reconciliation was added

## Root cause

The queue workflow only handled:

- manual bootstrap
- manual dispatch
- status view
- immediate pull request events

It did not periodically scan open PRs and repair linked issue states.

## Fix in this branch

- Added `mode=reconcile`.
- Added hourly scheduled reconciliation.
- Added `codex:checks-failed` label.
- Added check-rollup inspection for linked PRs.
- Updated dispatch flow to run reconciliation before selecting the next issue.
- Updated documentation and PR template.
- Added a small workflow smoke check for queue configuration files.

## Expected result

When a PR exists with `Closes #<issue>` and the issue is listed in `#1263`, reconcile should set:

- `production-readiness`
- `codex:pr-open`
- `codex:review`

It should remove stale states:

- `codex:ready`
- `codex:in-progress`
- `codex:blocked`

If the PR has failing or pending checks, it should add:

- `codex:checks-failed`

## Current queue behavior after merge

- Do not start `#1226` while `#1225` has an open PR.
- After `#1270` is merged, `#1225` should move to `codex:done` and be checked off in `#1263`.
- Then the workflow may dispatch `#1226`.
