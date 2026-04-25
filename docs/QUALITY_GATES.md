# Quality Gates

## Blocking Gates

These checks must pass before a release commit:

```bash
pnpm run typecheck:all
pnpm run lint:all
$env:NODE_OPTIONS='--max-old-space-size=8192'; pnpm run test:frontend:ci
pnpm run test:server:retry
pnpm run build
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
