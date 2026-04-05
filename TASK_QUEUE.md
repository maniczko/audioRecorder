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

<!-- Auto-generated on 2026-04-05T10:24:57.855Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-05-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Quality Checks" step "TypeScript type check" failed
  - **Error:** Job "Quality Checks" step "TypeScript type check" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23999219132
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-2** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: Job "typecheck" step "Run TypeScript" failed
  - **Error:** Job "typecheck" step "Run TypeScript" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23999219137
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T08:35:33.5768743Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T08:35:33.7422086Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-05T08:35:33.7512216Z [22m[39m[ERROR]...
  - **Error:** 2026-04-05T08:35:33.5768743Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T08:35:33.7422086Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23997859088
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T06:57:53.2159190Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T06:57:53.4086649Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-05T06:57:53.4251083Z [22m[39m[ERROR]...
  - **Error:** 2026-04-05T06:57:53.2159190Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T06:57:53.4086649Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23996372344
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-5** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T04:32:28.8946949Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T04:32:29.1010294Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-05T04:32:29.1134740Z [22m[39m[ERROR]...
  - **Error:** 2026-04-05T04:32:28.8946949Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T04:32:29.1010294Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23994268683
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-6** — Fix Auto Security Patches failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto Security Patches. Szczegoly: 2026-04-05T02:28:33.4737775Z [22m[39m[VoiceLog] auto-send error: Error: Network down
  - **Error:** 2026-04-05T02:28:33.4737775Z [22m[39m[VoiceLog] auto-send error: Error: Network down
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23992509477
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-7** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T01:31:16.0712316Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T01:31:16.2539527Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-05T01:31:16.2633460Z [22m[39m[ERROR]...
  - **Error:** 2026-04-05T01:31:16.0712316Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T01:31:16.2539527Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23991650900
  - **Created:** 2026-04-05T10:24:57.855Z
  - **Priority:** High

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


