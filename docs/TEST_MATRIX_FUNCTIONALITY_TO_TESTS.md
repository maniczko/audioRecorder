# TEST COVERAGE MATRIX + PLAN WYKONANIA (ARCHITECTURE + API)

Data: 2026-06-04
Zrodla: ARCHITECTURE.md, docs/API.md, trasy runtime z server/routes/\*.

## 1. Wymiary i zasady jakosci

- HP happy path
- ERR sciezki bledow
- AUTH autoryzacja / RBAC
- RETRY retry/fallback (timeout, 429/5xx, przejsciowe stany)
- EDGE graniczne przypadki, race, idempotencja, degradacja
- P priorytet

Reguly jakosci:

- Dla P0 i P1 0 skipow (`describe.skip`/`it.skip`/`test.skip`).
- W nowych i modyfikowanych testach P0/P1 brak asercji, gdzie jedyna walidacja to `toBeDefined`.
- Kazdy kluczowy punkt ma min. jeden test konczacy skutkiem ubocznym (persist/status/retry marker/komunikat).
- RETRY wymaga potwierdzonego fallbacku, nie samego wywolywania retry.

## 2. Macierz frontendowa (ARCHITECTURE.md)

| Obszar                                                                                | HP   | ERR  | AUTH | RETRY | EDGE | P   |
| ------------------------------------------------------------------------------------- | ---- | ---- | ---- | ----- | ---- | --- |
| `useAudioHardware` (mikrofon, lifecycle, silence/VAD, cleanup)                        | OK   | PART | PART | NO    | PART | P0  |
| `useRecorder` (tworzenie wpisow, hydratacja, start/stop)                              | OK   | PART | OK   | PART  | PART | P0  |
| `useRecordingPipeline` + `recorderQueueProcessor` (statusy, polling, finalizacja)     | OK   | PART | OK   | PART  | PART | P0  |
| `lib/recordingQueue`, `store/recorderStore` (normalizacja, select, progress, kolejka) | OK   | PART | OK   | PART  | OK   | P0  |
| `WorkspaceContext`, `WorkspaceStore`, auth/session flows                              | OK   | PART | OK   | PART  | PART | P1  |
| Integracje zewnetrzne (Google/Microsoft auth/sync)                                    | PART | PART | OK   | PART  | PART | P1  |
| UI/UX plaszczyzny (`Topbar`, `Studio`, `Profile/People/Calendar/Notes`, a11y)         | OK   | PART | N/A  | N/A   | PART | P2  |

## 3. Macierz endpointow (docs/API.md + runtime)

| Endpoint / flow                                                    | HP   | ERR  | AUTH       | RETRY | EDGE | P   |
| ------------------------------------------------------------------ | ---- | ---- | ---------- | ----- | ---- | --- |
| `POST /ai/person-profile`                                          | OK   | OK   | OK         | PART  | PART | P2  |
| `POST /ai/suggest-tasks`                                           | OK   | OK   | OK         | PART  | PART | P2  |
| `POST /ai/search`                                                  | OK   | OK   | OK         | PART  | PART | P2  |
| `POST /auth/register`                                              | OK   | OK   | OK         | PART  | PART | P0  |
| `POST /auth/login`                                                 | OK   | OK   | OK         | PART  | PART | P0  |
| `POST /auth/google`                                                | OK   | OK   | OK         | PART  | PART | P0  |
| `POST /auth/password/reset/request`                                | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /auth/password/reset/confirm`                                | OK   | OK   | OK         | PART  | PART | P1  |
| `GET /auth/session`                                                | OK   | OK   | OK         | PART  | PART | P0  |
| `GET /digest/daily`                                                | OK   | PART | OK         | PART  | PART | P2  |
| `GET /media/recordings`                                            | OK   | OK   | OK         | PART  | PART | P2  |
| `GET /media/recordings/{recordingId}/audio`                        | OK   | OK   | OK         | PART  | PART | P0  |
| `PUT /media/recordings/{recordingId}/audio`                        | OK   | OK   | OK         | PART  | PART | P0  |
| `PUT /media/recordings/{recordingId}/audio/chunk`                  | OK   | OK   | OK         | PART  | PART | P0  |
| `POST /media/recordings/{recordingId}/audio/chunk-status`          | OK   | OK   | OK         | PART  | OK   | P1  |
| `POST /media/recordings/{recordingId}/audio/finalize`              | OK   | OK   | OK         | PART  | PART | P0  |
| `POST /media/recordings/{recordingId}/transcribe`                  | OK   | PART | OK         | PART  | PART | P0  |
| `GET /media/recordings/{recordingId}/transcribe`                   | PART | PART | OK         | PART  | PART | P0  |
| `POST /media/recordings/{recordingId}/retry-transcribe`            | OK   | OK   | OK         | OK    | PART | P0  |
| `POST /media/recordings/{recordingId}/normalize`                   | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/recordings/{recordingId}/voice-coaching`              | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/recordings/{recordingId}/acoustic-features`           | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/recordings/{recordingId}/rediarize`                   | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/recordings/{recordingId}/voice-profiles/from-speaker` | OK   | OK   | OK         | PART  | OK   | P1  |
| `POST /media/recordings/{recordingId}/sketchnote`                  | OK   | PART | OK         | PART  | PART | P2  |
| `POST /media/analyze`                                              | PART | PART | OK         | PART  | PART | P2  |
| `DELETE /media/recordings/{recordingId}`                           | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/disk-space/status`                                    | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /media/disk-space/cleanup`                                   | OK   | OK   | OK (admin) | PART  | PART | P1  |
| `POST /state/workspaces/{workspaceId}`                             | OK   | OK   | OK         | PART  | PART | P0  |
| `PATCH /state/workspaces/{workspaceId}`                            | OK   | OK   | OK         | PART  | PART | P0  |
| `GET /state/bootstrap`                                             | OK   | OK   | OK         | PART  | PART | P0  |
| `PUT /users/{userId}/profile`                                      | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /users/{userId}/password`                                    | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /workspaces/{workspaceId}/members/{targetUserId}/role`       | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /workspaces/{workspaceId}/rag/ask`                           | OK   | OK   | OK         | PART  | PART | P1  |
| `GET /voice-profiles`                                              | OK   | OK   | OK         | PART  | PART | P1  |
| `POST /voice-profiles`                                             | OK   | OK   | OK         | PART  | PART | P1  |
| `PATCH /voice-profiles/{id}/threshold`                             | NO   | NO   | OK         | NO    | NO   | P1  |
| `DELETE /voice-profiles/{id}`                                      | OK   | OK   | OK         | PART  | OK   | P1  |
| `GET /transcribe/live`                                             | OK   | OK   | OK         | PART  | PART | P1  |
| `GET /api/client-errors`                                           | OK   | OK   | OK         | OK    | PART | P2  |
| `POST /api/client-errors`                                          | OK   | OK   | OK         | OK    | PART | P2  |
| `DELETE /api/client-errors`                                        | OK   | OK   | OK         | OK    | PART | P2  |
| `/metrics`, `/api/admin/metrics`, `/api/admin/heapdump`            | PART | OK   | OK         | PART  | PART | P2  |

Uwaga: docs/API.md nie obejmuje pelnego zestawu endpointow (m.in. auth register/login/reset), ale plan obejmuje te sciezki jako wymagania projektu.

## 4. Kryteria akceptacyjne

### Egzekwowalny gate CI

Krytyczne sciezki audio i przetwarzania maja maszynowo czytelny kontrakt w
`docs/critical-path-coverage.matrix.json`. CI uruchamia go przez
`pnpm run audit:repo-hygiene`, czyli w istniejacym jobie GitHub Actions
`Quality Gates`.

Validator `scripts/validate-critical-path-coverage.mjs` blokuje PR, gdy:

- krytyczny obszar nie ma wlasciciela, priorytetu albo minimalnej liczby wymiarow pokrycia,
- wymagany plik testowy z matrixa nie istnieje,
- wymagany plik testowy zawiera `describe.skip`, `it.skip` albo `test.skip`.

Testy validatora sa w `scripts/validate-critical-path-coverage.test.ts`.

### P0 (blokery)

- HP = OK
- ERR = OK
- AUTH = OK
- RETRY = OK
- EDGE = OK
- 0 skipow testow w obszarach P0
- 0 skipow testow w obszarach P1
- brak nowych/zmienianych asercji typu wyłącznie `toBeDefined`
- min. 1 test end-to-end ze skutkiem ubocznym dla kazdego wpisu krytycznego

### P1

- HP = OK
- ERR = OK
- AUTH = OK
- RETRY = PART -> docelowo OK
- EDGE = PART -> docelowo OK

### P2

- docelowo wszystkie kolumny na OK
- aktywne a11y + perf + load + snapshots dla krytycznych ekranow

## 5. Plan realizacji 3 tygodnie

### Tydzien 1 — P0

- Dokonac `useAudioHardware`, `useRecorder`, `recorderQueueProcessor` i retry/edge dla queue.
- Domknac krytyczne endpointy `audio` oraz `transcribe` i retry bootstrap: `POST /media/recordings/{recordingId}/audio`, `POST /media/recordings/{recordingId}/audio/chunk`, `POST /media/recordings/{recordingId}/audio/finalize`, `POST /media/recordings/{recordingId}/transcribe`, `GET /media/recordings/{recordingId}/transcribe`, `POST /media/recordings/{recordingId}/retry-transcribe`, `GET /auth/session`, `GET /state/bootstrap`, `POST /state/workspaces/{workspaceId}`, `PATCH /state/workspaces/{workspaceId}`.
- Usunac/odblokowac krytyczne skipy.

### Tydzien 2 — P1

- Wdrozyc pelna macierz RBAC owner/admin/viewer dla `POST /workspaces/{workspaceId}/members/{targetUserId}/role`, `GET /voice-profiles`, `POST /voice-profiles`, `DELETE /voice-profiles/{id}`.
- Dodac testy retry/edge i idempotencji dla `POST /media/recordings/{recordingId}/audio/chunk-status`, `POST /media/recordings/{recordingId}/retry-transcribe`, `DELETE /voice-profiles/{id}`.
- Ujednolicić asercje semantyczne dla nowych testów.

### Tydzien 3 — P2

- Aktywowac testy a11y i paneli (`AuthScreen`, `CommandPalette`, People/Profile/Notes/Calendar/Studio).
- Dodac E2E scenariusze uzytkownika, statusow i bledow paneli.
- Dodatkowo perf/load/snapshot smoke dla sciezek krytycznych UI i transkrypcji.

## 6. Priorytet P0/P1 (backlog zadaniowy)

- P0-01: `PATCH /voice-profiles/{id}/threshold` — pelne pokrycie i idempotencja.
- P0-02: dociagnac retry/timeout dla `useAudioHardware`, `useRecorder`, `recorderStore`, `recorderQueueProcessor`.
- P0-03: idempotentnosc i integrity flow dla `audio`, `chunk`, `finalize`, `transcribe`, `retry-transcribe`.
- P0-04: `GET /auth/session` + `GET /state/bootstrap` — scenariusze utraty, odnowy i ponownego bootstrapu sesji.
- P0-05: usunac wszystkie skipi dla sciezek P0 i P1.
- P1-01: RBAC dla workspace + media + retry-transcribe + chunk-status.
- P1-02: fallback/timeout dla Google/Microsoft/AI providerow.
- P2-01: a11y + perf/load + snapshots + statusy paneli.

## 7. Główne komendy gates

- `pnpm run test:server:retry`
- `pnpm run test:frontend:ci`
- `pnpm run test:coverage:all`
- `rg -n "(describe\.skip|it\.skip|test\.skip)" src server/tests`
- `rg -n "toBeDefined\(" src server/tests`
- `npx vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/routes/transcribe.test.ts`
- `npx vitest run src/hooks/useAudioHardware.test.ts src/hooks/useRecorder.test.tsx src/lib/recordingQueue.test.ts src/store/recorderStore.test.ts src/store/recorderQueueProcessor.test.ts`
