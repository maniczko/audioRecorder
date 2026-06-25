# Next Step

After this branch is merged:

1. Run `Codex Production Readiness Queue` with `mode=reconcile` and `dry_run=true`.
2. Confirm PR `#1270` maps to issue `#1225`.
3. Run `mode=reconcile` with `dry_run=false`.
4. Review PR `#1270`.
5. Merge PR `#1270` when checks and review are acceptable.
6. Confirm the queue dispatches `#1226`.
