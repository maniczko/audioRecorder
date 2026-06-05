# P0/P1 TEST IMPLEMENTATION CHECKLIST (IMPLEMENTATION READY)

Data: 2026-06-04
Autor: audioRecorder QA plan

Cel:

- Rozbi� pokrycie testowe na checklisty implementacyjne per punkt P0/P1.
- Ka�dy punkt ma mapping: obszar -> plik -> `describe` -> `it`.
- Zdefiniowa� i uruchamia� przez gotowe commendy test�w oraz mie� klarown� kolejno�� commit�w.

## 0) Regu�y jako�ci (hard)

- P0/P1: `0` skip�w (`describe.skip` / `it.skip` / `test.skip`) w plikach przypisanych do danego etapu.
- W nowych i modyfikowanych testach P0/P1 nie u�ywamy `toBeDefined` jako jedynej asercji.
- Ka�dy kluczowy punkt ko�czy si� testem z efektem ubocznym (zmiana stanu, zapis, retry marker, b��d transportu, komunikat).
- `retry` = b��d przej�ciowy (timeout/network/429/5xx/stan przej�ciowy) + potwierdzony fallback.

Legenda statusu:

- `[ ]` do zrobienia
- `[~]` w toku
- `[x]` zrobione

---

## P0 � checklista implementacyjna (blokery)

### P0-01: Mikrofon / `useAudioHardware`

- File: `src/hooks/useAudioHardware.test.ts`
- `describe`: `useAudioHardware`
- Testy do zrobienia/zweryfikowania:
  - [ ] `shows error message when microphone permission is denied`
  - [ ] `startRecording times out and marks setup as recoverable retry state`
  - [ ] `cleanupRecorder is invoked when recorder setup fails`
  - [ ] `cleanupRecorder resets state without crash`
  - [ ] `releases stream/audio resources when recognition controller initialization fails`
  - [ ] `does not leak tracks across repeated start failures`
  - [ ] `Regression: denied permission does not permanently block recording` / `startRecording calls getUserMedia after prior NotAllowedError and recovers on retry`
  - [ ] `Regression: denied permission does not permanently block recording` / `temporary setup failure is recoverable and retry succeeds`
  - [ ] `startRecording is denied only on actual permission errors` (regression case)

### P0-02: Rekorder + retry zapisu

- File: `src/hooks/useRecorder.test.tsx`
- `describe`: `useRecorder`
- Testy:
  - [ ] `queueRecording sets error status when saveAudioBlob throws`
  - [ ] `queueRecording removes partial artifacts and keeps queue unchanged on storage failures`
  - [ ] `queues recording fails if blob is missing and can be retried by user flow`
  - [ ] `blocks remote recording when workspace context is missing`
  - [ ] `does not enqueue stopped remote recording when workspace context is missing`
  - [ ] `quota exceeded error keeps recording queued as retryable`
  - [ ] `transitions blob upload error into recoverable queue state`

### P0-03: Kolejka i store (deterministyczne snapshoty/retry)

- File: `src/lib/recordingQueue.test.ts`
- `describe`: `recordingQueue helpers`
- Testy:
  - [ ] `returns a stable zeroed summary for an empty queue`
  - [ ] `keeps a queue snapshot recoverable instead of fuzzy matching a same-title meeting`

- File: `src/store/recorderStore.test.ts`
- `describe`: `recorderStore`
- Testy:
  - [ ] `queues stored recording for retry without reupload`
  - [ ] `retryStoredRecording returns null for missing meeting or recording`
  - [ ] `does not consider remote queue item processable without workspace context`

### P0-04: Queue processor (retry/edge/status)

- File: `src/store/recorderQueueProcessor.test.ts`
- `describe`: `processRecordingQueueItem`
- Testy:
  - [ ] `requeues transient upload failures with backoff metadata`
  - [ ] `preserves item after fetch abort and retries once with backoff`
  - [ ] `marks stale uploaded remote recordings as permanent without retrying STT`
  - [ ] `Regression: retries queue item when Vercel proxy times out connecting to backend`
  - [ ] `Regression: retries queue item when backend is temporarily memory overloaded`
  - [ ] (opcjonalnie) `retries queue item when processing state is stuck`

### P0-05: Medial pipeline � endpointy krytyczne

- File: `server/tests/routes/media.test.ts` (`describe: Media Routes`)
- It:
  - [ ] `POST /media/recordings/:recordingId/audio - upload success`
  - [ ] `POST /media/recordings/:recordingId/audio - returns 507 when disk is full`
  - [ ] `POST /media/recordings/:recordingId/audio - maps transient provider 429/503 and is retryable`
  - [ ] `POST /media/recordings/:recordingId/transcribe - queues job`
  - [ ] `POST /media/recordings/:recordingId/transcribe - returns retry-friendly transient error then succeeds after retry`
  - [ ] `GET /media/recordings/:recordingId/transcribe - returns payload`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - requeues failed recording without reupload`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - falls back to reconstructed Supabase key`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - does not duplicate transcribe job when repeated retry is requested`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries` (jak oddzielna asercja po ID)

- File: `server/tests/routes/media.additional.test.ts` (`describe: Media Routes - Additional Coverage`)
- It:
  - [ ] `POST /media/recordings/:recordingId/audio/finalize - returns 200, creates asset, and cleans up chunk files when all chunks are present`
  - [ ] `POST /media/recordings/:recordingId/audio/finalize - keeps uploaded chunks retryable and removes assembled temp file after storage error`
  - [ ] `POST /media/recordings/:recordingId/audio/finalize - is idempotent when called after successful finalize`
  - [ ] `PUT /media/recordings/:recordingId/audio/chunk - returns 200 and keeps nextIndex stable when duplicate chunk index is retried`
  - [ ] `PUT /media/recordings/:recordingId/audio/chunk - returns 507 and keeps retryability when disk is full during chunk upload`
  - [ ] `PUT /media/recordings/:recordingId/audio/chunk - returns 500/invalid checksum when chunk checksum is invalid`
  - [ ] `GET /media/recordings/:recordingId/audio/chunk-status integration - returns isolated status with correct nextIndex`

### P0-06: Autoryzacja/session/workspace bootstrap

- File: `server/tests/routes/auth.test.ts` (`describe: Auth Routes`)
- It:
  - [ ] `GET /auth/session - transient getSession failure is recoverable by retry`
  - [ ] `GET /auth/session - 401 recovery using refresh token fallback and then retry success`
  - [ ] `GET /auth/session - token expires during polling and recovers on next request`
  - [ ] `POST /auth/google - returns 401 on token mismatch` _(je�li jeszcze nie do��czone)_

- File: `server/tests/routes/state.test.ts` (`describe: State Routes`)
- It:
  - [ ] `GET /state/bootstrap - transient buildSessionPayload failure is recoverable`
  - [ ] `GET /state/bootstrap - recovers when primary token is expired using refresh token fallback`
  - [ ] `GET /state/bootstrap - unauthorized response does not include stale payload and retries from refresh`
  - [ ] `PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`
  - [ ] `PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes`
  - [ ] `PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`

### P0-07: Usuni�cie skip�w P0 (operacyjne)

- File: `src/App.test.tsx`
  - [x] `test.skip('renders auth screen when no session')` -> aktywny `test`
- File: `server/tests/pipeline-coverage.test.ts`
  - [x] `describe.skip`/`it.skip` w blokach krytycznych -> aktywne
- File: `server/tests/audio-pipeline.unit.test.ts`
  - [x] `it.skip` w 8 scenariuszach -> aktywne `it`
- File: `src/App.integration.test.tsx`
  - [x] `describe.skip` -> aktywny
- File: `src/AuthScreen.a11y.test.tsx`
  - [x] `describe.skip` -> aktywny
- File: `src/CommandPalette.a11y.test.tsx`
  - [x] `describe.skip` -> aktywny
- [ ] finalna inspekcja `rg` pod k�tem skip�w w obszarach pozostawionych jako P1

---

## P1 � checklista implementacyjna (stabilizacja)

### P1-01: RBAC owner/admin/viewer

- File: `server/tests/routes/workspaces.test.ts` (`describe: Workspace Routes`)
  - [ ] `updates workspace member roles only for owner/admin memberships`
  - [ ] `viewer role is denied when changing roles`

### P1-02: Voice profiles

- File: `server/tests/routes/voice-profiles.test.ts`
  - `describe: PATCH /voice-profiles/:id/threshold`
    - [ ] `... requires auth`
    - [ ] `... supports transient failure recovery with client retry`
    - [ ] `viewer role no-ops for threshold update`
  - `describe: Voice Profiles Routes`
    - [ ] `DELETE /voice-profiles/:id` (powtarzalno��)
    - [ ] `Regression: issue #...` (paralelne usuni�cie)

### P1-03: External integrations fallback/retry

- File: `server/tests/routes/ai.test.ts`
  - `describe: POST /ai/person-profile`
    - [ ] `[existing happy + timeout + retry tests]`
    - [ ] `transient empty response from provider is handled as structured fallback`
  - `describe: POST /ai/suggest-tasks`
    - [ ] `[existing happy + timeout + retry tests]`
  - `describe: POST /ai/search`
    - [ ] `[existing happy + timeout + retry tests]`

### P1-04: retry-transcribe / chunk status idempotencja

- File: `server/tests/routes/media.test.ts`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - protects completed non-empty transcript from accidental retry`
  - [ ] `POST /media/recordings/:recordingId/retry-transcribe - returns same job id on repeated retries`

- File: `server/tests/routes/media.additional.test.ts`
  - [ ] `POST /media/recordings/:recordingId/audio/chunk - returns 500/invalid checksum when chunk checksum is invalid`
  - [ ] `GET /media/recordings/:recordingId/audio/chunk-status integration - parallel session isolation`

### P1-05: Dodatkowe P1 hardening

- File: `server/tests/routes/transcribe.test.ts`
  - [ ] timeout / performance edges
- File: `server/tests/routes/clientErrors.test.ts`
  - [ ] retention/limit cleanup policy
- File: `server/tests/security.test.ts`
  - [ ] admin access positive case + invalid token rejection

---

## 1) Gotowe komendy testowe (do wykonania przed przej�ciem etapu)

### Q1 (frontend critical hooks/queue)

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts
```

### Q2 (media endpoints + transcribe + finalize)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/routes/transcribe.test.ts
```

### Q3 (auth + state bootstrap/session)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Q4 (P1 RBAC/race/edge)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/workspaces.test.ts server/tests/routes/voice-profiles.test.ts server/tests/routes/ai.test.ts
```

### Q5 (P1/P2 security + a11y + e2e smoke)

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/clientErrors.test.ts server/tests/security.test.ts server/tests/transcription.test.ts src/AuthScreen.a11y.test.tsx src/CommandPalette.a11y.test.tsx src/App.integration.test.tsx
npx playwright test tests/e2e --project=chromium
```

### Q6/Q7 (release gates)

```bash
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run test:coverage:all
```

---

## 2) Kolejno�� commit�w

1. `test(frontend): p0 - audio hardware + useRecorder core retry/edge`
   - Testy: `src/hooks/useAudioHardware.test.ts`, `src/hooks/useRecorder.test.tsx`

2. `test(frontend): p0 - recorder store + processor queue hardening`
   - Testy: `src/lib/recordingQueue.test.ts`, `src/store/recorderStore.test.ts`, `src/store/recorderQueueProcessor.test.ts`

3. `test(server): p0 - media audio/chunk/finalize/transcribe + idempotence`
   - Testy: `server/tests/routes/media.test.ts`, `server/tests/routes/media.additional.test.ts`

4. `test(server): p0 - auth/session/bootstrap + workspace state retries`
   - Testy: `server/tests/routes/auth.test.ts`, `server/tests/routes/state.test.ts`

5. `test(qa): p0 - remove blockers skip coverage in app/pipeline tests`
   - Testy: `src/App.test.tsx`, `server/tests/pipeline-coverage.test.ts`, `server/tests/audio-pipeline.unit.test.ts`, `src/App.integration.test.tsx`, `src/AuthScreen.a11y.test.tsx`, `src/CommandPalette.a11y.test.tsx`

6. `test(server): p1 - rbac matrix + retry policy`
   - Testy: `server/tests/routes/workspaces.test.ts`, `server/tests/routes/voice-profiles.test.ts`, `server/tests/routes/ai.test.ts`

7. `test(qa): p1/p2 - polish + a11y/perf/smoke`
   - Testy: `server/tests/routes/clientErrors.test.ts`, `server/tests/security.test.ts`, e2e + a11y

---

## 3) Kryteria przej�cia etapu

### Po P0

- Ka�dy wpis P0 w tej li�cie: testy uruchomione i status [x] w wymaganych wymiarach:
  - HP ?, ERR ?, AUTH ?, RETRY ?, EDGE ?
- `rg -n "(describe\.skip|it\.skip|test\.skip)"` � brak trafie� w plikach P0.
- Brak przypadk�w, gdzie jedyn� asercj� jest `toBeDefined` w nowych/zmienionych testach P0.

### Po P1

- Ka�dy wpis P1 ma HP/ERR/AUTH oznaczone jako ?.
- RETRY i EDGE przechodz� na `?` -> `?` po cyklu.
- RBAC owner/admin/viewer domkni�te dla kluczowych endpoint�w.

---

## 4) Start P0 (natychmiastowe zadanie do wykonania dzi�)

### Blok P0-01 startowy

- Plik: `src/hooks/useAudioHardware.test.ts`
- Priorytet: do wdro�enia jako pierwszy blok logiczny P0.
- Edytowa� tylko `describe('useAudioHardware')`.
- Uzupe�ni� brakuj�ce asercje side-effects i potwierdzi� cleanup/recovy przy kolejnych startach.
- Po zmianie uruchomi�: `Q1` i odhaczy� P0-01.
