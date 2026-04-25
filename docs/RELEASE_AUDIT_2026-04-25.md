# Release Audit - 2026-04-25

## Scope

Project: `audioRecorder` only.

This audit covers the patch release after `v0.1.1`. The release includes Linear work completed for lint coverage, backend smoke scope detection, chunked audio upload coverage, and fatal backend error shutdown policy.

## Change Set Since v0.1.1

- `9e15c455 fix(lint): include test files in quality gate`
- `fe7c820b fix(ci): relax backend smoke for frontend-only changes`
- `b9fe0841 test(media): cover chunked audio upload flow`
- `a203c397 fix(server): make fatal errors shut down gracefully`

Automation bookkeeping commits also assigned and created monitoring-derived tasks:

- `77e5ab99 chore: auto-create tasks for 3 errors`
- `57f73876 chore: auto-assign task queue owners`

## Completed Linear Scope

- `VAT-113` - Lint quality gates now include test files instead of blanket test ignores.
- `VAT-177` - Backend production smoke now skips exact-SHA checks when a deploy does not need to change backend artifacts.
- `VAT-150` - Chunked audio upload flow has real filesystem-backed tests for resume, finalize cleanup, and storage-error retry.
- `VAT-155` - Fatal backend process errors now use graceful shutdown and exit so the process manager can restart a clean process.

## Validation Snapshot

Passed before release preparation:

- `pnpm run lint`
- `pnpm run typecheck:server`
- `pnpm run test:server:retry`
- `pnpm run test:release:guard`
- pre-push release guard
- local frontend smoke at `http://127.0.0.1:3000`
- GitHub Actions for `a203c397`: CI, E2E Playwright Tests, Docker Build, Backend Production Smoke

Passed after release metadata update:

- `pnpm run lint`
- `pnpm run typecheck:server`
- `pnpm run test:release:guard`
- `git diff --check`
- local frontend smoke at `http://127.0.0.1:3000`

## Known Caveats

- Local machine uses Node `24.14.0`, while `package.json` declares Node `22.x`. pnpm reports an engine warning locally. CI and production should stay on Node 22.
- `pnpm run test:workflows` is not part of this release gate because local dashboard-service workflow tests still depend on generated/live external-service data and GitHub API access. This remains a follow-up, not a release blocker for the completed Linear scope.
- Generated ignored monitoring/test files under `scripts/` may appear during validation and must not be staged.

## Release Decision

Release `v0.1.2` as a patch version. The scope is operational hardening and test coverage, with no intentional product behavior change outside fatal error shutdown and CI/smoke gate correctness.

## Post-release Automation Note

The tag workflow `Update Changelog` failed for the already-published `v0.1.2` tag because the changelog script referenced `conventional-changelog` without an installed CLI package. The GitHub Release was created manually from the stable tag. The workflow dependency gap is fixed on `main` in `fc7753e4` with a regression test in `scripts/validate-github-workflows.test.ts`.
