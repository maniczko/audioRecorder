# Codex Production Readiness Queue

This queue dispatches the next open production-readiness backlog issue to Codex by posting an `@codex` issue comment. It is intended for the backlog indexed by the Production Readiness audit issue.

## Files

- `.github/workflows/codex-production-readiness-queue.yml` — manual workflow for label bootstrap and queue dispatch.
- `.github/codex/prompts/execute-next-production-issue.md` — operating prompt attached to each queue dispatch.

## Labels

The workflow manages these labels in `bootstrap-labels` mode:

| Label                  | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `production-readiness` | Issue is eligible for queue selection.                      |
| `codex-dispatched`     | Issue has already been selected and commented by the queue. |
| `codex-blocked`        | Issue should be skipped until the blocker is removed.       |

## First run after merge

Run the workflow manually from GitHub Actions in this order:

1. `mode=bootstrap-labels`.
2. `mode=dispatch-next` with `dry_run=true`.
3. Review the selected issue in the workflow summary.
4. If the dry run selected the correct backlog item, run `mode=dispatch-next` with `dry_run=false`.

## Dispatch behavior

`dispatch-next` selects the oldest open issue matching all of these filters:

- has the `production-readiness` label or `[Production Readiness]` in the issue title;
- does not have `codex-dispatched`;
- does not have `codex-blocked`.

When `dry_run=false`, the workflow posts a single queue marker comment containing `@codex`, includes a snapshot of the prompt file, and then adds `codex-dispatched`. If a marker comment already exists, the workflow avoids posting a duplicate comment and only ensures the dispatched label is present.

## Operational notes

- If the GitHub Codex integration is not enabled, copy `.github/codex/prompts/execute-next-production-issue.md` into Codex App and run the selected issue manually.
- Remove `codex-dispatched` only when you intentionally want the queue to re-dispatch an issue.
- Add `codex-blocked` to skip an issue while prerequisites are missing.
- Keep this workflow manual until the backlog process has been verified with several dry-run and live dispatches.
