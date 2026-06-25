# Final Reconcile Note

The workflow change should be reviewed as configuration, not application logic.

It is intended to prevent queue desynchronization when Codex-created PRs are visible but the linked issue does not automatically move to `codex:pr-open`.
