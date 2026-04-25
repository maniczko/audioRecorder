# Next Work Plan

Last updated: 2026-04-25 after `v0.1.2`.

Completed after `v0.1.2`:

- `VAT-178` - local Node 22 runtime is pinned with `.nvmrc` and `.node-version`.
- `VAT-179` - workflow dashboard tests are hermetic and use tracked fixtures instead of generated local snapshots.
- `VAT-152` - large audio preprocessing boundary is documented and long or large recordings skip browser-side VAD/enhancement.

## P0 - Post-release Follow-up

- Run one real microphone recording smoke in Chrome with the deployed or local backend.
- Keep `v0.1.2` stable; the tag is published and should not be moved.

## P1 - Audio Pipeline Hardening

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
