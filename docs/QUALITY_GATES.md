# Quality Gates

## Blocking Gates

These checks must pass before a release commit:

```bash
pnpm run release:rehearsal
```

`release:rehearsal` is Node 22 only and runs typecheck, ESLint, Stylelint, Prettier,
mojibake audit, build-warning audit, server tests, frontend CI, high/critical
dependency audit, strict a11y audit, and Playwright visual baseline checks.

Local Playwright smoke can target a non-default dev server:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3002'
$env:PLAYWRIGHT_API_BASE_URL='http://127.0.0.1:4001'
pnpm exec playwright test tests/e2e/smoke.spec.js --project=chromium
```

Visual baselines are release-blocking:

```bash
pnpm run test:visual:baseline  # update after deliberate UI review
pnpm run test:visual:check     # compare against committed baselines
pnpm run test:visual:states    # focused overlay/error/loading state check
```

## Frontend Gate

Frontend changes must include colocated tests and run the relevant focused Vitest file first. For audio/recording work, run at minimum:

```bash
pnpm exec vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts --coverage.enabled=false
```

## Backend Gate

Backend route or service changes must run:

```bash
pnpm run typecheck:server
pnpm run test:server:retry
```

## Workflow Dashboard Gate

Workflow and monitoring-dashboard changes must run the hermetic workflow gate:

```bash
pnpm run test:workflows
```

This gate uses tracked fixtures for dashboard service data. Live snapshots remain opt-in via `pnpm run test:generate` or `node scripts/monitor-external-services.js` and must not be required by unit tests.

## E2E And Manual Gates

Playwright is release-blocking for UI flows that change navigation, recording UX, auth, or workspace bootstrapping:

```bash
pnpm run test:e2e
```

Production release evidence must also include:

```bash
$env:PRODUCTION_FRONTEND_URL='https://your-production-url'
$env:PRODUCTION_API_BASE_URL='https://your-production-url'
pnpm run release:prod-smoke
```

The production smoke requires `/health` to be healthy and `supabaseRemote: true`.
Upload/restart/transcript persistence evidence must be attached to the PR checklist
or exposed through `PRODUCTION_PERSISTENCE_EVIDENCE_URL`.

For audio pipeline changes, manual smoke must include:

- Start frontend and backend locally.
- Record a short sample.
- Confirm queue status moves through upload/processing/finalization.
- Confirm microphone tracks are stopped after stop/error/unmount.
- Confirm failed upload can be retried.

## Security Gate

High and critical vulnerabilities block CI unless there is a documented exception with owner, expiry date, and mitigation.

```bash
pnpm audit --audit-level=high
```

## Build Warning Gate

Production builds must not emit unresolved Vite placeholders or Rollup chunk warnings.

```bash
pnpm run audit:build-warnings
```

If a warning is intentionally accepted, document owner, expiry date, and mitigation
in the current release audit before merging.
