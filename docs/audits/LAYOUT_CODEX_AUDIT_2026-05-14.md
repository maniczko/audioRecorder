# Layout/Codex Rescore - 2026-05-14

## Score

Current implemented target: **8.9/10 repo readiness**, capped below 9 because the production backend smoke currently fails.

9/10 criteria are now encoded as gates:

- `pnpm run release:rehearsal`
- `pnpm run test:visual:check`
- `pnpm run audit:build-warnings`
- `pnpm run audit:a11y:ci`
- `pnpm run audit:mojibake`
- `pnpm run release:prod-smoke`

## Closed Gaps

- Added canonical Node 22 release rehearsal script.
- Made CSS lint, strict a11y, build-warning audit, and visual baselines release-blocking.
- Replaced the Clarity HTML placeholder with guarded runtime initialization.
- Split React core chunking away from virtualized/base-ui/observability vendors.
- Added full viewport visual baseline coverage for auth, shell tabs, overlays, notification center, and failure-state surfaces.
- Added design-system governance rules for spacing, breakpoints, focus, layering, encoding, and artifact ownership.
- Added production smoke script for Vercel/Railway health and Supabase remote persistence signal.

## Local Evidence

Validated on 2026-05-14 from this workstation:

- Runtime: Node `v22.14.0`, pnpm `9.12.1`, using the repo-local `.tools/node-v22.14.0-win-x64` runtime.
- `pnpm install --frozen-lockfile` passed; lockfile was up to date.
- `pnpm run release:rehearsal` passed end-to-end on Node 22.
- `pnpm run format:check` passed.
- `pnpm run typecheck:all` passed.
- `pnpm run lint:all` passed.
- `pnpm run lint:css` passed.
- `pnpm run audit:build-warnings` passed with no release-blocking build warnings.
- `pnpm run audit:a11y:ci` passed with 0 errors, 0 warnings, 0 info.
- `pnpm run audit:mojibake` passed.
- `pnpm audit --audit-level=high` passed with no known high/critical vulnerabilities.
- `pnpm run test:server:retry` passed: 75 files passed, 3 skipped; 1008 tests passed, 97 skipped.
- `pnpm run test:frontend:ci` passed across all 8 shards.
- `pnpm run test:visual:check -- --project=chromium --workers=1` passed: 14/14 visual baseline tests.
- Workflow guard tests and validators passed for CI, Playwright, Vercel production, and Vite build config.
- `pnpm install --frozen-lockfile` on Node 22 no longer emits the deprecated package `workspaces` warning; `pnpm-workspace.yaml` is the only workspace declaration.
- `scripts/validate-env.js` now blocks incomplete Supabase Postgres hosts in production without exposing database passwords in diagnostics.
- The GitHub PR template now requires Node 22 rehearsal, visual artifacts, a11y/build-warning gates, production smoke, and Supabase persistence evidence.
- `release:prod-smoke` now scans same-origin frontend JS/CSS assets for mojibake markers before backend health checks.

## Production Smoke Evidence

Read-only production smoke was attempted on 2026-05-14:

- Frontend `https://voicelog-audiorecorder.vercel.app` returned `200` and exposed the app root/VoiceLog markers.
- Frontend asset `https://voicelog-audiorecorder.vercel.app/assets/index-BpHlFh6g.js` zawieral zepsute polskie znaki w copy walidacji, nazwie produktu i sloganie.
- Backend `https://audiorecorder-production.up.railway.app/health` returned `503`.
- The backend health payload reported `supabaseRemote: true`, but `status: degraded`.
- The DB health error indicates an incomplete Supabase Postgres host: `postgres.<project-ref>` instead of a complete resolvable Supabase direct or pooler host.

These block a 9/10 score until the Vercel frontend is redeployed from the UTF-8-clean build and the Railway `DATABASE_URL` or `VOICELOG_DATABASE_URL` secret is corrected.

Tracking issues:

- https://github.com/maniczko/audioRecorder/issues/538
- https://github.com/maniczko/audioRecorder/issues/539

## Remaining Evidence Required For 9/10

- Review and commit the generated visual baseline screenshots from the chosen baseline environment.
- Redeploy Vercel from the current UTF-8-clean build and confirm Polish text renders correctly.
- Fix Railway Postgres connection string and rerun production smoke against the deployed Vercel/Railway URLs.
- Attach upload -> restart/redeploy -> recording/transcript persistence evidence to the release PR or provide `PRODUCTION_PERSISTENCE_EVIDENCE_URL`.
