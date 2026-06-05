# P0/P1 EXECUTION READY LIST (status + mapping + commit order)

Data: 2026-06-04
Scope: ARCHITECTURE.md + docs/API.md
Cel: lista do odhaczenia implementacyjnego, gotowa do uruchomienia.

## Założenia jakości

- W obszarach P0/P1 po zamknięciu etapu nie ma `test.skip`/`it.skip`/`describe.skip`.
- W nowych i modyfikowanych testach P0/P1 nie stosujemy `toBeDefined` jako jedynej asercji.
- Retry = błąd przejściowy (timeout/network 5xx/transient) z potwierdzonym fallback/ponowną próbą.

## P0 (blokery) — checklista implementacyjna

### P0-01 `src/hooks/useAudioHardware.test.ts`

- `describe('useAudioHardware')`
  - [x] shows error message when microphone permission is denied
  - [x] startRecording times out and marks setup as recoverable retry state
  - [x] calls onStartFailure and keeps idle state when recording start fails
  - [x] cleanupRecorder is invoked when recorder setup fails
  - [x] cleanupRecorder resets state without crash
  - [x] releases stream/audio resources when recognition controller initialization fails
  - [x] does not leak tracks across repeated start failures
  - [x] startRecording calls getUserMedia after prior NotAllowedError and recovers on retry
  - [x] temporary setup failure is recoverable and retry succeeds
  - [x] non-permission errors do not set recordPermission to denied

### P0-02 `src/hooks/useRecorder.test.tsx`

- `describe('useRecorder')`
  - [x] queueRecording sets error status when saveAudioBlob throws
  - [x] queueRecording removes partial artifacts and keeps queue unchanged on storage failures
  - [x] Regression: clears recordingMeetingId when hardware start fails
  - [x] blocks remote recording when workspace context is missing
  - [x] does not enqueue stopped remote recording when workspace context is missing
  - [x] queues recording fails if blob is missing and can be retried by user flow
  - [x] quota exceeded error keeps recording queued as retryable
  - [x] transitions blob upload error into recoverable queue state

### P0-03 `src/lib/recordingQueue.test.ts`

- `describe('recordingQueue helpers')`
  - [x] returns a stable zeroed summary for an empty queue
  - [x] does not consider remote queue item processable without workspace context
  - [x] keeps a queue snapshot recoverable instead of fuzzy matching a same-title meeting

### P0-03 `src/store/recorderStore.test.ts`

- `describe('recorderStore')`
  - [x] queues stored recording for retry without reupload
  - [x] retryStoredRecording returns null for missing meeting or recording
  - [x] retryStoredRecording returns null for completed transcript without explicit force

### P0-04 `src/store/recorderQueueProcessor.test.ts`

- `describe('processRecordingQueueItem')`
  - [x] requeues transient upload failures with backoff metadata
  - [x] advances transient retry delay when previous backoff count exists
  - [x] preserves item after fetch abort and retries once with backoff
  - [x] marks stale uploaded remote recordings as permanent without retrying STT
  - [x] Regression: retries queue item when processing state is stuck
  - [x] Regression: retries queue item when Vercel proxy times out connecting to backend
  - [x] Regression: retries queue item when backend is temporarily memory overloaded

### P0-05 `server/tests/routes/media.test.ts`

- `describe('Media Routes')`
  - [x] PUT /media/recordings/:recordingId/audio - upload success
  - [x] PUT /media/recordings/:recordingId/audio - retries after transient memory pressure fallback
  - [x] PUT /media/recordings/:recordingId/audio - returns 507 when disk is full
  - [x] POST /media/recordings/:recordingId/transcribe - queues job
  - [x] POST /media/recordings/:recordingId/transcribe - returns retry-friendly transient error then succeeds after retry
  - [x] GET /media/recordings/:recordingId/transcribe - returns payload
  - [x] POST /media/recordings/:recordingId/retry-transcribe - requeues failed recording without reupload
  - [x] POST /media/recordings/:recordingId/retry-transcribe - allows retry for completed empty transcript
  - [x] POST /media/recordings/:recordingId/retry-transcribe - does not duplicate queueing when repeated retry happens
  - [x] POST /media/recordings/:recordingId/retry-transcribe - falls back to reconstructed Supabase key
  - [x] POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries
  - [x] GET /media/recordings/:recordingId/audio - serves reconstructed key when source asset was moved atomically
  - [x] GET /media/recordings/:recordingId/transcribe - race polling and empty transcript edge cases

### P0-05 `server/tests/routes/media.additional.test.ts`

- `describe('Media Routes - Additional Coverage')`
  - [x] returns 200 and keeps nextIndex stable when duplicate chunk index is retried
  - [x] returns 507 and keeps retryability when disk is full during chunk upload
  - [x] returns 500 when chunk checksum is invalid
  - [x] returns 200, creates asset, and cleans up chunk files when all chunks are present
  - [x] keeps uploaded chunks retryable and removes assembled temp file after storage error
  - [x] is idempotent when called again after successful finalize

### P0-06 `server/tests/routes/auth.test.ts`

- `describe('Auth Routes')`
  - [x] GET /auth/session - transient getSession failure is recoverable by retry
  - [x] GET /auth/session - 401 recovery using refresh token fallback and then retry success
  - [x] GET /auth/session - unknown session errors are surfaced
  - [x] GET /auth/session - token expires during polling and recovers on next request
  - [x] POST /auth/google - returns 401 on token mismatch

### P0-06 `server/tests/routes/state.test.ts`

- `describe('State Routes')`
  - [x] GET /state/bootstrap - success with valid token
  - [x] GET /state/bootstrap - transient buildSessionPayload failure is recoverable
  - [x] GET /state/bootstrap - recovers when primary token is expired using refresh token fallback
  - [x] GET /state/bootstrap - retryable 401 path with same payload after refresh
  - [x] PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss
  - [x] PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes
  - [x] PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss

### P0-07 skipi na P0/P1

- [x] src/App.test.tsx: `test.skip('renders auth screen when no session')`
- [x] src/App.integration.test.tsx: `describe.skip('App integration')`
- [x] src/AuthScreen.a11y.test.tsx: describe aktywny
- [x] src/CommandPalette.a11y.test.tsx: describe aktywny
- [x] server/tests/pipeline-coverage.test.ts: `it.skip` odblokowane
- [x] server/tests/audio-pipeline.unit.test.ts: `it.skip` odblokowane
- [x] Dodatkowa finalna walidacja `rg -n "(describe\.skip|it\.skip|test\.skip)"` dla pozostałych plikow P0/P1

## P1 (stabilizacja) — checklista implementacyjna

### P1-01 `server/tests/routes/workspaces.test.ts`

- `describe('Workspace Routes')`
  - [x] updates workspace member roles only for owner/admin memberships
  - [x] viewer role denied for role change

### P1-02 `server/tests/routes/voice-profiles.test.ts`

- `describe('PATCH /voice-profiles/:id/threshold')`
  - [x] endpoint exists and auth is required
  - [x] supports transient failure recovery with client retry
  - [x] viewer role blocked from threshold update
- `describe('Voice Profiles Routes')`
  - [x] DELETE /voice-profiles/:id
  - [x] supports repeated identical updates (idempotency)
  - [x] parallel delete idempotency/second delete edge

### P1-03 `server/tests/routes/ai.test.ts`

- `describe('POST /ai/person-profile')`
  - [x] transient empty response provider handled as structured fallback
- `describe('POST /ai/search')`
  - [x] transient empty provider body handled as fallback
- `describe('POST /ai/suggest-tasks')`
  - [x] transient empty provider body handled as fallback

### P1-04 `server/tests/routes/media.test.ts`

- `describe('Media Routes')`
  - [x] POST /media/recordings/:recordingId/retry-transcribe - requeues failed recording without reupload
  - [x] POST /media/recordings/:recordingId/retry-transcribe - protects completed non-empty transcript from accidental retry
  - [x] returns same job id on repeated retries

### P1-05 `server/tests/routes/media.additional.test.ts`

- `describe('GET /media/recordings/:recordingId/audio/chunk-status integration')`
  - [x] returns isolated status with correct nextIndex when no chunks exist
  - [x] returns isolated status with correct nextIndex when some chunks exist
  - [x] parallel upload sessions isolation

### P1-06 security/perf

- `server/tests/routes/clientErrors.test.ts`
  - [ ] retention policy and cleanup by limit
- `server/tests/security.test.ts`
  - [ ] positive admin token path and invalid token rejection for metrics/endpoints
- `server/tests/routes/transcribe.test.ts`
  - [ ] timeout/perf scenario

## Komendy startowe (gotowe do uruchomienia)

### Q1-front queue/audio

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2-media critical

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/routes/transcribe.test.ts
```

### Q3-auth-state

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4-p1

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/workspaces.test.ts server/tests/routes/voice-profiles.test.ts server/tests/routes/ai.test.ts
npx vitest run -c server/vitest.config.ts server/tests/routes/clientErrors.test.ts server/tests/security.test.ts src/AuthScreen.a11y.test.tsx src/CommandPalette.a11y.test.tsx src/App.integration.test.tsx
```

### Release gates

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run test:coverage:all
```

## Proponowana kolejność commitów

1. `test(frontend): p0 - audio hardware + recorder and queue hardening`
   - useAudioHardware/useRecorder + recordingQueue + recorderStore + recorderQueueProcessor
2. `test(server): p0 - media upload/finalize/transcribe critical`
   - media routes + media.additional + transcribe
3. `test(server): p0 - auth/session/bootstrap resilience`
   - auth + state
4. `test(qa): p0 - blocker skips and acceptance cleanup`
   - pipeline coverage/pipeline unit, App + a11y describe activation
5. `test(server): p1 - RBAC + AI + voice profile hardening`
   - workspaces + voice-profiles + ai
6. `test(qa): p1/p2 polish gates`
   - client errors + security + perf/e2e/a11y touch-ups
