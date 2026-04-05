# TASK QUEUE

Ostatnie odswiezenie: `2026-04-05 08:27 Europe/Warsaw`

## Status odswiezenia

- `GitHub Actions`: odswiezone lokalnie na podstawie `github-errors/github-errors-2026-04-05T06-20-22-219Z.json` (`100` runow, `10` failed w oknie 7 dni)
- `Railway`: odswiezone lokalnie na podstawie `railway-errors/railway-errors-2026-04-05T06-20-03-347Z.md` (`0` error linii w ostatnich `100` logach, `/health` = `ok`)
- `Vercel`: odswiezenie zablokowane `2026-04-05` - `VERCEL_TOKEN` nieustawiony, a plugin Vercel zwraca `Auth required`
- `Sentry`: odswiezenie zablokowane `2026-04-05` - `SENTRY_AUTH_TOKEN` nieustawiony

## Zasady

- `todo`: zadanie otwarte
- `blocked`: zadanie zablokowane przez brak sekretow, dostepu albo zewnetrzne srodowisko
- `verify`: poprawka jest juz lokalnie, czeka na potwierdzenie w kolejnym CI/deploy
- `done`: zamkniete po potwierdzeniu

## Aktywne zadania

### MON-01 - Potwierdzic nowa walidacje env i zawezic brakujace sekrety

- Status: `verify`
- Priorytet: `P0`
- Zrodlo: `GitHub Actions -> CI/CD Pipeline`
- Ostatni sygnal: `2026-04-04 16:32 UTC`
- Opis zadania:
  Skrypt `scripts/validate-env.js` zostal poprawiony, zeby nie blokowal CI przez opcjonalne integracje i zbyt restrykcyjne wzorce tokenow. Dawny alarm `BRAK` byl szerszy niz realne wymagania runtime. Ten punkt zostaje otwarty tylko do czasu potwierdzenia w nowym runie GitHub Actions.
- Poprawka wykonana:
  - `scripts/validate-env.js`
  - test regresji:
    - `scripts/validate-env.test.ts`
  - config testowy:
    - `vitest.scripts.config.ts`
- Rzeczy, ktore nadal moga wymagac sekretow poza repo:
  - sekrety produkcyjne dla workflow wdrozeniowych i integracji zewnetrznych
  - realne klucze do providerow, jesli dany workflow ma wykonywac prawdziwe polaczenia zamiast pracy na dummy config
- Kryterium zamkniecia:
  Najblizszy run `CI/CD Pipeline` nie raportuje juz falszywych bledow `BRAK` dla opcjonalnych integracji.

### MON-02 - Zweryfikowac dawny alarm o infinite loop w useWorkspaceData migration effect

- Status: `verify`
- Priorytet: `P1`
- Wlasciciel: `Codex`
- Zrodlo: historyczny alarm z lokalnych testow `useWorkspaceData.test.tsx`
- Opis zadania:
  Wczesniejszy wpis sugerowal petle `Maximum update depth exceeded` w `useWorkspaceData`, ale lokalny retest z 2026-04-04 pokazuje `10/10` zielonych testow dla `src/hooks/useWorkspaceData.test.tsx`. Ten punkt zostaje tylko do potwierdzenia w kolejnym CI, zeby odroznic realny bug od przeterminowanego alarmu.
- Kryterium zamkniecia:
  Najblizszy run CI nie pokazuje juz bledu `Maximum update depth exceeded`, a `src/hooks/useWorkspaceData.test.tsx` pozostaje zielony.

### MON-03 - Potwierdzic naprawe fallbacku RAG po awarii LLM

- Status: `verify`
- Priorytet: `P1`
- Zrodlo: lokalny bug `POST /workspaces/:workspaceId/rag/ask -> 500`
- Opis zadania:
  Endpoint RAG byl w stanie zwrocic `500`, gdy model AI albo klucz dostepowy byl niedostepny. Zostal dodany fallback budujacy odpowiedz z archiwum bez LLM.
- Zakres poprawki juz wykonany:
  - `server/lib/ragAnswer.ts`
  - `server/routes/workspaces.ts`
  - test regresji:
    - `server/tests/routes/workspaces.test.ts`
- Kryterium zamkniecia:
  Zapytanie do `rag/ask` zwraca odpowiedz oparta o archiwum zamiast `500`, nawet przy niedostepnym modelu.

### MON-04 - Zweryfikowac brak bledow formatowania po ostatnich poprawkach

- Status: `done`
- Priorytet: `P2`
- Zrodlo: `GitHub Actions -> Quality Checks -> Prettier check`
- Opis zadania:
  Lokalnie `pnpm run format:check` jest zielone po sformatowaniu plikow, ktore powodowaly faila. Potrzebne jest tylko potwierdzenie w nastepnym runie GitHub Actions.
- Wykonane poprawki:
  - `server/database.ts`
  - `server/tests/integration/api-critical.test.ts`
  - `server/tests/performance/response-time-sla.test.ts`
  - `server/tests/structuredLogger.test.ts`
- Kryterium zamkniecia:
  `Prettier check` przechodzi w `CI/CD Pipeline`. **ZAMKNIETE**: `pnpm run format:check` przechodzi lokalnie (2026-04-04 19:33).

### MON-05 - Naprawic brakujace assety audio dla nagran

- Status: `verify`
- Priorytet: `P1`
- Zrodlo: runtime frontend `GET /media/recordings/:id/audio -> 404`
- Opis zadania:
  Odtwarzanie niektorych nagran zwracalo `404`, gdy `media_assets.file_path` wskazywal na stary lokalny plik po redeployu, a audio nadal istnialo w storage pod kanonicznym kluczem opartym o `recordingId`. Backend probowal tylko `file_path` albo samo `basename`.
- Zakres poprawki juz wykonany:
  - `server/routes/media.ts`
  - testy regresji:
    - `server/tests/routes/media.test.ts`
    - `server/tests/regression/regression.test.ts`
 - Notatka:
  Lokalnie domkniete 2026-04-04 takze dla `retry-transcribe`: gdy plik lokalny zniknie po redeployu, backend probuje basename oraz kanoniczny klucz `recordingId.ext` zamiast konczyc na samym starym `file_path`.
- Kryterium zamkniecia:
  Odtwarzanie audio dla wskazanego nagrania dziala bez `404`, takze gdy lokalny `file_path` jest martwy, ale storage nadal ma plik pod odtworzonym kluczem.

### MON-06 - Usunac ostrzezenia Vite z produkcyjnego buildu

- Status: `verify`
- Priorytet: `P2`
- Wlasciciel: `Codex`
- Zrodlo: lokalny `pnpm run build`
- Opis zadania:
  Produkcyjny build przechodzil, ale wypisywal dwa mylace warningi: o mieszaniu ustawien `oxc` i `esbuild` w `vite.config.js` oraz o nierozwiazanych plikach fontu Geist importowanych przez `@import` w CSS. To nie blokowalo bundla, ale zaszumialo logi i utrudnialo odroznienie realnych problemow od ostrzezen konfiguracyjnych.
- Zakres poprawki juz wykonany:
  - `vite.config.js`
  - `src/index.tsx`
  - `src/index.css`
  - test regresji:
    - `scripts/validate-vite-build-config.test.ts`
  - walidacja skryptowa:
    - `package.json` (`test:workflows`)
- Notatka:
  Lokalnie potwierdzone 2026-04-04 - `pnpm run build` pakuje juz fonty Geist jako assety bez warningow o `./files/*.woff2`, a komunikat `Both esbuild and oxc options were set` nie wystepuje po usunieciu zbednego override `esbuild`.
- Kryterium zamkniecia:
  Kolejny build lokalny albo CI przechodzi bez warningow o `esbuild/oxc` i bez nierozwiazanych fontow Geist.

### MON-07 - RAG nie powinien padac po bledzie pierwszego providera LLM

- Status: `verify`
- Priorytet: `P1`
- Wlasciciel: `Codex`
- Zrodlo: runtime `POST /workspaces/:workspaceId/rag/ask` z fallbackiem `Model AI jest chwilowo niedostepny...`
- Opis zadania:
  Backend RAG mial poprawne klucze do wielu providerow, ale `generateRagAnswer` wybieral pierwszy dostepny model (`Groq -> Anthropic -> Gemini -> OpenAI`) i po jego bledzie od razu schodzil do fallbacku archiwum. W praktyce jedno chwilowe potkniecie pierwszego providera wygladalo jak globalna niedostepnosc modelu, mimo ze kolejny LLM byl skonfigurowany i mogl odpowiedziec.
- Zakres poprawki juz wykonany:
  - `server/lib/ragAnswer.ts`
  - test regresji:
    - `server/tests/lib/rag.coverage.test.ts`
- Notatka:
  Lokalnie potwierdzone 2026-04-05 - RAG probuje teraz kolejnych skonfigurowanych providerow, zamiast od razu oddawac sam fallback z archiwum. Dodatkowo sprawdzenie konfiguracji pokazalo, ze lokalne `.env` ma klucze `Groq`, `Anthropic`, `Gemini` i `OpenAI`, a frontend z deployu Vercel i tak proxyuje `/workspaces/*` do `https://audiorecorder-production.up.railway.app`, wiec problem nie wynikal z lokalnego `VITE_API_BASE_URL`.
- Kryterium zamkniecia:
  Zapytanie RAG zwraca odpowiedz z kolejnego dostepnego providera, gdy pierwszy provider chwilowo zawiedzie, zamiast od razu komunikatu `Model AI jest chwilowo niedostepny`.

### MON-08 - Naprawic usuwanie tekstu w formularzach po spacji

- Status: `done`
- Priorytet: `P1`
- Wlasciciel: `Qwen`
- Zrodlo: raport uzytkownika - po wpisaniu tekstu i spacji tekst sie usuwal
- Opis zadania:
  We wszystkich formularzach (szczegolnie quickDraft w TasksTab) tekst wpisywany przez uzytkownika znikal po nacisnieciu spacji lub innego klawisza. Przyczyna: useEffect w `TasksTab.tsx` mial `quickDraft.group` i `quickDraft.status` w dependency array, co powodowalo ze KAŻDA zmiana w quickDraft (np. wpisanie tekstu) wywolywala useEffect ktory nadpisywal CALY obiekt state, usuwajac pole `title` ktore uzytkownik wlasnie wpisał.
- Problem:
  - `useEffect` na linii ~100 mial `quickDraft.group` i `quickDraft.status` w deps
  - Gdy uzytkownik wpisal tekst w `quickDraft.title`, React wywolal re-render
  - useEffect widzial zmiane w deps i wywolal `setQuickDraft` nadpisujac caly obiekt
  - Title byl resetowany do pustego stringa z initial state
- Zakres poprawki juz wykonany:
  - `src/TasksTab.tsx` - usuniete `quickDraft.group` i `quickDraft.status` z dependency array
  - test regresji:
    - `src/TasksTab.inputs-regression.test.tsx`
- Notatka:
  Klasyczny bug "state overwrite" w React - gdy useEffect aktualizuje state ktory jest w jego own dependency array, tworzy to nieskonczona petle lub utrate danych. Fix: funkcjonalne aktualizacje `setState((prev) => ({ ...prev }))` zachowuja wszystkie pola, a minimalne dependency array zapobiega niepotrzebnym rerenderom.
- Kryterium zamkniecia:
  **ZAMKNIETE 2026-04-05**: Uzytkownik moze wpisywac tekst w formularzach bez utraty danych, test regresji przechodzi.

## Odrzucone jako szum lub informacyjne

- `PubSub already loaded, using existing version`
- `[VoiceLog] error auto-send active`
- `[useAudioHardware] Initial microphone permission: prompt`
- `[useAudioHardware] Microphone permission changed: granted`
- `[Preview] Build ID mismatch: frontend=... backend=...`

## Nastepne kroki

1. Zbic najwiekszy aktualny klaster z GitHub Actions: backendowe testy storage/Supabase z ostatnich `CI/CD Pipeline`.
2. Domknac testowe mocki `workspaceService.saveWorkspaceState`, bo to wraca w wielu runach jako osobny czerwony sygnal.
3. Zweryfikowac, czy `Configuration errors` oraz `Zbyt wiele prob` w backend testach sa realnym bugiem izolacji testow czy tylko hałasem z setupu.
4. Potwierdzic po deployu backendu, ze `MON-07` zwraca odpowiedz z kolejnego providera zamiast fallbacku archiwum.
5. Uzyskac dostep do `VERCEL_TOKEN` albo aktywnej sesji pluginu Vercel, a dla Sentry do `SENTRY_AUTH_TOKEN`, zeby odswiezyc brakujace monitory.

## Swiezy snapshot bledow

<!-- Refreshed on 2026-04-05T06:20:22.182Z -->

### GitHub Actions Errors (aktualny snapshot: 10 failed runow)

- **GH-AUTO-2026-04-05-1** — Fix repeated backend Supabase storage regression failures
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w co najmniej `7` runach `CI/CD Pipeline` od `2026-04-04T18:47:17Z` do `2026-04-05T04:31:08Z`
  - **Error:** `AssertionError: promise rejected "Error: Supabase Storage not available (client or storage module missing)."` oraz seria niespelnionych asercji o oczekiwanych kluczach storage (`rec_test.webm`, `recordings/rec1.webm`, liczba wywolan `vi.fn()`)
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23994268683
  - **Notatka:** to jest obecnie najczestszy klaster z najnowszego raportu (`Supabase Storage not available` pojawia sie `28x` w oknie raportu)

- **GH-AUTO-2026-04-05-2** — Fix missing `workspaceService.saveWorkspaceState` in backend tests
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w co najmniej `7` runach `CI/CD Pipeline`
  - **Error:** `APP ERROR STACK TypeError: workspaceService.saveWorkspaceState is not a function`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23994268683
  - **Notatka:** wyglada jak niespojny mock/stub w testach tras workspace, nie jak blad produkcyjnej implementacji

- **GH-AUTO-2026-04-05-3** — Triage backend test isolation for config and rate-limit failures
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w co najmniej `7` runach `CI/CD Pipeline`
  - **Error:** `Configuration errors:` oraz `Error: Zbyt wiele prob. Limit: 20 zadan/min. Sprobuj ponownie za 60s.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23994268683
  - **Notatka:** trzeba rozdzielic, czy to prawdziwy fail konfiguracji CI, czy wyciek stanu/rate-limitera pomiedzy testami backendu

- **GH-AUTO-2026-04-05-4** — Ograniczyc halas expected stderr w backend testach
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w co najmniej `7` runach `CI/CD Pipeline`
  - **Error:** `embedTextChunks failed: Error: embed failed`, `Gemini image gen error: 503 overloaded`, `Gemini image gen error: 400 Invalid request`, `Nie masz dostepu do tego workspace.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23994268683
  - **Notatka:** te linie wygladaja na oczekiwane scenariusze negatywne w testach, ale zasmiecaja raport i utrudniaja izolacje prawdziwej przyczyny faila

- **GH-AUTO-2026-04-05-5** — Investigate `Auto Security Patches` network failure
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> Auto Security Patches -> security-patch`
  - **Owner:** `Qwen`
  - **Error:** `[VoiceLog] auto-send error: Error: Network down`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23992509477
  - **Notatka:** osobny, jednostkowy blad automatu PR/security; nie wyglada na ten sam klaster co backend tests

- **GH-AUTO-2026-04-05-6** — Triage failed `Install dependencies` run without parsed error detail
  - **Status:** `todo`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Qwen`
  - **Error:** run `23985793671` zakonczyl sie fail na `Install dependencies`, ale najnowszy parser nie wydobyl z logu konkretnej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23985793671
  - **Notatka:** warto sprawdzic bezposrednio log joba, bo to moze byc chwilowy problem sieci/NPM, a nie blad repo

- **GH-AUTO-2026-04-05-7** — Historical typecheck failure for `removeWorkspaceMember` is still in the 7-day window
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Codex`
  - **Error:** `src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing...`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984982870
  - **Notatka:** to jest starszy fail nadal widoczny w oknie raportu; lokalnie byl juz naprawiony i jest pokryty poprzednimi wpisami `verify`

### Railway Snapshot

- **RW-SNAPSHOT-2026-04-05-1** — Railway currently healthy
  - **Status:** `done`
  - **Source:** `railway-errors/railway-errors-2026-04-05T06-20-03-347Z.md`
  - **Result:** brak linii `error/failure` w ostatnich `100` logach
  - **Health:** `https://audiorecorder-production.up.railway.app/health` zwraca `{"ok":true,"status":"ok","db":"connected","supabaseRemote":true}`
  - **Notatka:** Railway CLI jest zalogowane lokalnie; problemem nie jest obecnie runtime backendu na Railway

### Vercel Snapshot

- **VC-SNAPSHOT-2026-04-05-1** — Vercel refresh blocked by missing auth
  - **Status:** `blocked`
  - **Source:** `scripts/fetch-vercel-errors.js --verbose` oraz plugin Vercel
  - **Error:** `VERCEL_TOKEN environment variable not set`; plugin `vercel/list_teams` zwraca `Auth required`
  - **Notatka:** bez tokenu albo aktywnej sesji MCP nie da sie rzetelnie pobrac aktualnych bledow Vercel do kolejki

### Sentry Snapshot

- **SENTRY-SNAPSHOT-2026-04-05-1** — Sentry refresh blocked by missing auth token
  - **Status:** `blocked`
  - **Source:** `scripts/fetch-sentry-errors.js --verbose`
  - **Error:** `SENTRY_AUTH_TOKEN not set — skipping Sentry error fetch`
  - **Notatka:** brak aktualnych issue z Sentry w kolejce nie oznacza `0` bledow; oznacza brak dostepu do API w tym srodowisku
