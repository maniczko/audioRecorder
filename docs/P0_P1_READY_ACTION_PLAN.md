# P0/P1 READY CHECKLIST -- IMPLEMENTATION MAP

Data: 2026-06-04  
Scope: `ARCHITECTURE.md` + `docs/API.md`

## Wymagania wejscia

- Kazdy punkt ma przypisanie do pliku testowego i konkretnego `describe` / `it`.
- P0 musi osiagnac `status = [x]` dla wszystkich blokow.
- Po zamknieciu P0 brak `describe.skip` / `it.skip` / `test.skip` w plikach P0/P1.
- W nowych/zmienionych testach nie uzywamy `toBeDefined` jako jedynej asercji.

## Stan wykonania (na 2026-06-04)

- P0: DONE -- **ZAMKNIETE** (wszystkie checklisty w bloku maja `x`).
- P1: OPEN -- 4 elementy do domkniecia:
  - `server/tests/routes/clientErrors.test.ts` -- retention policy + cleanup by limit
  - `server/tests/security.test.ts` -- pozytywny path admin token + odrzucenie blednego tokenu
  - `server/tests/routes/transcribe.test.ts` -- timeout/perf scenariusz
  - `src/AuthScreen.a11y.test.tsx` + `src/CommandPalette.a11y.test.tsx` -- focus-visible + keyboard order (jesli traktujemy je jako P1)

## P0 --- CHECKLISTA IMPLEMENTACYJNA

### P0-01 `src/hooks/useAudioHardware.test.ts`

- `describe('useAudioHardware')`
  - `it('shows error message when microphone permission is denied')`
  - `it('startRecording times out and marks setup as recoverable retry state')`
  - `it('calls onStartFailure and keeps idle state when recording start fails')`
  - `it('cleanupRecorder is invoked when recorder setup fails')`
  - `it('cleanupRecorder resets state without crash')`
  - `it('releases stream/audio resources when recognition controller initialization fails')`
  - `it('does not leak tracks across repeated start failures')`
  - `it('startRecording calls getUserMedia after prior NotAllowedError and recovers on retry')`
  - `it('temporary setup failure is recoverable and retry succeeds')`
  - `it('non-permission errors do not set recordPermission to denied')`

### P0-02 `src/hooks/useRecorder.test.tsx`

- `describe('useRecorder')`
  - `it('queueRecording sets error status when saveAudioBlob throws')`
  - `it('queueRecording removes partial artifacts and keeps queue unchanged on storage failures')`
  - `it('Regression: clears recordingMeetingId when hardware start fails')`
  - `it('blocks remote recording when workspace context is missing')`
  - `it('does not enqueue stopped remote recording when workspace context is missing')`
  - `it('does not enqueue if blob is missing and allows user retry path')`
  - `it('queues recording fails if blob is missing and can be retried by user flow')`
  - `it('quota exceeded error keeps recording queued as retryable')`
  - `it('transitions blob upload error into recoverable queue state')`

### P0-03 `src/lib/recordingQueue.test.ts`

- `describe('recordingQueue helpers')`
  - `it('returns stable empty summary for an empty queue')`
  - `it('does not consider remote queue item processable without workspace context')`
  - `it('keeps a queue snapshot recoverable instead of fuzzy matching same-title meeting')`

### P0-03 `src/store/recorderStore.test.ts`

- `describe('recorderStore')`
  - `it('queues stored recording for retry without reupload')`
  - `it('retryStoredRecording returns null for missing meeting or recording')`
  - `it('retryStoredRecording returns null for completed transcript without explicit force')`

### P0-04 `src/store/recorderQueueProcessor.test.ts`

- `describe('processRecordingQueueItem')`
  - `it('requeues transient upload failures with backoff metadata')`
  - `it('advances transient retry delay when previous backoff count exists')`
  - `it('preserves item after fetch abort and retries once with backoff')`
  - `it('marks stale uploaded remote recordings as permanent without retrying STT')`
  - `it('Regression: retries queue item when processing state is stuck')`
  - `it('Regression: retries queue item when Vercel proxy times out connecting to backend')`
  - `it('Regression: retries queue item when backend is temporarily memory overloaded')`

### P0-05 `server/tests/routes/media.test.ts`

- `describe('Media Routes')`
  - `it('PUT /media/recordings/:recordingId/audio - returns success')` i scenariusze bledow (`retry/transient`, `507 ENOSPC`)
  - `it('POST /media/recordings/:recordingId/transcribe - queues job')`
  - `it('POST /media/recordings/:recordingId/transcribe - retry-friendly transient error then succeeds after retry')`
  - `it('GET /media/recordings/:recordingId/transcribe - returns payload')`
  - `it('POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries')`
  - `it('GET /media/recordings/:recordingId/audio - serves reconstructed key when source asset was moved atomically')`
  - `it('GET /media/recordings/:recordingId/transcribe - race polling and empty transcript edge cases')`

### P0-05 `server/tests/routes/media.additional.test.ts`

- `describe('Media Routes - Additional Coverage')`
  - `it('returns 200 and keeps nextIndex stable when duplicate chunk index is retried')`
  - `it('returns 507 and keeps retryability when disk is full during chunk upload')`
  - `it('returns 500 when chunk checksum is invalid')`
  - `it('returns 200, creates asset, and cleans up chunk files when all chunks are present')`
  - `it('is idempotent when called again after successful finalize')`
  - `it('GET /media/recordings/:recordingId/audio/chunk-status integration - parallel session isolation')`

### P0-06 `server/tests/routes/auth.test.ts`

- `describe('Auth Routes')`
  - `it('GET /auth/session - transient getSession failure is recoverable by retry')`
  - `it('GET /auth/session - 401 recovery using refresh token fallback and then retry success')`
  - `it('GET /auth/session - token expires during polling and recovers on next request')`
  - `it('POST /auth/google - returns 401 on token mismatch')`

### P0-06 `server/tests/routes/state.test.ts`

- `describe('State Routes')`
  - `it('GET /state/bootstrap - success with valid token')`
  - `it('GET /state/bootstrap - transient buildSessionPayload failure is recoverable')`
  - `it('GET /state/bootstrap - recovers when primary token is expired using refresh token fallback')`
  - `it('GET /state/bootstrap - retryable 401 path with same payload after refresh')`
  - `it('PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss')`
  - `it('PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes')`
  - `it('PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss')`

### P0-07 Skip hardening

- `server/tests/pipeline-coverage.test.ts` (`it.skip` -> `it`) [done]
- `server/tests/audio-pipeline.unit.test.ts` (`it.skip` -> `it`) [done]
- `src/App.test.tsx` (`test.skip` odblokowany) [done]
- `src/App.integration.test.tsx` (`describe.skip` odblokowany) [done]
- `src/AuthScreen.a11y.test.tsx` (describe aktywny) [done]
- `src/CommandPalette.a11y.test.tsx` (describe aktywny) [done]
- `rg -n "(describe\\.skip|it\\.skip|test\\.skip)"` na plikach P0/P1 -- brak wynikow (sprawdzone)

## P1 --- CHECKLISTA DO DOMKNIJECIA

### P1-01 `server/tests/routes/workspaces.test.ts`

- `describe('Workspace Routes')`
  - `it('updates workspace member roles only for owner/admin memberships')`
  - `it('viewer role denied for role change')`

### P1-02 `server/tests/routes/voice-profiles.test.ts`

- `describe('PATCH /voice-profiles/:id/threshold')`
  - `it('endpoint exists and requires auth')`
  - `it('supports transient failure recovery with client retry')`
  - `it('viewer role blocked from threshold update')`
- `describe('Voice Profiles Routes')`
  - `it('DELETE /voice-profiles/:id')`
  - `it('supports repeated identical updates (idempotency edge)')`
  - `it('parallel delete idempotency/second delete edge')`

### P1-03 `server/tests/routes/ai.test.ts`

- `describe('POST /ai/person-profile')`
  - `it('transient empty response provider handled as structured fallback')`
- `describe('POST /ai/search')`
  - `it('transient empty provider body handled as fallback')`
- `describe('POST /ai/suggest-tasks')`
  - `it('transient empty provider body handled as fallback')`

### P1-04 `server/tests/routes/media.test.ts`

- `describe('Media Routes')`
  - `it('POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries')`

### P1-05 `server/tests/routes/media.additional.test.ts`

- `describe('Media Routes - Additional Coverage')`
  - `it('GET /media/recordings/:recordingId/audio/chunk-status integration - parallel session isolation')`

### P1-06 `server/tests/routes/clientErrors.test.ts` + `server/tests/security.test.ts` + `server/tests/routes/transcribe.test.ts`

- `describe('clientErrors route')`
  - `it('retention policy and cleanup by limit')` _(not implemented yet)_
- `describe('API Security Regression Tests')`
  - `it('positive admin token path for metrics/admin endpoints')` _(not implemented yet)_
  - `it('invalid token rejection for admin and metrics endpoints')` _(not implemented yet)_
- `describe('Transcribe Routes')`
  - `it('timeout/perf scenario')` _(not implemented yet)_

## Start realizacji P0 (gotowe do uruchomienia)

### Q1-front queue/audio

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2-media critical

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts
```

### Q3-auth/state

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4-qa (zamykanie P0)

```bash
npx vitest run -c server/vitest.config.ts server/tests/pipeline-coverage.test.ts server/tests/audio-pipeline.unit.test.ts src/App.test.tsx src/App.integration.test.tsx src/AuthScreen.a11y.test.tsx src/CommandPalette.a11y.test.tsx
```

### Q5-gates koncowe

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run test:coverage:all
```

## Kolejnosc commitow (sciezka wdrozenia)

1. `test(frontend): p0 recorder core + audio pipeline hardening`
2. `test(server): p0 media critical backend`
3. `test(server): p0 auth/session/bootstrap resilience`
4. `test(qa): p0 skip removal + acceptance checks`
5. `test(server): p1 rbac + ai + idempotency`
6. `test(qa): p1 polish -- retention, security, perf, a11y`
