# Queue Reconcile Rollback Notes

This change is limited to GitHub workflow configuration and documentation.

## Revert path

1. Revert the PR that introduced queue reconcile automation.
2. Keep the existing queue labels unless they are no longer useful.
3. Continue operating the queue manually through `#1263`.

## Manual fallback

If reconcile creates an incorrect state:

1. Inspect the linked PR body.
2. Confirm whether it contains `Closes #<issue>`.
3. Set the linked issue to one clear state only:
   - `codex:ready`
   - `codex:in-progress`
   - `codex:pr-open`
   - `codex:blocked`
   - `codex:done`
4. Do not dispatch another issue until the state is clear.
