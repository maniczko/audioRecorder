# Next Work Plan

Last updated: 2026-04-25 after `v0.1.2`.

## P0 - Post-release Follow-up

- Run one real microphone recording smoke in Chrome with the deployed or local backend.
- Keep `v0.1.2` stable; the tag is published and should not be moved.
- `VAT-179` - make workflow dashboard tests hermetic so `pnpm run test:workflows` can become a reliable gate.
- `VAT-178` - pin local development to Node 22 to remove the recurring pnpm engine warning.

## P1 - Audio Pipeline Hardening

- `VAT-152` - decide how to move or isolate heavy audio processing away from the UI for long recordings.
- Add explicit file-size and duration guardrails shared between frontend copy and backend enforcement.
- Move expensive audio enhancement work behind a user-visible status and measurable timing.
- Add stuck-job detection and cleanup metrics for long-running transcription jobs.

## P2 - Maintainability

- `VAT-117` - refactor server bootstrap into startup checks, service composition, cleanup, server startup, and shutdown modules.
- `VAT-116` - split `AppShellModern` into smaller layout, navigation, workspace, and command modules.
- `VAT-115` - split `AuthScreen` into focused auth, onboarding, reset, and social-login modules.
- `VAT-120` - tighten shared typing and reduce unjustified broad `any` usage in frontend foundations.

## P3 - Operations And Repo Hygiene

- `VAT-160` - group monitoring errors by stable keys and reduce duplicate Linear/GitHub issue creation.
- `VAT-118` - centralize operational docs and archive root-level historical reports/logs.
- Keep only README, AGENTS, ARCHITECTURE, CHANGELOG, package metadata, and entry-point config at repository root where practical.
