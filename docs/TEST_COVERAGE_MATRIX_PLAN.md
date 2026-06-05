# Test Coverage Matrix + Plan: ARCHITECTURE + docs/API

Data: 2026-06-04
Źródła: `ARCHITECTURE.md`, `docs/API.md`
Status audytu: P0/P1 skipi i testy krytyczne — częściowo domknięte (UI/API skippy już odblokowane; retry/edge endpointowe pozostałe aktywne).

Legenda statusów:

- `✅` — pełne pokrycie
- `⚠️` — częściowe pokrycie, wymagane uzupełnienie
- `❌` — brak pokrycia
- `N/A` — nie dotyczy

## 1) Macierz frontendowa (ARCHITECTURE.md)

| Obszar                                                                                | HP  | ERR | AUTH | RT  | EDGE | P   | Uwagi / luka                                                                               |
| ------------------------------------------------------------------------------------- | --- | --- | ---- | --- | ---- | --- | ------------------------------------------------------------------------------------------ |
| `useAudioHardware` (mikrofon, lifecycle, cleanup, silence/VAD)                        | ✅  | ⚠️  | ⚠️   | ❌  | ⚠️   | P0  | dodać scenariusze permission denied, timeout, auto-stop i recovery przy błędzie urządzenia |
| `useRecorder` (tworzenie wpisów, hydratacja, start/stop)                              | ✅  | ⚠️  | ✅   | ⚠️  | ⚠️   | P0  | brak scenariuszy nieudanych blobów, quota/storage error i retry zapisu                     |
| `useRecordingPipeline` + `recorderQueueProcessor` (statusy, polling, finalizacja)     | ✅  | ⚠️  | ✅   | ⚠️  | ⚠️   | P0  | końcowe przejścia statusów, finalizacja, idempotencja, stale-state                         |
| `lib/recordingQueue`, `store/recorderStore` (normalizacja, select, progress, kolejka) | ✅  | ⚠️  | ✅   | ⚠️  | ✅   | P0  | retry/backoff oraz edge dla transient errors                                               |
| `WorkspaceContext`, `WorkspaceStore`, auth/session flows                              | ✅  | ⚠️  | ✅   | ⚠️  | ⚠️   | P1  | bootstrap, przełączanie workspace, 401 recovery                                            |
| Integracje zewnętrzne (Google/Microsoft auth/sync)                                    | ⚠️  | ⚠️  | ✅   | ⚠️  | ⚠️   | P1  | scenariusze konfliktów, timeout i fallback                                                 |
| UI/UX płaszczyzny (`Topbar`, `Studio`, Profile/People/Calendar/Notes, a11y)           | ✅  | ⚠️  | N/A  | N/A | ⚠️   | P2  | aktywować a11y i dokończyć statusy paneli                                                  |

## 2) Macierz endpointów (docs/API.md)

| Endpoint / flow                                                    | HP  | ERR | AUTH       | RT  | EDGE | P   | Uwagi / luka                                                                   |
| ------------------------------------------------------------------ | --- | --- | ---------- | --- | ---- | --- | ------------------------------------------------------------------------------ |
| `POST /ai/person-profile`                                          | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P2  | provider timeout i obciążenie                                                  |
| `POST /ai/suggest-tasks`                                           | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P2  | chaos/network scenariusze                                                      |
| `POST /ai/search`                                                  | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P2  | degradacja odpowiedzi                                                          |
| `POST /auth/register`                                              | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | retry + limity payload/WS rate                                                 |
| `POST /auth/login`                                                 | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | retry po timeoutie i odtwarzanie sesji                                         |
| `POST /auth/google`                                                | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | token mismatch / SSO edge                                                      |
| `POST /auth/password/reset/request`                                | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | brute-force + rate limit                                                       |
| `POST /auth/password/reset/confirm`                                | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | lockout i walidacja pary token+kod                                             |
| `GET /auth/session`                                                | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | refresh + 401 recovery                                                         |
| `GET /digest/daily`                                                | ✅  | ⚠️  | ✅         | ⚠️  | ⚠️   | P2  | awarie mailer/db fallback                                                      |
| `GET /media/recordings/{recordingId}/audio`                        | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | race i integralność pliku                                                      |
| `PUT /media/recordings/{recordingId}/audio`                        | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | limity, retry/backoff                                                          |
| `PUT /media/recordings/{recordingId}/audio/chunk`                  | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | ENOSPC, korupcja, retry upload                                                 |
| `POST /media/recordings/{recordingId}/audio/chunk-status`          | ✅  | ✅  | ✅         | ⚠️  | ✅   | P1  | wielosesyjne wyścigi                                                           |
| `POST /media/recordings/{recordingId}/audio/finalize`              | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | idempotencja + cleanup failures                                                |
| `POST /media/recordings/{recordingId}/transcribe`                  | ✅  | ⚠️  | ✅         | ⚠️  | ⚠️   | P0  | status/progress pipeline i blokady zasobów                                     |
| `GET /media/recordings/{recordingId}/transcribe`                   | ⚠️  | ⚠️  | ✅         | ⚠️  | ⚠️   | P0  | pusta transkrypcja i race                                                      |
| `POST /media/recordings/{recordingId}/retry-transcribe`            | ✅  | ✅  | ✅         | ✅  | ⚠️   | P0  | wielokrotny retry + idempotencja                                               |
| `POST /media/recordings/{recordingId}/normalize`                   | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | timeout + uszkodzone segmenty                                                  |
| `POST /media/recordings/{recordingId}/voice-coaching`              | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | fallback modelu, puste wejścia                                                 |
| `POST /media/recordings/{recordingId}/acoustic-features`           | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | timeout i brak danych wejściowych                                              |
| `POST /media/recordings/{recordingId}/rediarize`                   | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | brak speakerów / dane częściowe                                                |
| `POST /media/recordings/{recordingId}/voice-profiles/from-speaker` | ✅  | ✅  | ✅         | ⚠️  | ✅   | P1  | konflikty nazw speakerów                                                       |
| `POST /media/recordings/{recordingId}/sketchnote`                  | ✅  | ⚠️  | ✅         | ⚠️  | ⚠️   | P2  | brak klucza / błąd providera                                                   |
| `POST /media/analyze`                                              | ⚠️  | ⚠️  | ✅         | ⚠️  | ⚠️   | P2  | stabilne scenariusze mock/API                                                  |
| `DELETE /media/recordings/{recordingId}`                           | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | konflikt uprawnień / stan przetwarzania                                        |
| `POST /media/disk-space/status`                                    | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | symulacja niskiego miejsca                                                     |
| `POST /media/disk-space/cleanup`                                   | ✅  | ✅  | ✅ (admin) | ⚠️  | ⚠️   | P1  | tylko poprawny flow admin                                                      |
| `POST /state/workspaces/{workspaceId}`                             | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | rollback przy równoległych zapisach                                            |
| `PATCH /state/workspaces/{workspaceId}`                            | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P0  | merge lock i konflikt zapytań                                                  |
| `GET /state/bootstrap`                                             | ✅  | ✅  | ✅         | ⚠️  | ✅   | P0  | 401 recovery po refresh token                                                  |
| `PUT /users/{userId}/profile`                                      | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | walidacja pól i wersjonowanie                                                  |
| `POST /users/{userId}/password`                                    | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | lockout i polityka sesji                                                       |
| `POST /workspaces/{workspaceId}/members/{targetUserId}/role`       | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | pełna macierz owner/admin/viewer                                               |
| `POST /workspaces/{workspaceId}/rag/ask`                           | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | fallback i inputy puste/noisy                                                  |
| `GET /voice-profiles`                                              | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | cache + ordering                                                               |
| `POST /voice-profiles`                                             | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | walidacja formatu i limitów audio                                              |
| `PATCH /voice-profiles/{id}/threshold`                             | ✅  | ✅  | ✅         | ✅  | ✅   | P1  | coverage is implemented; remaining gap: multi-actor race/idempotence hardening |
| `DELETE /voice-profiles/{id}`                                      | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | równoległe usuwanie i idempotencja                                             |
| `GET /transcribe/live`                                             | ✅  | ✅  | ✅         | ⚠️  | ⚠️   | P1  | timeout/perf under load                                                        |
| `/api/client-errors` (GET/POST/DELETE)                             | ✅  | ✅  | ✅         | ✅  | ⚠️   | P2  | retention i limity                                                             |
| `/metrics`, `/api/admin/metrics`, `/api/admin/heapdump`            | ⚠️  | ✅  | ✅ (token) | ⚠️  | ⚠️   | P2  | admin happy path + odrzucenie złych tokenów                                    |

## 3) Kryteria akceptacyjne i reguły jakości

### Kryteria końcowe

- P0: `HP=✅`, `ERR=✅`, `AUTH=✅`, `RT=✅`, `EDGE=✅`.
- P1: min. `HP=✅`, `ERR=✅`, `AUTH=✅`; `RT` i `EDGE` najpierw `⚠️`, docelowo `✅`.
- P2: docelowo wszystkie kolumny `✅`.

### Reguły jakości

- `0` skipów (`test.skip`, `it.skip`, `describe.skip`) w plikach przypisanych do P0/P1.
- W nowych/zmienianych testach P0/P1 brak `toBeDefined` jako jedynej asercji.
- Każdy kluczowy punkt ma min. 1 test integracyjny z efektem ubocznym (zmiana stanu / persist / retry marker / komunikat).
- `retry` oznacza błąd przejściowy + potwierdzony fallback.

### Komendy jakości

- `pnpm run test:server:retry`
- `pnpm run test:frontend:ci`
- `pnpm run test:coverage:all`
- `rg -n "(describe\.skip|it\.skip|test\.skip)" src server/tests`
- `rg -n "toBeDefined\(" src server/tests`
- `pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/state.test.ts server/tests/routes/media.test.ts server/tests/routes/media.additional.test.ts server/tests/routes/transcribe.test.ts`

### Mierniki zamknięcia etapu

- Po etapie P0 (docelowo):
  - każdy wpis P0 musi mieć `HP=✅`, `ERR=✅`, `AUTH=✅`, `RT=✅`, `EDGE=✅`.
  - `rg` na repo nie wykrywa żadnych `test.skip`, `describe.skip`, `it.skip` w plikach P0/P1.
  - nowe/zmieniane testy P0/P1 muszą mieć asercje semantyczne (`toEqual`, `toHaveBeenCalledWith`, `toMatchObject`, `toMatch`), nie tylko `toBeDefined`.

## 4) Plan prac 3 tygodnie

### Tydzień 1 — P0

1. Audio stack:
   - `src/hooks/useAudioHardware.test.ts`
   - `src/hooks/useRecorder.test.tsx`
   - `src/lib/recordingQueue.test.ts`
   - `src/store/recorderStore.test.ts`
   - `src/store/recorderQueueProcessor.test.ts`
   - `src/hooks/useRecordingPipeline.test.ts`
   - `src/hooks/useRecordingPipeline.test.tsx`
2. Media krytyczne:
   - `server/tests/routes/media.test.ts`
   - `server/tests/routes/media.additional.test.ts`
   - `server/tests/routes/transcribe.test.ts`
3. Auth/session/bootstrap:
   - `server/tests/routes/auth.test.ts`
   - `server/tests/routes/state.test.ts`
4. Usunąć skiplisy P0:
   - `src/App.test.tsx`
   - `src/App.integration.test.tsx`
   - `src/hooks/useMeetings.test.tsx`
   - `server/tests/audio-pipeline.unit.test.ts`
   - `server/tests/pipeline-coverage.test.ts`
   - `src/AuthScreen.a11y.test.tsx`
   - `src/CommandPalette.a11y.test.tsx`

### Tydzień 2 — P1

1. RBAC owner/admin/viewer:
   - `server/tests/routes/workspaces.test.ts`
   - `server/tests/routes/media.test.ts`
   - `server/tests/routes/voice-profiles.test.ts`
2. Integracje zewnętrzne + fallback:
   - `server/tests/routes/ai.test.ts`
   - `server/tests/routes/auth.test.ts`
   - `server/tests/routes/media.test.ts`
3. Idempotencja i edge:
   - `server/tests/routes/transcribe.test.ts`
   - `server/tests/routes/voice-profiles.test.ts`
4. Assercje semantyczne:
   - zastąpienie „słabych” asercji na `toEqual`, `toHaveBeenCalledWith`, `toMatchObject`

### Tydzień 3 — P2

1. UX/A11y i panele:
   - `src/AuthScreen.a11y.test.tsx`
   - `src/CommandPalette.a11y.test.tsx`
   - `src/ProfileTab.test.tsx`
   - `src/People*`
   - `src/Notes*`
   - `src/Calendar*`
2. E2E statusy i recovery:
   - `src/App.integration.test.tsx`
   - People/Profile/Notes flow
3. Perf/load smoke:
   - `server/tests/performance/response-time-sla.test.ts`
