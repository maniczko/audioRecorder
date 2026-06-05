# TASK PLAN: P0/P1/P2 execution (implementacyjne)

Date: 2026-06-04

Legend:

- [ ] todo
- [x] done
- [~] in progress

## Statusy wykonania P0 (start)

- [x] P0-15: `src/App.test.tsx` � `test.skip('renders auth screen when no session')` odblokowany.
- [x] P0-15: `server/tests/pipeline-coverage.test.ts` � 3 `test.skip` zamienione na `test`.
- [x] P0-15: `server/tests/audio-pipeline.unit.test.ts` � 8 `it.skip` zamienione na `it` (zachowane semantyczne asercje).
- [x] P0-15: `src/App.integration.test.tsx` � `describe.skip` odblokowany, testy P2/P0 coverage rozszerzone.
- [x] P0-15: `src/AuthScreen.a11y.test.tsx` i `src/CommandPalette.a11y.test.tsx` � aktywne `describe`, poprawione asercje.
- [ ] P0-15: pozosta�e `skipy` P0/P1 czekaj� na dalsze odblokowanie (integracja UI/API).

## P0 - blockers (zamkniecie przed dalszymi etapami)

| ID    | Cel                                                                         | Plik                                                                                                                                                                                                         | describe                                             | it (istniejace / do dodania)                                                                                                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P0-01 | useAudioHardware � pe�na �ciezka deny + recover + cleanup                   | `src/hooks/useAudioHardware.test.ts`                                                                                                                                                                         | `useAudioHardware`                                   | `shows error message when microphone permission is denied`; `startRecording times out and marks setup as recoverable retry state`; `temporary setup failure is recoverable and retry succeeds`; **doda�** `marks permission state as recoverable after NotAllowedError and retries with constraints` |
| P0-02 | useAudioHardware � deterministyczny fallback po cleanupRecorder             | `src/hooks/useAudioHardware.test.ts`                                                                                                                                                                         | `useAudioHardware`                                   | **doda�** `does not leak tracks on multiple start/stop retries`                                                                                                                                                                                                                                      |
| P0-03 | useRecorder � brak blobu i quota failure                                    | `src/hooks/useRecorder.test.tsx`                                                                                                                                                                             | `useRecorder`                                        | `queues recording fails if blob is missing and can be retried by user flow`; `queueRecording sets error status when saveAudioBlob throws`; `blocks remote recording when workspace context is missing`; **doda�** `quota exceeded error keeps recording queued as retryable`                         |
| P0-04 | useRecorder � retry po b��dzie uploadu i timeout                            | `src/hooks/useRecorder.test.tsx`                                                                                                                                                                             | `useRecorder`                                        | `Regression: clears recordingMeetingId when hardware start fails`; `queueRecording removes partial artifacts and keeps queue unchanged on storage failures`; **doda�** `transitions blob upload error into recoverable queue state`                                                                  |
| P0-05 | recorderStore + recordingQueue � retry metadata i deterministyczny ordering | `src/store/recorderStore.test.ts`, `src/lib/recordingQueue.test.ts`                                                                                                                                          | `recorderStore`, `recordingQueue helpers`            | `queues stored recording for retry without reupload`; `retryStoredRecording returns null for missing meeting or recording`; `does not consider remote queue item processable without workspace context`; `keeps queue snapshot recoverable instead of fuzzy match`                                   |
| P0-06 | recorderQueueProcessor � statusy i requeue                                  | `src/store/recorderQueueProcessor.test.ts`                                                                                                                                                                   | `processRecordingQueueItem`                          | `requeues transient upload failures with backoff metadata`; `preserves item after fetch abort and retries once with backoff`; `marks stale uploaded remote recordings as permanent without retrying STT`                                                                                             |
| P0-07 | media/recordings/{id}/audio/chunk � ENOSPC, duplicate i corrupt             | `server/tests/routes/media.additional.test.ts`                                                                                                                                                               | `PUT /media/recordings/:recordingId/audio/chunk`     | ? `returns 507 and keeps retryability when disk is full during chunk upload`; ? `returns 200 and keeps nextIndex stable when duplicate chunk index is retried`; ? `returns 500 when chunk checksum is invalid`                                                                                       |
| P0-08 | media/recordings/{id}/audio/finalize � idempotencja                         | `server/tests/routes/media.additional.test.ts`                                                                                                                                                               | `POST /media/recordings/:recordingId/audio/finalize` | ? `returns 200, creates asset, and cleans up chunk files when all chunks are present`; ? `returns 200 when finalize is called again and asset already exists`                                                                                                                                        |
| P0-09 | media/recordings/{id}/audio � integrity i race                              | `server/tests/routes/media.test.ts`                                                                                                                                                                          | `Media Routes`                                       | `GET /media/recordings/:recordingId/audio - returns 404 for missing assets and files`; `GET /media/recordings/:recordingId/audio - falls back to reconstructed Supabase key`; **doda�** `serves reconstructed key when source asset moved atomically`                                                |
| P0-10 | media/recordings/{id}/transcribe i GET transcribe                           | `server/tests/routes/media.test.ts`                                                                                                                                                                          | `Media Routes`                                       | `POST /media/recordings/:recordingId/transcribe - queues job`; `POST /media/recordings/:recordingId/transcribe - returns retry-friendly transient error then succeeds after retry`; `GET /media/recordings/:recordingId/transcribe - returns payload`                                                | doda� race polling i puste transkrypcje deterministyczne                          |
| P0-11 | POST /media/recordings/{id}/retry-transcribe idempotent retry               | `server/tests/routes/media.test.ts`                                                                                                                                                                          | `Media Routes`                                       | `POST /media/recordings/:recordingId/retry-transcribe - requeues failed recording without reupload`; `POST /media/recordings/:recordingId/retry-transcribe - allows retry for completed empty transcript`                                                                                            | **doda�** `does not duplicate transcribe job when previous retry request repeats` |
| P0-12 | POST /auth/session + fallback refresh                                       | `server/tests/routes/auth.test.ts`                                                                                                                                                                           | `Auth Routes`                                        | `GET /auth/session - transient getSession failure is recoverable by retry`; `GET /auth/session - 401 recovery using refresh token fallback and then retry success`; `GET /auth/session - unknown session errors are surfaced`                                                                        | doda� utrat� tokenu w �rodku pollingowego odtwarzania                             |
| P0-13 | state/bootstrap � bootstrap retry + refresh                                 | `server/tests/routes/state.test.ts`                                                                                                                                                                          | `State Routes`                                       | `GET /state/bootstrap - transient buildSessionPayload failure is recoverable`; `GET /state/bootstrap - recovers when primary token is expired using refresh token fallback`                                                                                                                          | **doda�** `401 -> token refresh -> retry same payload`                            |
| P0-14 | state/workspaces/{id} i PATCH kolizje/locki                                 | `server/tests/routes/state.test.ts`                                                                                                                                                                          | `State Routes`                                       | `PUT /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`; `PATCH /state/workspaces/:workspaceId - serializes concurrent deltas without losing writes`; `PATCH /state/workspaces/:workspaceId - allows retry after optimistic lock without data loss`              | doda� regresj� kolizji r�wnoleg�ych rollback�w                                    |
| P0-15 | Usu� skipi P0 krytyczne                                                     | `src/App.test.tsx`, `src/App.integration.test.tsx`, `server/tests/audio-pipeline.unit.test.ts`, `server/tests/pipeline-coverage.test.ts`, `src/AuthScreen.a11y.test.tsx`, `src/CommandPalette.a11y.test.tsx` | opisane w plikach                                    | `test.skip('renders auth screen when no session')`, `describe.skip('App integration')`, `describe.skip('CommandPalette � Accessibility')`                                                                                                                                                            | odblokowa� lub przenie�� jako aktywne testy e2e/critical paths                    |

## P1 - stabilizacja

| ID    | Cel                                                      | Plik                                                                  | describe                                                                               | it (istniejace / do dodania)                                                                                                                                                |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| P1-01 | Matrix owner/admin/viewer dla cz�onkostw workspace       | `server/tests/routes/workspaces.test.ts`                              | `Workspace Routes`                                                                     | `updates workspace member roles only for owner/admin memberships`; **doda�** `blocks viewer from changing role`                                                             |
| P1-02 | RBAC media endpoint�w i PATCH threshold                  | `server/tests/routes/voice-profiles.test.ts`                          | `PATCH /voice-profiles/:id/threshold`                                                  | istniej�ce `... requires auth`; `... supports transient failure recovery with client retry`                                                                                 | doda� negatyw dla viewer na endpointach mutuj�cych media                         |
| P1-03 | Retry/edge endpoint�w zewn�trznych AI                    | `server/tests/routes/ai.test.ts`, `server/tests/routes/media.test.ts` | `POST /ai/person-profile`, `POST /ai/suggest-tasks`, `POST /ai/search`, `Media Routes` | istniejace happy + mapowanie 429; **doda�** `transient provider returns empty body`                                                                                         |
| P1-04 | Timeout/fallback auth/google                             | `server/tests/routes/auth.test.ts`                                    | `Auth Routes`                                                                          | done in this pass: `POST /auth/google - returns 401 on token mismatch`                                                                                                      |
| P1-05 | chunk-status multi-session                               | `server/tests/routes/media.additional.test.ts`                        | `GET /media/recordings/:recordingId/audio/chunk-status integration`                    | `returns isolated status with correct nextIndex...`; **doda�** test r�wnoleg�ych sesji i reupload                                                                           |
| P1-06 | retry-transcribe deterministyczny przy wielu wywo�aniach | `server/tests/routes/media.test.ts`                                   | `Media Routes`                                                                         | `POST /media/recordings/:recordingId/retry-transcribe - protects completed non-empty transcript from accidental retry`; **doda�** `returns same job id on repeated retries` |
| P1-07 | Voice profiles + delete idempotencji                     | `server/tests/routes/voice-profiles.test.ts`                          | `Voice Profiles Routes`, `PATCH /voice-profiles/:id/threshold`                         | `supports repeated identical updates (idempotency edge)`; `DELETE /voice-profiles/:id`                                                                                      | dopisa� test r�wnoleg�ego usuwania                                               |
| P1-08 | state/workspaces + state/bootstrap + ACL                 | `server/tests/routes/state.test.ts`                                   | `State Routes`                                                                         | istniej�ce retry/rollback tests                                                                                                                                             | doda� `Auth forbidden path` dla viewer na media/workspace                        |
| P1-09 | A11y i UX komponent�w                                    | `src/AuthScreen.a11y.test.tsx`, `src/CommandPalette.a11y.test.tsx`    | `AuthScreen � Accessibility`, `CommandPalette � Accessibility`                         | aktywne `it(...)` scenariusze                                                                                                                                               | odblokowa� `describe` i doda� minimum 1 przypadek focus-visible + keyboard order |
| P1-10 | /api/client-errors retention/policy                      | `server/tests/routes/clientErrors.test.ts`                            | `clientErrors route`                                                                   | istniej�ce CRUD tests                                                                                                                                                       | doda� limit przechowania + oczyszczanie po limicie                               |

## P2 - jako�ci i UX

| ID    | Cel                                            | Plik                                                                                          | describe                        | it (istniejace / do dodania)                                                                                                             |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| P2-01 | People/Profile/Notes flow e2e + statusy paneli | `src/App.integration.test.tsx`                                                                | `App integration`               | `navigates to People tab and checks psych profile trigger`; `adds a manual task from the tasks tab`; **doda�** `status panel assertions` |
| P2-02 | Visual/a11y baseline + touch targets           | `src/AuthScreen.a11y.test.tsx`, `src/CommandPalette.a11y.test.tsx`                            | aktywowane `describe`           | istniej�ce scenariusze + dodatkowe asercje 44x44 i focus-visible                                                                         |
| P2-03 | Perf smoke                                     | `server/tests/performance/response-time-sla.test.ts` oraz `server/tests/routes/media.test.ts` | opisane testy                   | istniej�ce + doda� smoke dla finalize/transcribe                                                                                         |
| P2-04 | Load smoke transcribe/live                     | `server/tests/routes/transcribe.test.ts` + `src/App.integration.test.tsx`                     | `Transcribe Routes`             | obecne podstawowe happy + scenariusz przeci��eniowy                                                                                      |
| P2-05 | Snapshot i statusy paneli UI                   | e2e + visual                                                                                  | `App integration`               | `shows a notification center items and requests browser notification permission`; doda� snapshot Topbar/Studio                           |
| P2-06 | Ops + security dla endpoint�w metryk           | `server/tests/security.test.ts`                                                               | `API Security Regression Tests` | `[H-05] admin and metrics endpoints reject anonymous requests`                                                                           | doda� pozytywny access path z poprawnym tokenem |

## Plan komend + kolejno�� commit�w

### Commit 0 � szybki P0 skip cleanup (audio pipeline coverage)

```bash
npx vitest run server/tests/pipeline-coverage.test.ts
```

### Commit 0b � szybki P0 skip cleanup (audioPipeline unit)

```bash
npx vitest run server/tests/audio-pipeline.unit.test.ts
```

### Commit 1 � blokery P0 bezpiecze�stwo queue/audio

```bash
npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx
npx vitest run src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts src/lib/recordingQueue.test.ts
```

### Commit 2 � P0 API media pipeline bootstrap

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/routes/transcribe.test.ts
npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts
```

### Commit 3 � zamkniecie skipow P0/P1 i RBAC

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/workspaces.test.ts server/tests/routes/voice-profiles.test.ts
npx vitest run src/AuthScreen.a11y.test.tsx src/CommandPalette.a11y.test.tsx src/App.test.tsx src/App.integration.test.tsx
```

### Commit 4 � P1/P2 hardening i smoke

```bash
npx vitest run -c server/vitest.config.ts server/tests/routes/ai.test.ts server/tests/routes/clientErrors.test.ts
npx vitest run server/tests/transcription.test.ts server/tests/security.test.ts
npx playwright test tests/e2e --project=chromium
```

## Status post�pu (start P0)

- [x] P0-15: `src/App.test.tsx` � odblokowany (`test.skip` -> `test`)
- [x] P0-15: `server/tests/pipeline-coverage.test.ts` � odblokowane 3 `skip`-testy
- [x] P0-15: `server/tests/audio-pipeline.unit.test.ts` � odblokowane 8 `it.skip`
- [ ] P0-15: pozosta�e skippy wymagaj� dalszej odblokowania (UI/API edge).
- [ ] P0-01..P0-14 � do realizacji (blokery funkcjonalne: retry/edge/auth bootstrap + media pipeline)
