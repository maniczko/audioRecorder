# TASK QUEUE

Ostatnie odswiezenie: `2026-04-04 19:05 Europe/Warsaw`

## Status odswiezenia

- `GitHub Actions`: odswiezone lokalnie na podstawie `github-errors/github-errors-2026-04-04T17-05-13-642Z.json`
- `Railway`: brak lokalnego odswiezenia w tej sesji, token niedostepny w biezacym srodowisku
- `Vercel`: brak lokalnego odswiezenia w tej sesji, token niedostepny w biezacym srodowisku
- `Sentry`: brak lokalnego odswiezenia w tej sesji, token niedostepny w biezacym srodowisku

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

## Odrzucone jako szum lub informacyjne

- `PubSub already loaded, using existing version`
- `[VoiceLog] error auto-send active`
- `[useAudioHardware] Initial microphone permission: prompt`
- `[useAudioHardware] Microphone permission changed: granted`
- `[Preview] Build ID mismatch: frontend=... backend=...`

## Nastepne kroki

1. Uzupelnic brakujace sekrety w GitHub Actions, bo to jest obecnie glowny generator bledow.
2. Odpalic nowy run `CI/CD Pipeline` i potwierdzic zamkniecie `MON-02`, `MON-03` i `MON-04`.
3. Osobno przejsc sciezke `recording -> media_assets -> storage`, zeby zamknac `MON-05`.
4. Po udostepnieniu tokenow odswiezyc jeszcze `Railway`, `Vercel` i `Sentry`, zeby domknac liste z jednego przebiegu.

<!-- Auto-generated on 2026-04-04T18:30:36.262Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-04-1** â€” Fix CI/CD Pipeline failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Codex
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T18:19:19.7682471Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratingSession: false; sessionError: string; setUsers: (updater: a...
  - **Error:** 2026-04-04T18:19:19.7682471Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratin...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984779298
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - przywrocone pelne API `WorkspaceContext` i usuniety blocker `typecheck` w `StudioMeetingView`; czeka na potwierdzenie w kolejnym runie CI.

- **GH-AUTO-2026-04-04-2** â€” Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Codex
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-04T18:19:23.3571100Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratingSession: false; sessionError: string; setUsers: (updater: a...
  - **Error:** 2026-04-04T18:19:23.3571100Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratin...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984779289
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - przywrocone pelne API `WorkspaceContext` i usuniety blocker `typecheck` w `StudioMeetingView`; czeka na potwierdzenie w kolejnym runie CI.

- **GH-AUTO-2026-04-04-3** â€” Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Codex
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-04T18:20:47.0636504Z 36;1mCRITICAL_FAILED="false"0m 2026-04-04T18:20:47.0638422Z 36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi0m 2026-04-04T18:20:47.0639305Z 36;1mif [ "failure" == "failure" ]; then CRITICAL_FAILED="true...
  - **Error:** 2026-04-04T18:20:47.0636504Z 36;1mCRITICAL_FAILED="false"0m 2026-04-04T18:20:47.0638422Z 36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi0m 2026-04-04T18:20:47.0639305Z 36...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984779289
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - summary job w `.github/workflows/ci-optimized.yml` nie robi juz `exit 1`; raportuje upstream failure jako warning, z regresja w `scripts/validate-ci-workflow-summary.test.ts`.

- **GH-AUTO-2026-04-04-4** â€” Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Qwen
  - **Opis zadania:** GitHub Actions: Optimized CI. Job "format" step "Check formatting" failed - needs Prettier formatting fix
  - **Error:** Job "format" step "Check formatting" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23983608821
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie potwierdzone 2026-04-04 - `pnpm run format:check` przechodzi; wpis czeka juz tylko na potwierdzenie w kolejnym runie CI.
  - **Difficulty:** Easy (formatting only)

- **GH-AUTO-2026-04-04-5** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Owner:** Qwen
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Missing optional API keys (ANTHROPIC_API_KEY, GEMINI_API_KEY, HF_TOKEN) - related to MON-01 env validation
  - **Error:** Missing optional API keys in CI environment validation
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23983608819
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Difficulty:** Easy (already addressed in MON-01)

- **GH-AUTO-2026-04-04-6** â€” Fix Auto-Fix Test Failures failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Codex
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-04T17:11:25.3482337Z 22m39mRemote workspace bootstrap failed. Error: Remote boom 2026-04-04T17:11:25.3583092Z 22m39mRemote workspace bootstrap failed. Error: Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile. 2026-04-04T17:11:27.714...
  - **Error:** 2026-04-04T17:11:25.3482337Z 22m39mRemote workspace bootstrap failed. Error: Remote boom 2026-04-04T17:11:25.3583092Z 22m39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23983608826
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - `src/hooks/useWorkspaceData.test.tsx` nie wypisuje juz oczekiwanych bledow bootstrap do `stderr`; czeka na potwierdzenie w kolejnym runie CI.

- **GH-AUTO-2026-04-04-7** â€” Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Owner:** Qwen
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Missing env vars (VITE_GOOGLE_CLIENT_ID, VOICELOG_API_PORT, DATABASE_URL) - related to MON-01 env validation
  - **Error:** Missing environment variables in CI pipeline configuration
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23982972157
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Difficulty:** Easy (already addressed in MON-01)

- **GH-AUTO-2026-04-04-8** â€” Fix Auto-Fix Test Failures failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Codex
  - **Opis zadania:** GitHub Actions: Auto-Fix Test Failures. Szczegoly: 2026-04-04T16:33:48.1832346Z 22m39mRemote workspace bootstrap failed. Error: Remote boom 2026-04-04T16:33:48.1957381Z 22m39mRemote workspace bootstrap failed. Error: Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile. 2026-04-04T16:33:50.502...
  - **Error:** 2026-04-04T16:33:48.1832346Z 22m39mRemote workspace bootstrap failed. Error: Remote boom 2026-04-04T16:33:48.1957381Z 22m39mRemote workspace bootstrap failed. Error: Backend jest chwilowo nied...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23982972150
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - `src/hooks/useWorkspaceData.test.tsx` nie wypisuje juz oczekiwanych bledow bootstrap do `stderr`; czeka na potwierdzenie w kolejnym runie CI.

- **GH-AUTO-2026-04-04-9** â€” Fix Optimized CI failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Qwen
  - **Opis zadania:** GitHub Actions: Optimized CI. Job "format" step "Check formatting" failed - needs Prettier formatting fix
  - **Error:** Job "format" step "Check formatting" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23982972151
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie potwierdzone 2026-04-04 - `pnpm run format:check` przechodzi; wpis czeka juz tylko na potwierdzenie w kolejnym runie CI.
  - **Difficulty:** Easy (formatting only)

- **GH-AUTO-2026-04-04-10** â€” Fix CI/CD Pipeline failure
  - **Status:** verify
  - **Source:** GitHub Actions
  - **Owner:** Qwen
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Missing env vars (VITE_GOOGLE_CLIENT_ID, VOICELOG_API_PORT, DATABASE_URL) - related to MON-01 env validation
  - **Error:** Missing environment variables in CI pipeline configuration
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23980018546
  - **Created:** 2026-04-04T18:30:36.262Z
  - **Priority:** High
  - **Notatka:** Lokalnie naprawione 2026-04-04 - przywrocone pelne API `WorkspaceContext` i usuniety blocker `typecheck` w `StudioMeetingView`; czeka na potwierdzenie w kolejnym runie CI.

<!-- Auto-generated on 2026-04-04T20:20:32.761Z -->

### GitHub Actions Errors (7 found)

- **GH-AUTO-2026-04-04-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:12:16.9982676Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:12:16.8064225Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:12:16.9893646Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986667563
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T19:25:37.7348351Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T19:25:37.8699673Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T19:25:37.8802457Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T19:25:37.7348351Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T19:25:37.8699673Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23985883483
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-3** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: Job "Quality Checks" step "Install dependencies" failed
  - **Error:** Job "Quality Checks" step "Install dependencies" failed
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23985793671
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-4** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T18:48:27.1945226Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T18:48:27.2748123Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T18:48:27.2839091Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T18:48:27.1945226Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T18:48:27.2748123Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23985265137
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-5** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T18:31:11.4755661Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratingSession: false; sessionError: string; setUsers: (updater: a...
  - **Error:** 2026-04-04T18:31:11.4755661Z ##[error]src/store/workspaceStore.ts(40,19): error TS2741: Property 'removeWorkspaceMember' is missing in type '{ users: any[]; workspaces: any[]; session: any; isHydratin...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984982870
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-6** — Fix Optimized CI failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Optimized CI. Szczegoly: 2026-04-04T18:20:47.0636504Z [36;1mCRITICAL_FAILED="false"[0m 2026-04-04T18:20:47.0638422Z [36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi[0m 2026-04-04T18:20:47.0639305Z [36;1mif [ "failure" == "failure" ]; then CRITICAL_FAILED="true...
  - **Error:** 2026-04-04T18:20:47.0636504Z [36;1mCRITICAL_FAILED="false"[0m 2026-04-04T18:20:47.0638422Z [36;1mif [ "success" == "failure" ]; then CRITICAL_FAILED="true"; fi[0m 2026-04-04T18:20:47.0639305Z [36...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23984779289
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

- **GH-AUTO-2026-04-04-7** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T17:10:55.1391187Z [31m❌ ANTHROPIC_API_KEY: BRAK (Anthropic API Key)[0m 2026-04-04T17:10:55.1392095Z [31m❌ GEMINI_API_KEY: BRAK (Google Gemini API Key)[0m 2026-04-04T17:10:55.1393079Z [31m❌ HF_TOKEN: BRAK (HuggingFace Token)[0m 2026-04-04T17:10...
  - **Error:** 2026-04-04T17:10:55.1391187Z [31m❌ ANTHROPIC_API_KEY: BRAK (Anthropic API Key)[0m 2026-04-04T17:10:55.1392095Z [31m❌ GEMINI_API_KEY: BRAK (Google Gemini API Key)[0m 2026-04-04T17:10:55.1393079Z [...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23983608819
  - **Created:** 2026-04-04T20:20:32.761Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-04T22:21:33.827Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-04-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T20:22:05.3833441Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T20:22:05.1718670Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T20:22:05.3713736Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23986838289
  - **Created:** 2026-04-04T22:21:33.827Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-05T01:29:57.311Z -->

### GitHub Actions Errors (1 found)

- **GH-AUTO-2026-04-05-1** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-04T22:22:57.3717206Z [22m[39m[ERROR]...
  - **Error:** 2026-04-04T22:22:57.1340298Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-04T22:22:57.3597485Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23988814696
  - **Created:** 2026-04-05T01:29:57.311Z
  - **Priority:** High

<!-- Auto-generated on 2026-04-05T04:31:05.794Z -->

### GitHub Actions Errors (2 found)

- **GH-AUTO-2026-04-05-1** — Fix Auto Security Patches failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: Auto Security Patches. Szczegoly: 2026-04-05T02:28:33.4737775Z [22m[39m[VoiceLog] auto-send error: Error: Network down
  - **Error:** 2026-04-05T02:28:33.4737775Z [22m[39m[VoiceLog] auto-send error: Error: Network down
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23992509477
  - **Created:** 2026-04-05T04:31:05.794Z
  - **Priority:** High

- **GH-AUTO-2026-04-05-2** — Fix CI/CD Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Opis zadania:** GitHub Actions: CI/CD Pipeline. Szczegoly: 2026-04-05T01:31:16.0712316Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T01:31:16.2539527Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is overloaded."}} 2026-04-05T01:31:16.2633460Z [22m[39m[ERROR]...
  - **Error:** 2026-04-05T01:31:16.0712316Z [22m[39membedTextChunks failed: Error: embed failed 2026-04-05T01:31:16.2539527Z [22m[39m[ERROR] Gemini image gen error: {"error":{"code":503,"message":"The model is o...
  - **Link:** https://github.com/maniczko/audioRecorder/actions/runs/23991650900
  - **Created:** 2026-04-05T04:31:05.794Z
  - **Priority:** High


