# Queue Reconcile Release Notes

## What changes

This configuration update makes the Codex production-readiness queue self-healing around PR state.

## Before

The queue depended on the immediate `pull_request` event. If Codex opened a PR but the issue labels did not sync, the queue could remain stuck in `codex:in-progress` or require manual repair.

## After

The queue can run `mode=reconcile` manually or on an hourly schedule. Reconcile finds open PRs with `Closes/Fixes/Resolves #<issue>` and updates the linked issue state.

## Operational impact

- Safer automatic issue sequencing.
- Fewer manual label corrections.
- Better visibility when PR checks are failing or pending.
- The queue still does not auto-merge PRs.

## Rollback

Revert the PR that introduced this file and the workflow changes.
