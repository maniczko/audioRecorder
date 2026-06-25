# PR Body Draft

Related to #1263 and #1225.

## Summary

- Add `mode=reconcile` to the Codex production-readiness queue workflow.
- Add hourly scheduled reconciliation for open PRs that link issues with `Closes/Fixes/Resolves #<issue>`.
- Sync linked issues to `codex:pr-open` and `codex:review` when a PR exists.
- Add `codex:checks-failed` for linked PRs with failing or pending checks.
- Run reconcile before dispatching the next queue item.
- Add queue operations documentation and PR template checklist.

## Tests

- Added `Codex Queue Reconcile Smoke` workflow to validate queue workflow YAML and required reconcile markers.

## Risks

- This changes GitHub workflow behavior only; it does not change application runtime behavior.
- Reconcile depends on PR bodies containing `Closes #<issue>` or equivalent.

## Rollback

- Revert this PR to remove reconcile mode and return to manual queue sync.
