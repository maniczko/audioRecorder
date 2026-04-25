# Release Audit - 2026-04-25 - v0.1.3

## Scope

Project: `audioRecorder` only.

This release completes the remaining Linear backlog items identified for the project in this cycle:

- `VAT-160` - stable monitoring issue grouping.
- `VAT-117` - server bootstrap and runtime responsibility split.
- `VAT-116` - `AppShellModern` split.
- `VAT-115` - `AuthScreen` split.
- `VAT-120` - shared typing cleanup.
- `VAT-118` - documentation structure cleanup.

## Change Set

- Monitoring reporters now derive stable fingerprints from GitHub and Railway error data and upsert GitHub issues by group label.
- Server startup work is split into startup maintenance, periodic cleanup, and runtime lifecycle modules.
- `AppShellModern` and `AuthScreen` are smaller orchestrators backed by focused components and tests.
- Shared frontend contracts and mention textarea handling avoid broad `any` usage in foundational code.
- Root documentation has been moved into `docs/ops`, `docs/automation`, `docs/testing`, and `docs/archive`.
- `CHANGELOG.md` and `package.json` are prepared for `0.1.3`.

## Validation Snapshot

Passed locally before release:

- `pnpm run format:check`
- `git diff --check`
- focused frontend tests for app shell, auth, shared contracts, mention textarea, and docs structure
- focused server tests for startup maintenance, periodic cleanup, and server runtime
- `pnpm run test:workflows`
- `pnpm run typecheck:all`
- `pnpm run lint`
- `pnpm run test:release:guard`
- local frontend smoke at `http://localhost:3000` returned `200`

## Known Caveats

- Local machine uses Node `24.14.0`, while the project declares Node `22.x`. pnpm reports an engine warning locally. CI and production should stay on Node 22.
- A real microphone recording smoke still needs to be run in Chrome after deployment because automated tests cannot fully prove hardware/browser capture behavior.

## Release Decision

Release `v0.1.3` as a patch version. The scope is maintainability, operational correctness, test coverage, and documentation hygiene, with no intentional product behavior change beyond more stable monitoring issue creation.
