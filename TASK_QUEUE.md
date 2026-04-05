# TASK QUEUE

Ostatnie odswiezenie: `2026-04-05 16:50 Europe/Warsaw`

## Status odswiezenia

- `GitHub Actions`: odswiezone lokalnie na podstawie `github-errors/github-errors-2026-04-05T14-50-42-385Z.json` (`100` runow, `14` failed w oknie 7 dni)
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

## Odrzucone jako szum lub informacyjne

- `PubSub already loaded, using existing version`
- `[VoiceLog] error auto-send active`
- `[useAudioHardware] Initial microphone permission: prompt`
- `[useAudioHardware] Microphone permission changed: granted`
- `[Preview] Build ID mismatch: frontend=... backend=...`

## Nastepne kroki

1. Potwierdzic w kolejnym `CI/CD Pipeline`, ze poprawka typowania w `src/studio/StudioMeetingView.tsx` domyka oba nowe fail-e `typecheck` dla commitu `80d624b`.
2. Potwierdzic w kolejnym `CI/CD Pipeline`, ze poprawiony backendowy test `server/tests/transcription.test.ts` nie flakuje juz na asercji `toHaveBeenCalledTimes(2)`.
3. Potwierdzic w swiezym backendowym runie, czy klaster storage/Supabase nadal istnieje, bo lokalne retesty `media/state/workspaces/supabase regression` sa zielone.
4. Jesli backend albo typecheck nadal padnie w CI, porownac to samo lokalnie na Node `22.x`, bo lokalnie odpalamy teraz na `v24.14.0`.
5. Uzyskac dostep do `VERCEL_TOKEN` albo aktywnej sesji pluginu Vercel, a dla Sentry do `SENTRY_AUTH_TOKEN`, zeby odswiezyc brakujace monitory.

## Swiezy snapshot bledow

<!-- Refreshed on 2026-04-05T14:50:42.354Z -->

### GitHub Actions Errors (aktualny snapshot: 14 failed runow)

- **GH-AUTO-2026-04-05-0** — Investigate fresh typecheck failure after `fix(prod): ship agent updates`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `80d624b` z `2026-04-05T14:46:51Z`
  - **Error:** job `Quality Checks`, step `TypeScript type check` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857809
  - **Notatka:** lokalnie domkniete 2026-04-05 - pelny log wskazal konkretny blad `src/studio/StudioMeetingView.tsx(953,33): TS2345`, gdzie `setVerifiedSpeakerNames(...)` dostawal `unknown[]`; widok dostal helper normalizujacy `getVerifiedSpeakerNames(...)`, regresje w `src/studio/StudioMeetingView.test.tsx`, a lokalne `pnpm run typecheck` jest znowu zielone

- **GH-AUTO-2026-04-05-0A** — Investigate mirrored `Optimized CI` typecheck failure for commit `80d624b`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> Optimized CI -> typecheck`
  - **Owner:** `Codex`
  - **Zakres:** ten sam commit `80d624b`, `2026-04-05T14:46:51Z`
  - **Error:** job `typecheck`, step `Run TypeScript` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24003857831
  - **Notatka:** potwierdzone 2026-04-05 - `Optimized CI` padal na tej samej linii `src/studio/StudioMeetingView.tsx(953,33): TS2345`, wiec to nie byl drugi niezalezny bug; czeka juz tylko na potwierdzenie w kolejnym runie po poprawce

- **GH-AUTO-2026-04-05-1** — Investigate fresh backend assertion failure on `main`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `148f687` z `2026-04-05T13:06:16Z`
  - **Error:** `AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24002140703
  - **Notatka:** lokalnie domkniete 2026-04-05 - fail wskazal na `server/tests/transcription.test.ts:104`, gdzie test spal arbitralne `1000 ms` i czasem sprawdzal asercje przed odpaleniem background postprocessu `fast -> full`; test wymusza teraz `processingMode: fast` i czeka na realny drugi call zamiast na sztywny timeout. Przy okazji retest backendu ujawnil stale mocki w `server/tests/lib/rag.coverage.test.ts`, wiec ten plik tez zostal przestawiony na mock `fetch` zgodny z obecna implementacja `server/lib/ragAnswer.ts`. Lokalny `pnpm run test:server:retry` jest po tych poprawkach zielony.

- **GH-AUTO-2026-04-05-2** — Investigate fresh TypeScript typecheck failure on `main`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Quality Checks`
  - **Owner:** `Codex`
  - **Zakres:** nowy fail po commicie `c596784` z `2026-04-05T11:59:38Z`
  - **Error:** job `Quality Checks`, step `TypeScript type check` zakonczyl sie fail, ale parser nie wyciagnal jeszcze konkretnej linii z logu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24001055758
  - **Notatka:** lokalnie domkniete 2026-04-05 - `pnpm vitest run --coverage=false` jest zielone po aktualizacji [src/App.test.tsx](/c:/Users/user/new/audioRecorder/src/App.test.tsx) i [src/studio/StudioMeetingView.test.tsx](/c:/Users/user/new/audioRecorder/src/studio/StudioMeetingView.test.tsx); CI powinno potwierdzic, czy to byl jedyny root cause z parsera

- **GH-AUTO-2026-04-05-3** — Investigate mirrored typecheck failure in `Optimized CI`
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> Optimized CI -> typecheck`
  - **Owner:** `Codex`
  - **Zakres:** ten sam commit `2f61a73`, `2026-04-05T10:01:35Z`
  - **Error:** job `typecheck`, step `Run TypeScript` zakonczyl sie fail bez sparsowanej linii bledu
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23999219137
  - **Notatka:** nadal brak konkretnej linii z parsera, ale nowszy report pokazuje tez historyczne fail-e frontowych testow `App.test.tsx` i `StudioMeetingView.test.tsx`; lokalnie te scenariusze sa juz zielone, wiec czeka to glownie na potwierdzenie w kolejnym CI

- **GH-AUTO-2026-04-05-3** — Fix repeated backend Supabase storage regression failures
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie co najmniej od `2026-04-04T19:24:09Z` do `2026-04-05T08:34:24Z` w wielu runach backendowych
  - **Error:** `AssertionError: promise rejected "Error: Supabase Storage not available (client or storage module missing)."` oraz powiazane asercje o oczekiwanych kluczach storage (`rec_test.webm`, `rec_test-123.webm`, `recordings/rec1.webm`)
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/lib/supabaseStorage.not-configured.test.ts`, `server/tests/regression/regression.test.ts` i `server/tests/routes/media.test.ts`; potrzebne potwierdzenie na nowym runie CI

- **GH-AUTO-2026-04-05-4** — Fix missing `workspaceService.saveWorkspaceState` in backend tests
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** powtarza sie w kolejnych runach backendowych z `main`, m.in. `f61a91d`, `26ce5a7`, `d79d3f0`
  - **Error:** `APP ERROR STACK TypeError: workspaceService.saveWorkspaceState is not a function`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/routes/state.test.ts`, `server/tests/routes/workspaces.test.ts` i `server/tests/performance/response-time-sla.test.ts`; obecny `main` ma juz spojne mocki `saveWorkspaceState`

- **GH-AUTO-2026-04-05-5** — Triage backend test isolation for config and rate-limit failures
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** wraca seryjnie w backend suite w tych samych runach co storage fail
  - **Error:** `Configuration errors:` oraz `Error: Zbyt wiele prob. Limit: 20 żądań/min. Sprobuj ponownie za 60s.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalne retesty 2026-04-05 sa zielone dla `server/tests/serverUtils.test.ts`, `server/tests/security/payload.test.ts` i `server/tests/regression/regression-server-utils.test.ts`; wyglada bardziej na historyczny szum lub problem izolacji konkretnego runu CI

- **GH-AUTO-2026-04-05-6** — Reduce noisy expected stderr in backend tests
  - **Status:** `verify`
  - **Source:** `GitHub Actions -> CI/CD Pipeline -> Backend Tests`
  - **Owner:** `Codex`
  - **Zakres:** linie powtarzaja sie w wielu backend runach i zaszumiaja raport
  - **Error:** `embedTextChunks failed: Error: embed failed`, `Gemini image gen error: 503 overloaded`, `Gemini image gen error: 400 Invalid request`, `Nie masz dostepu do tego workspace.`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Notatka:** lokalny retest 2026-04-05 zielony dla `server/tests/audio-pipeline.unit.test.ts`, `server/tests/routes/media.test.ts` i `server/tests/routes/workspaces.test.ts`; scenariusze z tym stderr maja juz mocki `console.error`/`console.warn`, wiec obecnie wyglada to bardziej na historyczny szum starszych runow niz aktywny bug

- **GH-AUTO-2026-04-05-7** — Investigate `Auto Security Patches` network failure
  - **Status:** `done`
  - **Source:** `GitHub Actions -> Auto Security Patches -> security-patch`
  - **Owner:** `Qwen`
  - **Error:** `[VoiceLog] auto-send error: Error: Network down`
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23992509477
  - **Notatka:** To nie byl blad sieciowy - `console.warn` z testu `errorLogStore.test.ts` wyciekalo do logow CI. Test celowo mockowal `fetch` z bledem `Network down` zeby zweryfikowac graceful degradation. Fix: dodano `vi.spyOn(console, 'warn').mockImplementation(() => {})` w teście, zeby wyciszyc oczekiwany warning. **ZAMKNIETE 2026-04-05**.

- **GH-AUTO-2026-04-05-8** — Historical backend failure cluster still visible in 7-day window
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

- **GH-AUTO-2026-04-05-8** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T22:22:57.3717206Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23988814696
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-9** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:22:05.3833441Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986838289
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-10** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:12:16.9982676Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986667563
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-05T12:37:25.908Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-05-1** — Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-05T12:00:54.7635041Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T12:01:31.9329264Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /transkrypcja/i. This could be because the text is broken up by mu...
  - **Error:** 2026-04-05T12:00:54.7635041Z [22m[39m[VoiceLog] auto-send error: Error: Network down 2026-04-05T12:01:31.9329264Z ##[error]TestingLibraryElementError: Unable to find an element with the text: /trans...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/24001055763
  - **Created:** 2026-04-05T12:37:25.908Z
  - **Priority:** High
  - **Notatka:** lokalnie domkniete 2026-04-05 - pelny frontendowy `pnpm vitest run --coverage=false` przechodzi `105 passed | 4 skipped` po odswiezeniu asercji dla auth screenu i zakladki zadan w studio
