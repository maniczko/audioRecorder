# TEST P0/P1 IMPLEMENTATION MATRIX (checkpoint)

Data: 2026-06-04
Zakres: ARCHITECTURE.md + docs/API.md
Status bazowy: po dodaniu test�w do `server/tests/routes/media.test.ts`.

## P0 � blokery (do domkni�cia przed P1)

### P0-01 `src/hooks/useAudioHardware.test.ts`

- [x] describe `useAudioHardware`
  - [x] shows error message when microphone permission is denied
  - [x] startRecording times out and marks setup as recoverable retry state
  - [x] cleanupRecorder is invoked when recorder setup fails
  - [x] cleanupRecorder resets state without crash
  - [x] releases stream/audio resources when recognition controller initialization fails
  - [x] does not leak tracks across repeated start failures
  - [x] startRecording calls getUserMedia after prior NotAllowedError and recovers on retry
  - [x] temporary setup failure is recoverable and retry succeeds
  - [x] non-permission errors do not set recordPermission to denied

### P0-02 `src/hooks/useRecorder.test.tsx`

- [x] describe `useRecorder`
  - [x] queueRecording sets error status when saveAudioBlob throws
  - [x] queueRecording removes partial artifacts and keeps queue unchanged on storage failures
  - [x] blocks remote recording when workspace context is missing
  - [x] does not enqueue stopped remote recording when workspace context is missing
  - [x] quota exceeded error keeps recording queued as retryable
  - [x] transitions blob upload error into recoverable queue state

### P0-03 `src/lib/recordingQueue.test.ts`

- [x] describe `recordingQueue helpers`
  - [x] returns stable empty summary
  - [x] does not consider remote queue item processable without workspace context
  - [x] keeps a queue snapshot recoverable instead of fuzzy matching same-title meeting

### P0-03 `src/store/recorderStore.test.ts`

- [x] describe `recorderStore`
  - [x] queues recording for retry without reupload
  - [x] retryStoredRecording returns null for missing meeting or recording
  - [x] retryStoredRecording returns null for completed transcript without explicit force

### P0-03 `src/store/recorderQueueProcessor.test.ts`

- [x] describe `processRecordingQueueItem`
  - [x] requeues transient upload failures with backoff metadata
  - [x] advances transient retry delay when previous backoff exists
  - [x] preserves item after fetch abort and retries once with backoff
  - [x] marks stale uploaded remote recordings as permanent without retrying STT
  - [x] Regression: retries queue item when processing state is stuck
  - [x] Regression: retries queue item when Vercel proxy times out connecting to backend
  - [x] Regression: retries queue item when backend is temporarily memory overloaded

### P0-04 `server/tests/routes/media.test.ts`

- [x] describe `Media Routes`
  - [x] POST `/media/recordings/:recordingId/audio` retry-friendly paths (retry 503, ENOSPC)
  - [x] POST `/media/recordings/:recordingId/transcribe` queue + retry scenarios
  - [x] GET `/media/recordings/:recordingId/transcribe` payload coverage
  - [x] POST `/media/recordings/:recordingId/retry-transcribe` (failed + empty + completed/no-op)
  - [x] **POST `/media/recordings/:recordingId/retry-transcribe` returns same job id on repeated retries** (now explicit: same `ensureTranscriptionJob` identity across retries)
  - [x] **GET `/media/recordings/:recordingId/transcribe` handles race polling + empty transcript edge case** (now explicit)
  - [x] GET `/media/recordings/:recordingId/audio` reconstructed key fallback (legacy/local-to-canonical)

### P0-04 `server/tests/routes/media.additional.test.ts`

- [x] describe `Media Routes - Additional Coverage`
  - [x] chunk upload/status baseline + duplicate status stability
  - [x] finalize path idempotency
  - [x] chunk checksum error + ENOSPC retryability cases
  - [x] delete + transcode endpoints as implemented in file

### P0-05 `server/tests/routes/auth.test.ts` + `server/tests/routes/state.test.ts`

- [x] GET `/auth/session`
- [x] GET `/state/bootstrap`
- [x] PUT `/state/workspaces/:workspaceId` + PATCH rollback/retry paths

### P0-06 `skip` hardening

- [ ] finalna walidacja skanem `rg -n "(describe\.skip|it\.skip|test\.skip)"` pod k�tem pozosta�ych P0/P1

---

## P1 � stabilizacja

### P1-01 RBAC i role

- `server/tests/routes/workspaces.test.ts`
  - [x] updates roles only for owner/admin
  - [ ] viewer role denied for role change
- `server/tests/routes/voice-profiles.test.ts`
  - [ ] viewer role no-ops for threshold update

### P1-02 Idempotencja i bezpiecze�stwo medi�w

- `server/tests/routes/voice-profiles.test.ts`
  - [ ] supports repeated identical updates (idempotency)
  - [ ] parallel delete idempotency/second delete edge
- `server/tests/routes/media.test.ts`
  - [ ] same retry-transcribe job id determinism (coverage cross-check with endpoint contract)
- `server/tests/routes/media.additional.test.ts`
  - [ ] GET `/media/recordings/:recordingId/audio/chunk-status integration` � parallel upload sessions isolation

### P1-03 Integracje zewn�trzne

- `server/tests/routes/ai.test.ts`
  - [ ] transient empty response fallback for `person-profile`
  - [ ] transient empty response fallback for `search`
  - [ ] transient empty response fallback for `suggest-tasks`

### P1-04 Ops/polityki + perfo

- `server/tests/routes/clientErrors.test.ts`
  - [ ] retention policy and cleanup by limit
- `server/tests/security.test.ts`
  - [ ] metrics/admin token path + invalid token rejection
- `server/tests/transcribe.test.ts`
  - [ ] timeout/perf scenario

---

## Mapping do szybkiego startu P0 (gotowe komendy)

- `src/hooks/useAudioHardware.test.ts`
- `src/hooks/useRecorder.test.tsx`
- `src/lib/recordingQueue.test.ts`
- `src/store/recorderStore.test.ts`
- `src/store/recorderQueueProcessor.test.ts`

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

- `server/tests/routes/media.test.ts` `server/tests/routes/media.additional.test.ts`

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts
```

- Auth/session/bootstrap block

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

## Kolejno�� commit�w rekomendowana

1. `test(frontend): p0 - audio hardware + recorder + queue hardening`
   - frontend audio/hook/store tests from step above
2. `test(server): p0 - media critical pipeline (audio + transcribe + retry-transcribe)`
   - `server/tests/routes/media.test.ts`, `server/tests/routes/media.additional.test.ts`
3. `test(server): p0 - auth/session/workspace bootstrap resilience`
   - `server/tests/routes/auth.test.ts`, `server/tests/routes/state.test.ts`
4. `test(qa): p0 - remaining skips + acceptance cleanup`
   - `src/App.test.tsx`, `src/App.integration.test.tsx`, `src/AuthScreen.a11y.test.tsx`, `src/CommandPalette.a11y.test.tsx`, `server/tests/pipeline-coverage.test.ts`, `server/tests/audio-pipeline.unit.test.ts`
5. `test(server): p1 - RBAC + integrations + identity/idempotency`
6. `test(qa): p1/p2 polish`
