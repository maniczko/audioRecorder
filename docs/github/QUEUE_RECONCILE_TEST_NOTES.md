# Queue Reconcile Test Notes

Use this checklist after merging the reconcile automation PR.

## Manual validation

1. Open `Actions`.
2. Run `Codex Production Readiness Queue`.
3. Select `mode=reconcile`.
4. Use `dry_run=true` first.
5. Confirm that PR `#1270` maps to issue `#1225`.
6. Confirm the workflow would set `#1225` to `codex:pr-open` and `codex:review`.
7. Run again with `dry_run=false` only if the dry run is correct.

## Expected current state

- `#1225` should have `codex:pr-open` and `codex:review`.
- `#1270` should have matching queue labels.
- `#1263` should not have `codex:blocked`.
- `#1226` should not start until `#1270` is merged.

## After `#1270` merge

The queue workflow should:

1. Mark `#1225` as `codex:done`.
2. Remove active queue labels from `#1225`.
3. Check off `#1225` in `#1263`.
4. Dispatch `#1226`.
