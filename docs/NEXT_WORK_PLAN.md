# Next Work Plan

Last updated: 2026-04-25 after `v0.1.3` preparation.

Completed after `v0.1.2`:

- `VAT-178` - local Node 22 runtime is pinned with `.nvmrc` and `.node-version`.
- `VAT-179` - workflow dashboard tests are hermetic and use tracked fixtures instead of generated local snapshots.
- `VAT-152` - large audio preprocessing boundary is documented and long or large recordings skip browser-side VAD/enhancement.
- `VAT-160` - monitoring reports are grouped by stable fingerprints before creating or updating GitHub issues.
- `VAT-117` - server bootstrap is split into startup maintenance, periodic cleanup, and runtime lifecycle modules.
- `VAT-116` - `AppShellModern` is a smaller orchestrator with app-shell components and focused tests.
- `VAT-115` - `AuthScreen` is a smaller orchestrator with auth components and focused tests.
- `VAT-120` - shared frontend contracts and mention textarea typing no longer rely on broad `any` usage.
- `VAT-118` - root documentation clutter is archived into structured `docs/` sections.

## P0 - Post-release Follow-up

- Run one real microphone recording smoke in Chrome with the deployed or local backend.
- Monitor the `v0.1.3` tag workflow, GitHub Release creation, and production deploy signal.
- Watch the first scheduled monitoring runs to confirm stable issue grouping reduces duplicates.

## P1 - Audio Pipeline Hardening

- Add explicit file-size and duration guardrails shared between frontend copy and backend enforcement.
- Move expensive audio enhancement work behind a user-visible status and measurable timing.
- Add stuck-job detection and cleanup metrics for long-running transcription jobs.

## P2 - Maintainability

- Continue decomposing `server/database.ts` and `server/pipeline.ts` around persistence, upload assembly, and transcription orchestration boundaries.
- Split the largest shared test setup concerns out of `src/setupTests.ts` so frontend tests stay easier to reason about.
- Keep refactors behavior-preserving and tied to focused tests.

## P3 - Operations And Repo Hygiene

- Consolidate overlapping GitHub Actions once the new monitoring grouping has run cleanly for a few cycles.
- Move or retire stale generated reports if they are not used by current verification or release workflows.
- Keep only README, AGENTS, ARCHITECTURE, CHANGELOG, package metadata, and entry-point config at repository root.
