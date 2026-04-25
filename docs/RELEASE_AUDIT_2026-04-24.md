# Release Audit - 2026-04-24

## Scope

Project: `audioRecorder` only.

This audit covers local uncommitted changes, Linear backlog alignment, CI/workflow posture, and release readiness for the recorder queue stabilization release.

## Local Change Audit

Changed recording areas:

- `src/hooks/useAudioHardware.ts`
- `src/hooks/useRecorder.ts`
- `src/lib/audioStore.ts`
- `src/lib/recording.ts`
- `src/lib/recordingQueue.ts`
- `src/services/mediaService.ts`
- `src/store/recorderStore.ts`
- `src/store/recorderQueueProcessor.ts`

Summary:

- Recorder queue processing was extracted from the Zustand store into a focused processor.
- Queue summary counters now cover every supported status.
- Failed recording start now clears `recordingMeetingId`.
- Microphone lifecycle tests were expanded.
- `OverconstrainedError` now gets a user-facing message and relaxed microphone constraint fallback.
- Audio storage now uses a `.ts` module and has explicit large-blob/quota tests.
- Transcription progress auth now uses an `Authorization` header in the streaming request instead of putting the token in the URL.
- Frontend lint now includes tests.
- CI now includes an explicit frontend Vitest job.
- Auto-fix PR workflows are manual-only.

## Validation Snapshot

Passed:

- `pnpm exec vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recording.test.ts src/lib/recording.browser.test.ts src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts --coverage.enabled=false`
- `pnpm run typecheck:all`
- `pnpm run lint:all`
- `$env:NODE_OPTIONS='--max-old-space-size=8192'; pnpm run test:frontend:ci`
- `pnpm run test:server:retry`
- `pnpm run build`
- `pnpm run format:check`
- `node scripts/validate-github-workflows.mjs`
- `node scripts/validate-ci-workflow-summary.mjs`
- `git diff --check`

Observed:

- Local machine uses Node 24.14.0 while `package.json` declares Node 22.x. pnpm reports this as an engine warning. CI and release runtime should use Node 22.x.
- Frontend Vitest was made reproducible by sharding `test:frontend:ci` into 8 shards and using a lightweight `react-virtuoso` test mock.
- Backend tests were kept offline by mocking Supabase Storage in `server/tests/setup.ts`; Supabase-specific tests still provide their own explicit mocks.

## Completed Linear Scope

- AUD-001 local validation reproduced.
- AUD-002 CI frontend Vitest gate added.
- AUD-003 security audit policy clarified.
- AUD-004 microphone lifecycle tests expanded.
- AUD-005 `OverconstrainedError` handling added.
- AUD-006 failed start reset fixed.
- AUD-007 recorder store tests restored around queue behavior.
- AUD-008 queue summary counters fixed.
- AUD-009 processQueue split into a smaller processor.
- AUD-011 expensive local audio handling has bounded storage/upload limits and fallback tests.
- AUD-013 progress auth no longer sends the session token in the URL.
- AUD-014 large audio buffering has client/server upload limits documented and tested at the storage boundary.
- AUD-017 audio storage module extension changed from `.tsx` to `.ts`.
- AUD-018 install/start docs normalized.
- AUD-019 auto-PR triggers constrained.
- AUD-021 PR checklist updated.
- AUD-022 agent instructions updated.

## Remaining Risk

The broader M1/M2/M3 backlog still contains large refactors and architecture cleanup that should not be mixed into this stabilization release.
