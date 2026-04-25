# Next Work Plan

## P0 - Post-release Follow-up

- Push the release commit/tag and watch GitHub Actions to completion.
- Run one real microphone recording smoke in Chrome with the deployed or local backend.
- Move remaining historical root reports into `docs/archive/`.
- Decide whether local development should pin Node 22 via `.nvmrc`/Volta to remove Node 24 engine warnings.

## P1 - Audio Pipeline Hardening

- Add explicit file-size and duration guardrails shared between frontend copy and backend enforcement.
- Move expensive audio enhancement work behind a user-visible status and measurable timing.
- Add browser-level regression coverage for transcription progress authorization.
- Add stuck-job detection and cleanup metrics for long-running transcription jobs.

## P2 - Maintainability

- Type `recorderStore` instead of using broad `any`.
- Split `AuthScreen` into form, onboarding, reset, and social-login modules.
- Split `AppShellModern` into layout, navigation, workspace, and command modules.
- Refactor `server/index.ts` into startup checks, service composition, cleanup, and shutdown modules.

## P3 - Repo Hygiene

- Move root-level historical reports into `docs/archive/`.
- Remove generated reports from tracking where safe.
- Keep only README, AGENTS, ARCHITECTURE, CHANGELOG, package metadata, and entry-point config at repository root.
