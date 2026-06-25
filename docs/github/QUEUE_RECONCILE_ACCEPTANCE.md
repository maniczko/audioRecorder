# Queue Reconcile Acceptance Checklist

This PR is accepted when:

- [ ] `Codex Production Readiness Queue` exposes `mode=reconcile`.
- [ ] The queue workflow has a scheduled reconcile run.
- [ ] Reconcile maps open PRs with `Closes #<issue>` to issues from `#1263`.
- [ ] Reconcile removes stale `codex:in-progress`, `codex:ready`, and `codex:blocked` from linked issues when a PR exists.
- [ ] Reconcile adds `codex:pr-open` and `codex:review` to linked issues.
- [ ] Reconcile flags failing or pending PR checks with `codex:checks-failed`.
- [ ] The PR template instructs authors to include `Closes #<issue>`.
- [ ] Documentation explains manual recovery.

Current validation target:

- PR `#1270` should remain the active PR for issue `#1225`.
- Issue `#1225` should remain `codex:pr-open` until PR `#1270` is merged.
- Issue `#1226` should not start before PR `#1270` is merged.
