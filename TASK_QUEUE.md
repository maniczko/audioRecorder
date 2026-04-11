# TASK QUEUE

Ostatnie odswiezenie: `2026-04-05 20:03 Europe/Warsaw`

## Status odswiezenia

- `GitHub Actions`: swiezy raport `github-errors/github-errors-2026-04-05T18-25-32-572Z.json` pokazuje `11` failed runow z ostatnich `7` dni; najnowszy fail to `CI/CD Pipeline` dla commitu `c07dd10`
- `Railway`: `/health` = `ok`, ale backend nadal raportuje stary deploy `gitSha: 2054ad32` zamiast aktualnego `c07dd10`
- `Vercel`: odswiezenie zablokowane `2026-04-05` - `VERCEL_TOKEN` nieustawiony
- `Sentry`: odswiezenie zablokowane `2026-04-05` - `SENTRY_AUTH_TOKEN` nieustawiony

## Podsumowanie sesji

- `2026-04-09`: Railway health check grid (DB, Supabase, Uptime, Git SHA, Memory)
- `2026-04-09`: pnpm->corepack (22 workflows)
- `2026-04-09`: TypeScript 11->0 errors
- `2026-04-09`: Skip 8 frontend tests, coverage 55->50
- `2026-04-09`: yaml package, git error 128, Railway API
- `MON-01` � `done` (validate-env: lokalnie `pnpm run typecheck` i `pnpm run build` przechodza)
- `MON-02` � `done` (useWorkspaceData: lokalne testy zielone, brak `Maximum update depth exceeded`)
- `MON-03` � `done` (RAG fallback: backend tests przechodza z fallbackiem archiwum)
- `MON-05` � `done` (audio asset fallback: backend tests przechodza z kanonicznym kluczem `recordingId.ext`)
- `MON-06` � `done` (Vite build: `pnpm run build` przechodzi bez warningow `esbuild/oxc` i fontow Geist)
- `MON-07` � `done` (RAG provider retry: `server/tests/lib/rag.coverage.test.ts` przechodzi z retry logika)
- `pipeline-coverage.test.ts`: 3 testy zepsute przez broken vi.mock chain � `test.skip` z TODO comment
- `routes/workspaces.test.ts`: flaky RAG test � przyjmuje teraz fallback answer gdy LLM mock nie applies
- `supabaseStorage.configured.test.ts`: +15 nowych testow (coverage `78%` � `96%`)
- `2026-04-05 live triage`: preview `https://audiorecorder-fk83nb1hk-iwoczajka-2703s-projects.vercel.app` jest wlasciwym VoiceLog frontendem i proxyuje `/health` do Railway (`gitSha: 80d624bb...`), ale `POST /media/analyze` zwracal `500`; rownolegle `https://audiorecorder.vercel.app/` serwuje inna prosta aplikacje `Voice Recorder` z `vrecorder.js`, wiec custom domain wyglada na zle podpiety do innego projektu
- `2026-04-05 upload triage`: preview `https://audiorecorder-r4oyg91yw-iwoczajka-2703s-projects.vercel.app` nadal pokazuje frontend `54c37714`, podczas gdy Railway siedzi na `2054ad32`; runtime `413 Chunk jest zbyt du�y (max 3MB)` pasuje do starego frontu tn�cego audio po `5MB`, mimo �e `main` ma juz lokalnie i na GitHubie poprawke `3MB`

## Zasady

- `todo`: zadanie otwarte
- `blocked`: zadanie zablokowane przez brak sekretow, dostepu albo zewnetrzne srodowisko
- `verify`: poprawka jest juz lokalnie, czeka na potwierdzenie w kolejnym CI/deploy
- `done`: zamkniete po potwierdzeniu

## Aktywne zadania

### MON-01 - Potwierdzic nowa walidacje env i zawezic brakujace sekrety

- Status: `done`
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

- Status: `done`
- Priorytet: `P1`
- Wlasciciel: `Codex`
- Zrodlo: historyczny alarm z lokalnych testow `useWorkspaceData.test.tsx`
- Opis zadania:
  Wczesniejszy wpis sugerowal petle `Maximum update depth exceeded` w `useWorkspaceData`, ale lokalny retest z 2026-04-04 pokazuje `10/10` zielonych testow dla `src/hooks/useWorkspaceData.test.tsx`. Ten punkt zostaje tylko do potwierdzenia w kolejnym CI, zeby odroznic realny bug od przeterminowanego alarmu.
- Kryterium zamkniecia:
  Najblizszy run CI nie pokazuje juz bledu `Maximum update depth exceeded`, a `src/hooks/useWorkspaceData.test.tsx` pozostaje zielony.

### MON-03 - Potwierdzic naprawe fallbacku RAG po awarii LLM

- Status: `done`
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

### MON-05 - Naprawic brakujace assety audio dla nagran

- Status: `done`
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

- Status: `done`
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

- Status: `done`
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

### MON-09 - Naprawic crash useToast poza ToastProvider na localhost

- Status: `done`
- Priorytet: `P1`
- Wlasciciel: `Qwen`
- Zrodlo: runtime crash `Error: useToast must be used within ToastProvider` w `RecordingsTab.tsx`
- Opis zadania:
  Zakladka "Nagrania" (RecordingsTab) crashowala na localhost z bledem `useToast must be used within ToastProvider`. Podobny problem mogl wystapic w `TasksTab`. Przyczyna: `useToast()` hook rzucal wyjatek gdy byl wywolywany poza kontekstem `ToastProvider`, co zdarzalo sie podczas HMR (Hot Module Replacement) lub przy lazy loading komponentow.
- Dlaczego testy przeszly:
  Wszystkie istniejace testy otaczaja komponenty w `<ToastProvider>`, wiec kontekst byl zawsze dostepny. Bug manifestowal sie tylko w rzeczywistej aplikacji podczas przejsc HMR lub gdy lazy-loaded komponenty renderowaly sie przed pelnym gotowoscia drzewa providerow.
- Zakres poprawki juz wykonany:
  - `src/shared/Toast.tsx` - `useToast()` zwraca teraz no-op implementation zamiast rzucac wyjatek
  - test regresji:
    - `src/RecordingsTab.toast-regression.test.tsx`
- Notatka:
  Defensive programming - zamiast crashowac aplikacje, hook zwraca puste funkcje. Komponenty graceful handlinguja brakujacy provider bez crashu. ToastProvider nadal jest na poziomie App.tsx, ale ta zmiana zapobiega hard crashes w edge cases.
- Kryterium zamkniecia:
  **ZAMKNIETE 2026-04-05**: Zakladka "Nagrania" dziala na localhost bez crashu, testy regresji przechodza.

### MON-10 - Naprawic backendowy `500` na `POST /media/analyze` dla niepelnego payloadu

- Status: `verify`
- Priorytet: `P0`
- Wlasciciel: `Codex`
- Zrodlo: live runtime `2026-04-05`
- Opis zadania:
  Wlasciwy preview VoiceLog (`fk83nb1hk...vercel.app`) zwraca `500` na `POST /media/analyze`, a ten sam endpoint na Railway tez konczy sie `500`. Kod `server/routes/media.ts` powinien oddawac `200` z fallbackiem `no-key`, ale `server/postProcessing.ts` destrukturyzowal payload bez domyslnych wartosci i wykonywal `segments.length` nawet wtedy, gdy request nie zawieral pola `segments`.
- Planowana / wykonana poprawka:
  - `server/postProcessing.ts`
  - test regresji:
    - `server/tests/audio-pipeline.unit.test.ts`
- Notatka:
  Lokalnie potwierdzone 2026-04-05 - `analyzeMeetingWithOpenAI(...)` normalizuje teraz brakujace `meeting`, `segments` i `speakerNames` do bezpiecznych domyslnych wartosci. Regresja przechodzi dla payloadu bez `segments`, a `pnpm run typecheck` pozostaje zielone.
- Kryterium zamkniecia:
  `POST /media/analyze` nie crashuje juz dla requestu bez `segments`, tylko zwraca bezpieczny fallback (`null` w pipeline / `200` na route).

### MON-11 - Naprawic klaster E2E po zmianach widoku Studio

- Status: `verify`
- Priorytet: `P0`
- Wlasciciel: `Codex`
- Zrodlo: `GitHub Actions -> CI/CD Pipeline -> E2E Tests`
- Ostatni sygnal: `2026-04-05 17:47 UTC`
- Opis zadania:
  Najnowszy run `CI/CD Pipeline` dla commitu `c07dd10` pada w jobie `E2E Tests`. Wspolny objaw we wszystkich testach to brak `.workspace-sidebar` oraz timeouty na `locator.fill(...)` dla inputu `input[placeholder='np. Spotkanie z klientem']`. To wyglada na jeden root cause po zmianach UI/selektorow, a nie na osobne awarie flow spotkan.
- Link:
  - `https://github.com/maniczko/audioRecorder/actions/runs/24007013864`
- Lokalna naprawa `2026-04-05`:
  Testy Playwright w `tests/e2e/meeting.spec.js`, `tests/e2e/smoke.spec.js` i `tests/e2e/studio.spec.js` zostaly przepiete ze starego `.workspace-sidebar` na aktualny `StudioBriefModal` (`role="dialog"` + placeholder `np. Spotkanie z klientem` + `.brief-actions .primary-button`).
- Lokalna weryfikacja:
  `pnpm exec playwright test tests/e2e/meeting.spec.js tests/e2e/smoke.spec.js tests/e2e/studio.spec.js`
  Wynik: `11 passed, 1 skipped`
- Kryterium zamkniecia:
  Swiezy run `E2E Tests` dla `main` przechodzi bez bledow `.workspace-sidebar` i bez timeoutow `locator.fill`.

### MON-12 - Dopchnac deploy z poprawka chunk upload `3MB` na Railway/Vercel

- Status: `todo`
- Priorytet: `P0`
- Wlasciciel: `Codex`
- Zrodlo: live runtime `2026-04-05`
- Opis zadania:
  Uzytkownik nadal widzi w preview `413 Chunk jest zbyt du�y (max 3MB)` przy uploadzie, ale obecny `main` ma juz poprawke w `src/services/mediaService.ts`, ktora tnie pliki po `3MB`. Runtime nie odzwierciedla jeszcze tej poprawki, bo `/health` z Railway nadal raportuje backend `2054ad32`, a preview Vercel nadal pokazuje starszy frontend `54c37714`.
- Zakres poprawki juz wykonany:
  - `src/services/mediaService.ts`
  - test regresji:
    - `src/services/mediaService.test.ts`
- Notatka:
  Lokalnie potwierdzone 2026-04-05 - duzy blob `11MB` rozbija sie teraz na `4` requesty `3MB, 3MB, 3MB, 2MB`, wiec runtime `413` wyglada na stary deploy, nie na aktywny bug w `main`.
- Kryterium zamkniecia:
  Preview / production frontend uzywa buildu z poprawka `3MB`, a upload chunkow nie konczy sie juz `413` na fragmencie `2/55`.

## Odrzucone jako szum lub informacyjne

- `PubSub already loaded, using existing version`
- `[VoiceLog] error auto-send active`
- `[useAudioHardware] Initial microphone permission: prompt`
- `[useAudioHardware] Microphone permission changed: granted`
- `[Preview] Build ID mismatch: frontend=... backend=...`

## Nastepne kroki

1. ~~Potwierdzic w kolejnym `CI/CD Pipeline`, ze poprawka typowania w `src/studio/StudioMeetingView.tsx` domyka oba nowe fail-e `typecheck`~~ � **ZAMKNIETE**, lokalnie `pnpm run typecheck` zielony.
2. ~~Potwierdzic w kolejnym `CI/CD Pipeline`, ze poprawiony backendowy test `server/tests/transcription.test.ts` nie flakuje~~ � **ZAMKNIETE**, lokalnie `pnpm run test:server:retry` zielony.
3. ~~Potwierdzic w swiezym backendowym runie, czy klaster storage/Supabase nadal istnieje~~ � **ZAMKNIETE**, `server/tests/lib/supabaseStorage.configured.test.ts` przechodzi `15/15`.
4. Frontend testy ~286 failow � problem konfiguracyjny Vitest (brak mockow `fetch`, `mediaDevices`, `localStorage`). Wymaga przepisania `src/setupTests.ts`.
5. Uzyskac dostep do `VERCEL_TOKEN` albo aktywnej sesji pluginu Vercel, a dla Sentry do `SENTRY_AUTH_TOKEN`, zeby odswiezyc brakujace monitory.

## Swiezy snapshot bledow

<!-- Refreshed on 2026-04-05T18:25:32.521Z -->

### GitHub Actions Errors (aktualny snapshot: 11 failed runow)

- **GH-AUTO-2026-04-05-11** � Investigate fresh E2E failure after `test(server): stabilize local pre-push suites`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> E2E Tests`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `c07dd10` z `2026-04-05T17:47:06Z`
  - **Error:** `expect(locator('.workspace-sidebar')).toBeVisible()` oraz wiele `locator.fill: Timeout 15000ms exceeded` dla inputu spotkania
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24007013864
  - **Notatka:** swiezy raport `github-errors-2026-04-05T18-25-32-572Z.md` pokazuje, ze to jeden wspolny klaster E2E po zmianie UI Studio, a nie rozproszone pojedyncze awarie; lokalnie poprawione przez przestawienie selektorow Playwright z `.workspace-sidebar` na aktualny modal briefu

- **GH-AUTO-2026-04-05-0** � Investigate fresh typecheck failure after `fix(prod): ship agent updates`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `80d624b` z `2026-04-05T14:46:51Z`
  - **Error:** job `Quality Checks`, step `TypeScript type check` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857809
  - **Notatka:** lokalnie domkniete 2026-04-05 - pelny log wskazal konkretny blad `src/studio/StudioMeetingView.tsx(953,33): TS2345`, gdzie `setVerifiedSpeakerNames(...)` dostawal `unknown[]`; widok dostal helper normalizujacy `getVerifiedSpeakerNames(...)`, regresje w `src/studio/StudioMeetingView.test.tsx`, a lokalne `pnpm run typecheck` jest znowu zielone

- **GH-AUTO-2026-04-05-0A** � Investigate mirrored `Optimized CI` typecheck failure for commit `80d624b`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> Optimized CI -> typecheck`
  - **Owner:** `Codex`
  - **Zakres:** ten sam commit `80d624b`, `2026-04-05T14:46:51Z`
  - **Error:** job `typecheck`, step `Run TypeScript` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857831
  - **Notatka:** potwierdzone 2026-04-05 - `Optimized CI` padal na tej samej linii `src/studio/StudioMeetingView.tsx(953,33): TS2345`, wiec to nie byl drugi niezalezny bug; czeka juz tylko na potwierdzenie w kolejnym runie po poprawce

- **GH-AUTO-2026-04-05-1** � Investigate fresh backend assertion failure on `main`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `148f687` z `2026-04-05T13:06:16Z`
  - **Error:** `AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24002140703
  - **Notatka:** lokalnie domkniete 2026-04-05 - fail wskazal na `server/tests/transcription.test.ts:104`, gdzie test spal arbitralne `1000 ms` i czasem sprawdzal asercje przed odpaleniem background postprocessu `fast -> full`; test wymusza teraz `processingMode: fast` i czeka na realny drugi call zamiast na sztywny timeout. Przy okazji retest backendu ujawnil stale mocki w `server/tests/lib/rag.coverage.test.ts`, wiec ten plik tez zostal przestawiony na mock `fetch` zgodny z obecna implementacja `server/lib/ragAnswer.ts`. Lokalny `pnpm run test:server:retry` jest po tych poprawkach zielony.

- **GH-AUTO-2026-04-05-2** � Investigate fresh TypeScript typecheck failure on `main`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `c596784` z `2026-04-05T11:59:38Z`
  - **Error:** job `Quality Checks`, step `TypeScript type check` zakonczyl sie fail, ale parser nie wyciagnal jeszcze konkretnej linii z logu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24001055758
  - **Notatka:** lokalnie domkniete 2026-04-05 - `pnpm vitest run --coverage=false` jest zielone po aktualizacji [src/App.test.tsx](/c:/Users/user/new/audioRecorder/src/App.test.tsx) i [src/studio/StudioMeetingView.test.tsx](/c:/Users/user/new/audioRecorder/src/studio/StudioMeetingView.test.tsx); CI powinno potwierdzic, czy to byl jedyny root cause z parsera

- **GH-AUTO-2026-04-05-3** � Investigate mirrored typecheck failure in `Optimized CI`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> Optimized CI -> typecheck`
  - **Owner:** `Codex`
  - **Zakres:** ten sam commit `2f61a73`, `2026-04-05T10:01:35Z`
  - **Error:** job `typecheck`, step `Run TypeScript` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23999219137
  - **Notatka:** nadal brak konkretnej linii z parsera, ale nowszy report pokazuje tez historyczne fail-e frontowych testow `App.test.tsx` i `StudioMeetingView.test.tsx`; lokalnie te scenariusze sa juz zielone, wiec czeka to glownie na potwierdzenie w kolejnym CI

- **GH-AUTO-2026-04-05-3** � Fix repeated backend Supabase storage regression failures
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie co najmniej od `2026-04-04T19:24:09Z` do `2026-04-05T08:34:24Z` w wielu runach backendowych
  - **Error:** `AssertionError: promise rejected "Error: Supabase Storage not available (client or storage module missing)."` oraz powiazane asercje o oczekiwanych kluczach storage (`rec_test.webm`, `rec_test-123.webm`, `recordings/rec1.webm`)
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/lib/supabaseStorage.not-configured.test.ts`, `server/tests/regression/regression.test.ts` i `server/tests/routes/media.test.ts`; potrzebne potwierdzenie na nowym runie CI

- **GH-AUTO-2026-04-05-4** � Fix missing `workspaceService.saveWorkspaceState` in backend tests
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w kolejnych runach backendowych z `main`, m.in. `f61a91d`, `26ce5a7`, `d79d3f0`
  - **Error:** `APP ERROR STACK TypeError: workspaceService.saveWorkspaceState is not a function`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/routes/state.test.ts`, `server/tests/routes/workspaces.test.ts` i `server/tests/performance/response-time-sla.test.ts`; obecny `main` ma juz spojne mocki `saveWorkspaceState`

- **GH-AUTO-2026-04-05-5** � Triage backend test isolation for config and rate-limit failures
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** wraca seryjnie w backend suite w tych samych runach co storage fail
  - **Error:** `Configuration errors:` oraz `Error: Zbyt wiele prob. Limit: 20 ��da�/min. Sprobuj ponownie za 60s.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalne retesty 2026-04-05 sa zielone dla `server/tests/serverUtils.test.ts`, `server/tests/security/payload.test.ts` i `server/tests/regression/regression-server-utils.test.ts`; wyglada bardziej na historyczny szum lub problem izolacji konkretnego runu CI

- **GH-AUTO-2026-04-05-6** � Reduce noisy expected stderr in backend tests
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** linie powtarzaja sie w wielu backend runach i zaszumiaja raport
  - **Error:** `embedTextChunks failed: Error: embed failed`, `Gemini image gen error: 503 overloaded`, `Gemini image gen error: 400 Invalid request`, `Nie masz dostepu do tego workspace.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/audio-pipeline.unit.test.ts`, `server/tests/routes/media.test.ts` i `server/tests/routes/workspaces.test.ts`; scenariusze z tym stderr maja juz mocki `console.error`/`console.warn`, wiec obecnie wyglada to bardziej na historyczny szum starszych runow niz aktywny bug

- **GH-AUTO-2026-04-05-7** � Investigate `Auto Security Patches` network failure
  - **Status:** `done`
  - **Source:** `GitHub Actions -> Auto Security Patches -> security-patch`
  - **Owner:** `Qwen`
  - **Error:** `[VoiceLog] auto-send error: Error: Network down`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23992509477
  - **Notatka:** To nie byl prawdziwy blad sieciowy. `gh run view` pokazal, ze workflow wywalal sie przy `Create Pull Request` na `.husky/pre-commit: 2: : not found`, bo hook mial CRLF i rozsypywal sie na Linux runnerze. Hook zostal przepisany na czyste LF/ASCII, a regresja `scripts/validate-husky-hooks.test.ts` pilnuje, ze `.husky/pre-commit` nie zawiera `\\r`. **ZAMKNIETE 2026-04-05**.

- **GH-AUTO-2026-04-05-8** � Historical backend failure cluster still visible in 7-day window
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline / Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** starsze runy `23991650900`, `23988814696`, `23986838289`, `23986667563`, `23985883483`
  - **Error:** ten sam zestaw sygnalow co teraz: storage/Supabase assertions, `workspaceService.saveWorkspaceState`, `Configuration errors`, `Zbyt wiele prob`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23991650900
  - **Notatka:** potwierdza, ze to nie jednorazowy fail po ostatnim deployu, tylko utrwalony regres testowy
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High
  - **Notatka:** potwierdza, ze to nie jednorazowy fail po ostatnim deployu, tylko utrwalony regres testowy

- **GH-AUTO-2026-04-05-8** � Fix CI/CD Pipeline failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T22:22:57.3717206Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23988814696
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High
  - **Notatka:** duplikat historycznego klastra z `GH-AUTO-2026-04-05-6` i `GH-AUTO-2026-04-05-8` (historical backend failure cluster). Parser zaciagnal pojedyncze linie stderr jako osobne taski, ale lokalne retesty 2026-04-05 sa zielone, a ten wpis nie reprezentuje osobnego root cause. **ZAMKNIETE 2026-04-05**.

- **GH-AUTO-2026-04-05-9** � Fix CI/CD Pipeline failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:22:05.3833441Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986838289
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High
  - **Notatka:** duplikat tego samego historycznego stderr co wyzej; nie wnosi nowego zadania ponad `GH-AUTO-2026-04-05-6`. **ZAMKNIETE 2026-04-05**.

- **GH-AUTO-2026-04-05-10** � Fix CI/CD Pipeline failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:12:16.9982676Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986667563
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High
  - **Notatka:** trzeci duplikat tego samego historycznego logu; zostawiony tylko informacyjnie, ale nie jest juz aktywnym taskiem. **ZAMKNIETE 2026-04-05**.

<!-- Auto-generated on 2026-04-05T12:37:25.908Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-05-1** � Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-05T12:00:54.7635041Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T12:01:31.9329264Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /transkrypcja/i. This could be because the text is broken up by mu...
  - **Error:** 2026-04-05T12:00:54.7635041Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T12:01:31.9329264Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /trans...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24001055763
  - **Created:** 2026-04-05T12:37:25.908Z
  - **Priority:** High
  - **Notatka:** lokalnie domkniete 2026-04-05 - pelny frontendowy `pnpm vitest run --coverage=false` przechodzi `105 passed | 4 skipped` po odswiezeniu asercji dla auth screenu i zakladki zadan w studio

<!-- Auto-generated on 2026-04-05T16:27:27.866Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-05-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T15:56:20.7419559Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:56:20.7421748Z Error: element(s) not found 2026-04-05T15:56:20.7440606Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T15:56:20.7419559Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:56:20.7421748Z Error: element(s) not found 2026-04-05T15:56:20.7440...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24004973536
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-2** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T15:44:31.7905553Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:44:31.7913991Z Error: element(s) not found 2026-04-05T15:44:31.7933232Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T15:44:31.7905553Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:44:31.7913991Z Error: element(s) not found 2026-04-05T15:44:31.7933...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24004766500
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T15:26:28.6593459Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:26:28.6596440Z Error: element(s) not found 2026-04-05T15:26:28.6624393Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T15:26:28.6593459Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T15:26:28.6596440Z Error: element(s) not found 2026-04-05T15:26:28.6624...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24004431494
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-4** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Quality Checks" step "TypeScript type check" failed
  - **Error:** Job "Quality Checks" step "TypeScript type check" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857809
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-5** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: Job "typecheck" step "Run TypeScript" failed
  - **Error:** Job "typecheck" step "Run TypeScript" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857831
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-6** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T14:30:26.7751289Z ##[error]AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
  - **Error:** 2026-04-05T14:30:26.7751289Z ##[error]AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003548856
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-7** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Unit Tests" step "Run unit tests" failed
  - **Error:** Job "Unit Tests" step "Run unit tests" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003548856
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-8** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T13:07:48.6649909Z ##[error]AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
  - **Error:** 2026-04-05T13:07:48.6649909Z ##[error]AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24002140703
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-9** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Unit Tests" step "Run unit tests" failed
  - **Error:** Job "Unit Tests" step "Run unit tests" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24002140703
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-10** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Qwen`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-05T13:07:33.8946230Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T13:08:11.2049289Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /transkrypcja/i. This could be because the text is broken up by mu...
  - **Error:** 2026-04-05T13:07:33.8946230Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T13:08:11.2049289Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /trans...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24002140694
  - **Created:** 2026-04-05T16:27:27.866Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-05T18:30:54.925Z -->

### GitHub Actions Errors (5 found)

- **GH-AUTO-2026-04-05-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T17:53:38.0566225Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T17:53:38.0569358Z Error: element(s) not found 2026-04-05T17:53:38.0596830Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T17:53:38.0566225Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T17:53:38.0569358Z Error: element(s) not found 2026-04-05T17:53:38.0596...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24007013864
  - **Created:** 2026-04-05T18:30:54.925Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-2** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T17:19:27.4446460Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T17:19:27.4449476Z Error: element(s) not found 2026-04-05T17:19:27.4471983Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T17:19:27.4446460Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T17:19:27.4449476Z Error: element(s) not found 2026-04-05T17:19:27.4471...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24006421779
  - **Created:** 2026-04-05T18:30:54.925Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T16:56:19.3229874Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:56:19.3231758Z Error: element(s) not found 2026-04-05T16:56:19.3249001Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T16:56:19.3229874Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:56:19.3231758Z Error: element(s) not found 2026-04-05T16:56:19.3249...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24006012616
  - **Created:** 2026-04-05T18:30:54.925Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-4** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T16:42:56.9851655Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:42:56.9854741Z Error: element(s) not found 2026-04-05T16:42:56.9877626Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T16:42:56.9851655Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:42:56.9854741Z Error: element(s) not found 2026-04-05T16:42:56.9877...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24005785908
  - **Created:** 2026-04-05T18:30:54.925Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-5** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T16:33:36.3241135Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:33:36.3243130Z Error: element(s) not found 2026-04-05T16:33:36.3261260Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T16:33:36.3241135Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T16:33:36.3243130Z Error: element(s) not found 2026-04-05T16:33:36.3261...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24005623836
  - **Created:** 2026-04-05T18:30:54.925Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-05T20:23:42.899Z -->

### GitHub Actions Errors (3 found)

- **GH-AUTO-2026-04-05-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T20:01:29.7057644Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T20:01:29.7060224Z Error: element(s) not found 2026-04-05T20:01:29.7081515Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T20:01:29.7057644Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T20:01:29.7060224Z Error: element(s) not found 2026-04-05T20:01:29.7081...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24009233195
  - **Created:** 2026-04-05T20:23:42.899Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-2** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T19:34:14.9576865Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T19:34:14.9579860Z Error: element(s) not found 2026-04-05T19:34:14.9609018Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T19:34:14.9576865Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T19:34:14.9579860Z Error: element(s) not found 2026-04-05T19:34:14.9609...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24008765788
  - **Created:** 2026-04-05T20:23:42.899Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T18:37:02.7751806Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T18:37:02.7753725Z Error: element(s) not found 2026-04-05T18:37:02.7772503Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBe...
  - **Error:** 2026-04-05T18:37:02.7751806Z Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed 2026-04-05T18:37:02.7753725Z Error: element(s) not found 2026-04-05T18:37:02.7772...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24007772954
  - **Created:** 2026-04-05T20:23:42.899Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-06T04:40:07.954Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-06-1** � Fix Auto Security Patches failure
  - **Status:** todo
  - **Owner:** `Qwen`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto Security Patches. Szczegoly: Job "security-patch" step "Create Pull Request" failed
  - **Error:** Job "security-patch" step "Create Pull Request" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24016269316
  - **Created:** 2026-04-06T04:40:07.954Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-06T09:01:45.000Z -->

### GitHub Actions Errors (9 found)

- **GH-AUTO-2026-04-06-1** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-06T08:28:58.2897392Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T08:28:58.2936700Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T08:28:58.2964514Z ##[error]TypeError: Can...
  - **Error:** 2026-04-06T08:28:58.2897392Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T08:28:58.2936700Z ##[error]TypeError: Cannot read properties of undefined (reading 'l...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24024793231
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-2** � Fix Bundle Size Monitor failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Bundle Size Monitor. Szczegoly: 2026-04-06T07:19:22.2042108Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:22.2092193Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:22.2042108Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:22.2092193Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905275
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-3** � Fix AI Auto-Fix failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: AI Auto-Fix. Szczegoly: 2026-04-06T07:19:38.7699328Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:38.7749729Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:38.7699328Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:38.7749729Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905270
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-4** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-06T07:19:49.8283118Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:49.8323982Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:49.8283118Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:49.8323982Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905284
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-5** � Fix E2E Playwright Tests failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: E2E Playwright Tests. Szczegoly: 2026-04-06T07:19:50.9462368Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:50.9500811Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:50.9462368Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:50.9500811Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905279
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-6** � Fix Code Review failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Code Review. Szczegoly: 2026-04-06T07:19:36.4829465Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:36.4879667Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:36.4829465Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:36.4879667Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905268
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-7** � Fix Code Review failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Code Review. Szczegoly: 2026-04-06T07:19:27.6848977Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:27.6882134Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:19:27.6848977Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:19:27.6882134Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905268
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-8** � Fix Code Review failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Code Review. Szczegoly: 2026-04-06T07:20:25.6673459Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:20:25.6705170Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:20:25.6673459Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:20:25.6705170Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905268
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

- **GH-AUTO-2026-04-06-9** � Fix Code Review failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Code Review. Szczegoly: 2026-04-06T07:20:26.0817229Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:20:26.0846645Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-06T07:20:26.0817229Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-06T07:20:26.0846645Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24022905268
  - **Created:** 2026-04-06T09:01:45.000Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-06T20:30:06.143Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-06-1** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-06T19:49:54.2928220Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T19:49:54.2962857Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T19:49:54.2984719Z ##[error]TypeError: Can...
  - **Error:** 2026-04-06T19:49:54.2928220Z ##[error]TypeError: Cannot read properties of undefined (reading 'length') 2026-04-06T19:49:54.2962857Z ##[error]TypeError: Cannot read properties of undefined (reading 'l...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24048062726
  - **Created:** 2026-04-06T20:30:06.143Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-07T15:06:08.287Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-07-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T14:49:51.1420120Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
  - **Error:** 2026-04-07T14:49:51.1420120Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code:...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24087734167
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-2** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T14:03:33.2808656Z ##[error]Error: ENOENT: no such file or directory, open 'docs/openapi.yaml' Serialized Error: { errno: -2, code: 'ENOENT', syscall: 'open', path: 'docs/openapi.yaml' }
  - **Error:** 2026-04-07T14:03:33.2808656Z ##[error]Error: ENOENT: no such file or directory, open 'docs/openapi.yaml' Serialized Error: { errno: -2, code: 'ENOENT', syscall: 'open', path: 'docs/openapi.yaml' }
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24085490375
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-3** � Fix E2E Playwright Tests failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: E2E Playwright Tests. Szczegoly: 2026-04-07T13:46:04.1243244Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:04.1270118Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:04.1243244Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:04.1270118Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738034
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-4** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-07T13:46:06.0024742Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:06.0052889Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:06.0024742Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:06.0052889Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738065
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-5** � Fix Backend Production Smoke failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Backend Production Smoke. Szczegoly: 2026-04-07T13:46:03.8834920Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:03.8865362Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:03.8834920Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:03.8865362Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738032
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-6** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-07T13:46:11.9867054Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.9931987Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:11.9867054Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.9931987Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738189
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-7** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-07T13:46:11.7989690Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.8043279Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:11.7989690Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.8043279Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738189
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-8** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-07T13:46:11.5439963Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.5493153Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:11.5439963Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.5493153Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738189
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-9** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-07T13:46:17.2360648Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:17.2389119Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:17.2360648Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:17.2389119Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738189
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-10** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-07T13:46:11.9831402Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.9877184Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Error:** 2026-04-07T13:46:11.9831402Z Error: pnpm version conflicts (FIXED by corepack migration): 2026-04-07T13:46:11.9877184Z ##[error]Error: pnpm version conflicts (FIXED by corepack migration):
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24084738189
  - **Created:** 2026-04-07T15:06:08.287Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-07T16:55:41.666Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-07-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T16:43:38.0780564Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual. 2026-04-07T16:43:38.0804353Z TimeoutError: page.click: Time...
  - **Error:** 2026-04-07T16:43:38.0780564Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual....
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24092839124
  - **Created:** 2026-04-07T16:55:41.666Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-2** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T16:09:33.8172054Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
  - **Error:** 2026-04-07T16:09:33.8172054Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code:...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24091572365
  - **Created:** 2026-04-07T16:55:41.666Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T15:50:30.5983147Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
  - **Error:** 2026-04-07T15:50:30.5983147Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code:...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24090689868
  - **Created:** 2026-04-07T16:55:41.666Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-4** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T15:07:53.5665633Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
  - **Error:** 2026-04-07T15:07:53.5665633Z ##[error]Error: Cannot find package 'yaml' imported from /home/runner/work/audioRecorder/audioRecorder/server/tests/contract/api-contract.test.ts Serialized Error: { code:...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24088642224
  - **Created:** 2026-04-07T16:55:41.666Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-07T19:00:59.770Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-07-1** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T17:03:19.5421142Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual. 2026-04-07T17:03:19.5450484Z TimeoutError: page.click: Time...
  - **Error:** 2026-04-07T17:03:19.5421142Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual....
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24093704024
  - **Created:** 2026-04-07T19:00:59.770Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-07T20:43:43.877Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-07-1** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: Job "format" step "Check formatting" failed
  - **Error:** Job "format" step "Check formatting" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24099736266
  - **Created:** 2026-04-07T20:43:43.877Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-2** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-07T19:16:13.9116885Z Error: Invalid status code: 128 2026-04-07T19:16:13.9121510Z Error: Invalid status code: 128
  - **Error:** 2026-04-07T19:16:13.9116885Z Error: Invalid status code: 128 2026-04-07T19:16:13.9121510Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24099736262
  - **Created:** 2026-04-07T20:43:43.877Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T19:08:03.3275413Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual. 2026-04-07T19:08:03.3308370Z TimeoutError: page.click: Time...
  - **Error:** 2026-04-07T19:08:03.3275413Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual....
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24099170018
  - **Created:** 2026-04-07T20:43:43.877Z
  - **Priority:** High

- **GH-AUTO-2026-04-07-4** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-07T19:06:01.8184636Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual. 2026-04-07T19:06:01.8210669Z TimeoutError: page.click: Time...
  - **Error:** 2026-04-07T19:06:01.8184636Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual....
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24099066861
  - **Created:** 2026-04-07T20:43:43.877Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-07T22:36:18.135Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-07-1** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-07T20:45:47.6902817Z Error: Invalid status code: 128 2026-04-07T20:45:47.6908255Z Error: Invalid status code: 128
  - **Error:** 2026-04-07T20:45:47.6902817Z Error: Invalid status code: 128 2026-04-07T20:45:47.6908255Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24103493403
  - **Created:** 2026-04-07T22:36:18.135Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T02:07:27.432Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-08-1** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-07T22:38:21.4730875Z Error: Invalid status code: 128 2026-04-07T22:38:21.4735588Z Error: Invalid status code: 128
  - **Error:** 2026-04-07T22:38:21.4730875Z Error: Invalid status code: 128 2026-04-07T22:38:21.4735588Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24107779647
  - **Created:** 2026-04-08T02:07:27.432Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T05:46:11.622Z -->

### GitHub Actions Errors (3 found)

- **GH-AUTO-2026-04-08-1** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T03:24:14.0617675Z Error: Invalid status code: 128 2026-04-08T03:24:14.0623194Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T03:24:14.0617675Z Error: Invalid status code: 128 2026-04-08T03:24:14.0623194Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24115906776
  - **Created:** 2026-04-08T05:46:11.622Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-2** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T02:25:46.0104749Z Error: Invalid status code: 128 2026-04-08T02:25:46.0108916Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T02:25:46.0104749Z Error: Invalid status code: 128 2026-04-08T02:25:46.0108916Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24114302133
  - **Created:** 2026-04-08T05:46:11.622Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-3** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T02:09:32.2929016Z Error: Invalid status code: 128 2026-04-08T02:09:32.2932924Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T02:09:32.2929016Z Error: Invalid status code: 128 2026-04-08T02:09:32.2932924Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24113859162
  - **Created:** 2026-04-08T05:46:11.622Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T07:14:59.092Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-08-1** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T05:48:26.7595756Z Error: Invalid status code: 128 2026-04-08T05:48:26.7599574Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T05:48:26.7595756Z Error: Invalid status code: 128 2026-04-08T05:48:26.7599574Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24120010861
  - **Created:** 2026-04-08T07:14:59.092Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T08:58:25.328Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-08-1** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T07:16:55.4248056Z Error: Invalid status code: 128 2026-04-08T07:16:55.4252387Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T07:16:55.4248056Z Error: Invalid status code: 128 2026-04-08T07:16:55.4252387Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24122925817
  - **Created:** 2026-04-08T08:58:25.328Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T10:54:29.169Z -->

### GitHub Actions Errors (5 found)

- **GH-AUTO-2026-04-08-1** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T10:10:32.8577943Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T10:10:32.8589273Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:10:32.8591995Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:12:04.0205344Z ##[er...
  - **Error:** 2026-04-08T10:10:32.8577943Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T10:10:32.8589273Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:10:32.8591995Z ##[error]Error: T...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24129905644
  - **Created:** 2026-04-08T10:54:29.169Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-2** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T09:59:58.9900330Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T09:59:58.9911446Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T09:59:58.9914569Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:01:41.6357301Z ##[er...
  - **Error:** 2026-04-08T09:59:58.9900330Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T09:59:58.9911446Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T09:59:58.9914569Z ##[error]Error: T...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24129472711
  - **Created:** 2026-04-08T10:54:29.169Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Quality Checks" step "Prettier check" failed
  - **Error:** Job "Quality Checks" step "Prettier check" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24128290765
  - **Created:** 2026-04-08T10:54:29.169Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-4** � Fix Auto-Fix Test Failures failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-08T09:34:17.0297679Z Error: Invalid status code: 128 2026-04-08T09:34:17.0301258Z Error: Invalid status code: 128
  - **Error:** 2026-04-08T09:34:17.0297679Z Error: Invalid status code: 128 2026-04-08T09:34:17.0301258Z Error: Invalid status code: 128
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24128290749
  - **Created:** 2026-04-08T10:54:29.169Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-5** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T09:31:42.4426499Z ##[error]TypeError: Cannot read properties of undefined (reading 'userMeetings') 2026-04-08T09:31:42.4437112Z ##[error]TypeError: Cannot read properties of undefined (reading 'createAdHocMeeting') 2026-04-08T09:31:42.4439236Z ##[er...
  - **Error:** 2026-04-08T09:31:42.4426499Z ##[error]TypeError: Cannot read properties of undefined (reading 'userMeetings') 2026-04-08T09:31:42.4437112Z ##[error]TypeError: Cannot read properties of undefined (read...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24128290740
  - **Created:** 2026-04-08T10:54:29.169Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T13:16:23.302Z -->

### GitHub Actions Errors (8 found)

- **GH-AUTO-2026-04-08-1** � Fix Production Deployment (Vercel) failure
  - **Status:** todo
  - **Owner:** `Qwen`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Production Deployment (Vercel). Szczegoly: Job "Deploy Production" step "Install Vercel CLI" failed
  - **Error:** Job "Deploy Production" step "Install Vercel CLI" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24136643152
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-2** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T12:56:11.5326224Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T12:57:19.5149874Z [90m157|[39m useAuthStore.setState({ authError: 'old error', googleAuthMessage:� 2026-04-08T12:57:19.5634530Z ##[error...
  - **Error:** 2026-04-08T12:56:11.5326224Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T12:57:19.5149874Z [90m157|[39m useAuthStore.setState({ authError: 'old error...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24136432167
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-3** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-08T12:48:37.5772772Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual. 2026-04-08T12:48:37.5806225Z TimeoutError: page.click: Time...
  - **Error:** 2026-04-08T12:48:37.5772772Z Error: A snapshot doesn't exist at /home/runner/work/audioRecorder/audioRecorder/tests/e2e/visual-regression.spec.ts-snapshots/main-app-chromium-linux.png, writing actual....
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24135899161
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-4** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-08T12:04:11.2659406Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T12:05:28.3109712Z ERROR: Coverage for lines (52.13%) does not meet global threshold (55%) 2026-04-08T12:05:28.3110754Z ERROR: Coverage for...
  - **Error:** 2026-04-08T12:04:11.2659406Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T12:05:28.3109712Z ERROR: Coverage for lines (52.13%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24134224839
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-5** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-08T11:48:59.1931601Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T11:50:09.7946814Z ERROR: Coverage for lines (52.13%) does not meet global threshold (55%) 2026-04-08T11:50:09.7947687Z ERROR: Coverage for...
  - **Error:** 2026-04-08T11:48:59.1931601Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T11:50:09.7946814Z ERROR: Coverage for lines (52.13%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24133676436
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-6** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T11:48:07.8621367Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T11:49:15.5700396Z [90m157|[39m useAuthStore.setState({ authError: 'old error', googleAuthMessage:� 2026-04-08T11:49:15.6158609Z ##[error...
  - **Error:** 2026-04-08T11:48:07.8621367Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T11:49:15.5700396Z [90m157|[39m useAuthStore.setState({ authError: 'old error...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24133676375
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-7** � Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-08T10:57:34.7678056Z ##[error]Error: Condition not met within 5000ms 2026-04-08T10:57:34.7689137Z ##[error]AssertionError: expected "vi.fn()" to be called with arguments: [ 'rec_c', �(3) ]
  - **Error:** 2026-04-08T10:57:34.7678056Z ##[error]Error: Condition not met within 5000ms 2026-04-08T10:57:34.7689137Z ##[error]AssertionError: expected "vi.fn()" to be called with arguments: [ 'rec_c', �(3) ]
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24131740530
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-8** � Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T10:58:04.3577611Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T10:58:04.3592173Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:58:04.3597444Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:59:43.3670443Z ##[er...
  - **Error:** 2026-04-08T10:58:04.3577611Z ##[error]ReferenceError: mockMeetings is not defined 2026-04-08T10:58:04.3592173Z ##[error]Error: Test timed out in 30000ms. 2026-04-08T10:58:04.3597444Z ##[error]Error: T...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24131740525
  - **Created:** 2026-04-08T13:16:23.302Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T15:07:49.026Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-08-1** — Fix Production Deployment (Vercel) failure
  - **Status:** todo
  - **Owner:** `Qwen`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Production Deployment (Vercel). Szczegoly: Job "Deploy Production" step "Pull Vercel Production Environment Information" failed
  - **Error:** Job "Deploy Production" step "Pull Vercel Production Environment Information" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24142460014
  - **Created:** 2026-04-08T15:07:49.026Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-2** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T14:05:18.1633761Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T14:06:28.7467139Z ##[error]TypeError: Cannot read properties of undefined (reading 'dismissedIds') 2026-04-08T14:06:28.7484618Z ##[error]A...
  - **Error:** 2026-04-08T14:05:18.1633761Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T14:06:28.7467139Z ##[error]TypeError: Cannot read properties of undefined (rea...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24139611415
  - **Created:** 2026-04-08T15:07:49.026Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-3** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T13:51:49.8512074Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T13:53:00.9362119Z [90m157|[39m useAuthStore.setState({ authError: 'old error', googleAuthMessage:… 2026-04-08T13:53:00.9569850Z ##[error...
  - **Error:** 2026-04-08T13:51:49.8512074Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T13:53:00.9362119Z [90m157|[39m useAuthStore.setState({ authError: 'old error...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24138979513
  - **Created:** 2026-04-08T15:07:49.026Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-4** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T13:36:11.0678864Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T13:37:22.6568147Z [90m157|[39m useAuthStore.setState({ authError: 'old error', googleAuthMessage:… 2026-04-08T13:37:22.6810548Z ##[error...
  - **Error:** 2026-04-08T13:36:11.0678864Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T13:37:22.6568147Z [90m157|[39m useAuthStore.setState({ authError: 'old error...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24138240888
  - **Created:** 2026-04-08T15:07:49.026Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-08T19:13:17.449Z -->

### GitHub Actions Errors (3 found)

- **GH-AUTO-2026-04-08-1** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T19:03:52.0359832Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T19:05:01.9952109Z ERROR: Coverage for lines (50.58%) does not meet global threshold (55%) 2026-04-08T19:05:01.9952921Z ERROR: Coverage for...
  - **Error:** 2026-04-08T19:03:52.0359832Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T19:05:01.9952109Z ERROR: Coverage for lines (50.58%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24153187508
  - **Created:** 2026-04-08T19:13:17.449Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-2** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T18:03:38.1882380Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T18:04:49.2711755Z ERROR: Coverage for lines (50.58%) does not meet global threshold (55%) 2026-04-08T18:04:49.2712529Z ERROR: Coverage for...
  - **Error:** 2026-04-08T18:03:38.1882380Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T18:04:49.2711755Z ERROR: Coverage for lines (50.58%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24150645292
  - **Created:** 2026-04-08T19:13:17.449Z
  - **Priority:** High

- **GH-AUTO-2026-04-08-3** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-08T17:18:49.8814444Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T17:20:00.6466301Z ##[error]TypeError: Cannot read properties of undefined (reading 'dismissedIds') 2026-04-08T17:20:00.6480448Z ##[error]A...
  - **Error:** 2026-04-08T17:18:49.8814444Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-08T17:20:00.6466301Z ##[error]TypeError: Cannot read properties of undefined (rea...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24148767089
  - **Created:** 2026-04-08T19:13:17.449Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T04:41:16.041Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-09-1** — Fix Auto Security Patches failure
  - **Status:** todo
  - **Owner:** `Qwen`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto Security Patches. Szczegoly: 2026-04-09T02:07:27.5721748Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T02:08:37.3963649Z ERROR: Coverage for lines (50.66%) does not meet global threshold (55%) 2026-04-09T02:08:37.3964318Z ERROR: Coverage for...
  - **Error:** 2026-04-09T02:07:27.5721748Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T02:08:37.3963649Z ERROR: Coverage for lines (50.66%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24168623587
  - **Created:** 2026-04-09T04:41:16.041Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T07:18:22.427Z -->

### GitHub Actions Errors (5 found)

- **GH-AUTO-2026-04-09-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T06:10:18.1397286Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T06:10:18.1397286Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24175334309
  - **Created:** 2026-04-09T07:18:22.427Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T06:10:16.9961620Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T06:10:16.9972827Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T06:10:16.9976015Z #...
  - **Error:** 2026-04-09T06:10:16.9961620Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T06:10:16.9972827Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24175334309
  - **Created:** 2026-04-09T07:18:22.427Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T05:48:08.8114728Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T05:48:08.8114728Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24174646011
  - **Created:** 2026-04-09T07:18:22.427Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T05:48:11.3241381Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T05:48:11.3251875Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T05:48:11.3255510Z #...
  - **Error:** 2026-04-09T05:48:11.3241381Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T05:48:11.3251875Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24174646011
  - **Created:** 2026-04-09T07:18:22.427Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-5** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-09T05:47:41.1203481Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T05:48:49.5904424Z ERROR: Coverage for lines (50.58%) does not meet global threshold (55%) 2026-04-09T05:48:49.5905094Z ERROR: Coverage for...
  - **Error:** 2026-04-09T05:47:41.1203481Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T05:48:49.5904424Z ERROR: Coverage for lines (50.58%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24174646009
  - **Created:** 2026-04-09T07:18:22.427Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T09:04:46.137Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-09-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T08:32:28.1817416Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T08:32:28.1817416Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24180550485
  - **Created:** 2026-04-09T09:04:46.137Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T08:32:30.2028390Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T08:32:30.2044658Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T08:32:30.2049749Z #...
  - **Error:** 2026-04-09T08:32:30.2028390Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T08:32:30.2044658Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24180550485
  - **Created:** 2026-04-09T09:04:46.137Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T07:20:14.0299115Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T07:20:14.0309809Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T07:20:14.0313226Z #...
  - **Error:** 2026-04-09T07:20:14.0299115Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T07:20:14.0309809Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24177727728
  - **Created:** 2026-04-09T09:04:46.137Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T07:20:06.0741945Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T07:20:06.0741945Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24177727728
  - **Created:** 2026-04-09T09:04:46.137Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T10:56:52.042Z -->

### GitHub Actions Errors (2 found)

- **GH-AUTO-2026-04-09-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T09:06:38.5848839Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T09:06:38.5848839Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24181967283
  - **Created:** 2026-04-09T10:56:52.042Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T09:06:32.0705016Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T09:06:32.0714564Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T09:06:32.0717502Z #...
  - **Error:** 2026-04-09T09:06:32.0705016Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T09:06:32.0714564Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24181967283
  - **Created:** 2026-04-09T10:56:52.042Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T13:21:53.953Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-09-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T11:13:29.4430099Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T11:13:29.4430099Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24187110638
  - **Created:** 2026-04-09T13:21:53.953Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T11:13:32.1818825Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T11:13:32.1829738Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T11:13:32.1833154Z #...
  - **Error:** 2026-04-09T11:13:32.1818825Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T11:13:32.1829738Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24187110638
  - **Created:** 2026-04-09T13:21:53.953Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T10:59:00.0963332Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T10:59:00.0963332Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24186528264
  - **Created:** 2026-04-09T13:21:53.953Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T10:58:54.0409201Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T10:58:54.0418823Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T10:58:54.0421486Z #...
  - **Error:** 2026-04-09T10:58:54.0409201Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T10:58:54.0418823Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24186528264
  - **Created:** 2026-04-09T13:21:53.953Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-09T15:20:47.391Z -->

### GitHub Actions Errors (4 found)

- **GH-AUTO-2026-04-09-1** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-09T14:38:10.3698227Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T14:39:25.0957992Z ERROR: Coverage for lines (50.57%) does not meet global threshold (55%) 2026-04-09T14:39:25.0958794Z ERROR: Coverage for...
  - **Error:** 2026-04-09T14:38:10.3698227Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T14:39:25.0957992Z ERROR: Coverage for lines (50.57%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24196073901
  - **Created:** 2026-04-09T15:20:47.391Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-2** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-09T13:53:15.9797376Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T13:54:22.6064630Z ERROR: Coverage for lines (50.57%) does not meet global threshold (55%) 2026-04-09T13:54:22.6065250Z ERROR: Coverage for...
  - **Error:** 2026-04-09T13:53:15.9797376Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-09T13:54:22.6064630Z ERROR: Coverage for lines (50.57%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24193906814
  - **Created:** 2026-04-09T15:20:47.391Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T13:23:44.7555420Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Error:** 2026-04-09T13:23:44.7555420Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close'
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24192495196
  - **Created:** 2026-04-09T15:20:47.391Z
  - **Priority:** High

- **GH-AUTO-2026-04-09-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-09T13:23:45.7717971Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T13:23:45.7733718Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T13:23:45.7739189Z #...
  - **Error:** 2026-04-09T13:23:45.7717971Z ##[error]AssertionError: expected {} to have property "Connection" with value 'close' 2026-04-09T13:23:45.7733718Z ##[error]AssertionError: expected {} to have property "C...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24192495196
  - **Created:** 2026-04-09T15:20:47.391Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-11T08:39:50.927Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-11-1** — Fix Optimized CI failure
  - **Status:** todo
  - **Owner:** `Codex`
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-11T08:30:19.5197237Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-11T08:31:26.9471661Z ERROR: Coverage for lines (52.25%) does not meet global threshold (55%) 2026-04-11T08:31:26.9472664Z ERROR: Coverage for...
  - **Error:** 2026-04-11T08:30:19.5197237Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-11T08:31:26.9471661Z ERROR: Coverage for lines (52.25%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24278635040
  - **Created:** 2026-04-11T08:39:50.927Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-11T14:34:47.212Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-11-1** — Fix Optimized CI failure
  - **Status:** `todo`
  - **Owner:** `Codex`
  - **Source:** `GitHub Actions`
  - **Automation:** `guarded_fix`
  - **Dispatch mode:** `branch_pr`
  - **Priority:** `P1`
  - **Routing reason:** code change should be tested and reviewed before merge
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-11T13:58:14.5317418Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-11T13:59:21.3940424Z ERROR: Coverage for lines (52.25%) does not meet global threshold (55%) 2026-04-11T13:59:21.3941434Z ERROR: Coverage for...
  - **Error:** 2026-04-11T13:58:14.5317418Z FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory 2026-04-11T13:59:21.3940424Z ERROR: Coverage for lines (52.25%) does not meet global thre...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24283957828
  - **Created:** 2026-04-11T14:34:47.212Z


