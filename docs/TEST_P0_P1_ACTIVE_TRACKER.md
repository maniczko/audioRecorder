# TEST P0/P1 ACTIVE TRACKER (status + mapping + commit order)

## Scope

- Rozbicie na punkty P0/P1 z konkretnymi plikami testowymi (`describe/it`) oraz gotowymi komendami i kolejnoscia commitow.
- Zakres oparty o:
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/TEST_P0_P1_IMPLEMENTATION_TASKS.md`
- `docs/TEST_COVERAGE_IMPLEMENTATION_CHECKLIST.md`
- `docs/TEST_P0_P1_EXECUTION_BACKLOG.md`

## Status snapshot (2026-06-04)

- `x` = done
- `[ ]` = TODO
- `[~]` = in progress / optional

### P0

#### P0-01 AudioHardware (`src/hooks/useAudioHardware.test.ts`)

- `describe('useAudioHardware')`
- `x` `shows error message when microphone permission is denied`
- `x` `startRecording times out and marks setup as recoverable retry state`
- `x` `cleanupRecorder is invoked when recorder setup fails`
- `x` `cleanupRecorder resets state without crash`
- `x` `releases stream/audio resources when recognition controller initialization fails`
- `x` `does not leak tracks across repeated start failures`
- `x` `startRecording calls getUserMedia after prior NotAllowedError and recovers on retry`
- `x` `temporary setup failure is recoverable and retry succeeds`
- `x` `non-permission errors do not set recordPermission to denied`

#### P0-02 Recorder flow (`src/hooks/useRecorder.test.tsx`)

- `describe('useRecorder')`
- `x` `queueRecording sets error status when saveAudioBlob throws`
- `x` `queueRecording removes partial artifacts and keeps queue unchanged on storage failures`
- `x` `blocks remote recording when workspace context is missing`
- `x` `does not enqueue stopped remote recording when workspace context is missing` _(dopisaÄ‡)_
- `x` `quota exceeded error keeps recording queued as retryable` _(dopisaÄ‡)_
- `x` `transitions blob upload error into recoverable queue state` _(dopisaÄ‡)_
- `x` `queues recording fails if blob is missing and can be retried by user flow`

#### P0-03 Queue + store (`src/lib/recordingQueue.test.ts`, `src/store/recorderStore.test.ts`, `src/store/recorderQueueProcessor.test.ts`)

- `describe('recordingQueue helpers')`
  - `x` `returns a stable zeroed summary for an empty queue`
  - `x` `does not consider remote queue item processable without workspace context`
  - `x` `keeps a queue snapshot recoverable instead of fuzzy matching a same-title meeting`
- `describe('recorderStore')`
  - `x` `queues stored recording for retry without reupload`
  - `x` `retryStoredRecording returns null for missing meeting or recording`
  - `x` `retryStoredRecording returns null for completed transcript without explicit force`
- `describe('processRecordingQueueItem')`
  - `x` `requeues transient upload failures with backoff metadata`
  - `x` `preserves item after fetch abort and retries once with backoff`
  - `x` `marks stale uploaded remote recordings as permanent without retrying STT`
- `x` `Regression: retries queue item when Vercel proxy times out connecting to backend`
- `x` `Regression: retries queue item when backend is temporarily memory overloaded`
  - `x` `Regression: retries queue item when processing state is stuck`

#### P0-04 Media critical endpoints (`server/tests/routes/media.test.ts`, `server/tests/routes/media.additional.test.ts`)

- `describe('Media Routes')`
  - wiÄ™kszoĹ›Ä‡ HP/ERR/AUTH: `x`
  - `x` `POST /media/recordings/{recordingId}/audio - returns 507 when disk is full`
  - `x` `POST /media/recordings/{recordingId}/transcribe - returns retry-friendly transient error then succeeds after retry`
  - `x` `POST /media/recordings/{recordingId}/retry-transcribe - does not duplicate queueing when repeated retry happens`
  - `x` `POST /media/recordings/{recordingId}/retry-transcribe - falls back to reconstructed Supabase key`
- `describe('Media Routes - Additional Coverage')`
  - `x` `returns 200 and keeps nextIndex stable when duplicate chunk index is retried`
  - `x` `returns 507 and keeps retryability when disk is full during chunk upload`
  - `x` `returns 500 when chunk checksum is invalid`
  - `x` `is idempotent when called again after successful finalize`
  - `x` `returns isolated status with nextIndex when no chunks exist`

#### P0-05 Auth/session/bootstrap (`server/tests/routes/auth.test.ts`, `server/tests/routes/state.test.ts`)

- `describe('Auth Routes')`
  - `x` `GET /auth/session - transient getSession failure is recoverable by retry`
  - `x` `GET /auth/session - 401 recovery using refresh token fallback and then retry success`
  - `x` `GET /auth/session - token expires during polling and recovers on next request`
- `x` `POST /auth/google - returns 401 on token mismatch`
- `describe('State Routes')`
  - `x` `GET /state/bootstrap - transient buildSessionPayload failure is recoverable`
  - `x` `GET /state/bootstrap - recovers when primary token is expired using refresh token fallback`
  - `x` `GET /state/bootstrap - success with valid token`
  - `x` `PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`
  - `x` `PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes`
  - `x` `PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`

#### P0-06 Blokery skipĂłw

- `x` finalna inspekcja `rg` pod kÄ…tem skipĂłw w plikach P0/P1 pozostawionych celowo.

---

### P1

#### P1-01 RBAC (`server/tests/routes/workspaces.test.ts`)

- `x` `updates workspace member roles only for owner/admin memberships`
- `[x]` `viewer role denied for role change`

#### P1-02 Voice profiles (`server/tests/routes/voice-profiles.test.ts`)

- `x` `DELETE /voice-profiles/:id` existing
- `[x]` `viewer role blocked from threshold update`
- `[x]` `parallel delete idempotency/second delete edge`

#### P1-03 AI + integracje

- `POST /ai/person-profile`
  - `x` transient empty response provider handled as structured fallback
- `POST /ai/search`
  - `x` edge case for empty provider body
- `POST /ai/suggest-tasks`
  - `x` edge case for empty provider body

#### P1-04 Retry/transcribe + chunk status

- `server/tests/routes/media.test.ts`
- `[x]` `returns same job id on repeated retries`
- `server/tests/routes/media.additional.test.ts`
  - `[x]` `GET /media/recordings/{recordingId}/audio/chunk-status integration - parallel session isolation`

#### P1-05 Hardening/P2 support

- `[ ]` `server/tests/routes/clientErrors.test.ts` retention policy
- `[ ]` `server/tests/security.test.ts` admin token positive + invalid token rejection
- `[ ]` `server/tests/transcribe.test.ts` timeout/perf scenario
- `[ ]` `src/AuthScreen.a11y.test.tsx` + `src/CommandPalette.a11y.test.tsx` focus-visible + keyboard order edge

---

## Komendy do startu P0 (kolejnosc)

### Q1-front (frontend queue/retry P0 baseline)

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2-media (audio pipeline P0)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts
```

### Q3-auth-state (session/bootstrap P0)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4-finalize + release gates

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run test:coverage:all
```

## Kolejnosc commitow

1. `test(frontend): p0 recorder core + audio pipeline gap hardening`
   - `src/store/recorderStore.test.ts`
   - `src/store/recorderQueueProcessor.test.ts`
2. `test(frontend): p0 useRecorder + audio hw baseline`
   - `src/hooks/useRecorder.test.tsx`
3. `test(server): p0 auth session bootstrap recovery`
   - `server/tests/routes/auth.test.ts`
   - `server/tests/routes/state.test.ts`
4. `test(qa): p0 close remaining queue/media/open skip gaps`
   - Pozostale checky P0 do rÄ™cznego dokoĹ„czenia

---

## Uwagi do akceptacji

- W testach P0/P1 brak nowych przypadkow, gdzie jedynÄ… asercja to `toBeDefined`.
- KaĹĽdy nowy punkt koĹ„czy sie asercja o stanie ubocznym.
- Przed zamknieciem P0 wykonac:
  - `rg -n "(describe\\.skip|it\\.skip|test\\.skip)"`
  - przeglÄ…d punktow `[ ]` w tym trackerze.
