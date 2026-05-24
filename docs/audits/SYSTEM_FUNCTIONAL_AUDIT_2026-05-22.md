# Audyt Produkcyjny: Każda Zakładka / Każde Kliknięcie

Data: 2026-05-22  
Środowisko: produkcja, `https://voicelog-audiorecorder.vercel.app`  
Audytowany SHA: `082cdbcb42c6a4b2d52d64cd4d4bc6a2b2c1ae01`  
Decyzja jakościowa: **CONDITIONAL**  
Ocena system functional gate: **7.4/10**

## Executive Summary

Produkcja jest obecnie wdrożona i zdrowa: `/health` zwraca `ok`, `db=connected`, `supabaseRemote=true`, backend ma znany `gitSha`, a GitHub workflow produkcyjny przeszedł smoke i Sentry release health bez nowych blokujących issues.

Nie ma potwierdzonego P0 typu crash, brak wejścia do aplikacji, 500 na głównej ścieżce albo awaria Railway. Jest jednak istotna luka jakościowa: obecne automaty nie są jeszcze pełnym, realnym audytem każdej zakładki i każdego kliknięcia w produkcji. Część testów działa na seedowanym lokalnym stanie, więc potrafi przejść bez prawdziwego backendowego zapisu, usunięcia, refreshu i weryfikacji trwałości danych.

Najważniejszy wynik: **production smoke jest zielony, ale visual production gate jest czerwony**, a action inventory nadal nie jest pełnym production click crawlerem.

## Evidence

Artefakty lokalne:

- `reports/system-audit/2026-05-22/commands-and-results.md`
- `reports/system-audit/2026-05-22/endpoint-contract.json`
- `reports/system-audit/2026-05-22/github-production-evidence.json`
- `reports/system-audit/2026-05-22/visual-failures/`

GitHub evidence:

- Production Deployment (Vercel): `26299147779`, success
- Backend Production Smoke: `26299147708`, success
- Production SHA: `082cdbc`
- Sentry release health in GitHub workflow: `0` blocking issues

Endpoint contract probes:

| Endpoint                                                             | Wynik | Ocena                                                               |
| -------------------------------------------------------------------- | ----: | ------------------------------------------------------------------- |
| `GET /health`                                                        | `200` | OK: DB connected, Supabase remote, known gitSha, premium STT policy |
| `POST /auth/login` invalid                                           | `401` | OK: nie ma regresji 500 dla błędnych danych                         |
| `POST /ai/suggest-tasks`                                             | `200` | OK: Vercel rewrite `/ai/*` działa                                   |
| `GET /voice-profiles` anonymous                                      | `401` | OK: chroniony endpoint                                              |
| `GET /media/recordings/audit_missing_recording/transcribe` anonymous | `401` | OK: auth guard przed stale asset handling                           |

## Gates Run

Komendy uruchamiane na Node 22 przez `npx -y -p node@22 -p pnpm@9.12.1`.

| Gate                                                  |         Wynik | Interpretacja                                                                      |
| ----------------------------------------------------- | ------------: | ---------------------------------------------------------------------------------- |
| `pnpm run test:workflows`                             | PASS, 120/120 | Workflow/config guard jest zielony                                                 |
| `PLAYWRIGHT_BASE_URL=prod pnpm run test:ui-actions`   |     PASS, 3/3 | Sprawdza podstawowe kontrakty UI, ale nie pełne zapisy produkcyjne                 |
| `PLAYWRIGHT_BASE_URL=prod pnpm run test:e2e:release`  |   PASS, 11/11 | Release journeys przechodzą, lecz część używa seedowanego stanu                    |
| `PLAYWRIGHT_BASE_URL=prod pnpm run test:visual:check` |   FAIL, 13/14 | Bramka produkcyjna nie jest skalibrowana: auth baseline drift + 401 z fake tokenów |
| local default `pnpm run test:visual:check`            |   PASS, 14/14 | Baseline lokalny jest spójny                                                       |
| `pnpm run audit:a11y:ci`                              |   PASS, 0/0/0 | A11y gate czysty                                                                   |
| GitHub `release:prod-smoke:strict`                    |          PASS | Realne secrets, upload smoke, stale recording, voice profile smoke                 |
| GitHub `sentry:release-health`                        |          PASS | Brak nowych P0/P1 w release health                                                 |

## Tab / Action Matrix

| Obszar                    | Obecna automatyzacja                              | Luka                                                                                             |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Auth login/register/reset | Smoke + visual local + endpoint probe             | Brak produkcyjnego visual baseline z prawdziwym storage state                                    |
| Studio                    | Release journeys + UI action contracts            | Brak pełnego production click-through: wszystkie dropdowny, speaker rename, voice sample, player |
| Nagrania                  | Release journey reachability                      | Brak realnego delete -> refresh -> nie wraca dla produkcji                                       |
| Kalendarz                 | Navigation coverage                               | Brak create/edit/delete event w production test workspace                                        |
| Zadania                   | Smoke task add                                    | Brak pełnego edit/status/delete + refresh                                                        |
| Osoby                     | Navigation coverage                               | Brak create/edit/delete person + profile link checks                                             |
| Notatki                   | Navigation coverage                               | Brak create/edit/delete note + persistence                                                       |
| Profile                   | Unit/UI coverage + production voice profile smoke | Brak pełnego UI flow: speaker assignment -> sample -> profile refresh -> quality row             |
| Command Palette           | Advanced journey                                  | Brak inventory wszystkich komend i efektów biznesowych                                           |
| Notification Center       | Action contract basics                            | Brak testu pusty/pełny stan + dismiss/read                                                       |

## Findings

### P1-01: Production visual gate fails on production URL

Ekran: auth + authenticated shell  
Viewporty: `1440`, `1280`, `1024`, `768`, `390`  
Reprodukcja:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://voicelog-audiorecorder.vercel.app'
npx -y -p node@22 -p pnpm@9.12.1 pnpm run test:visual:check
```

Wynik: `13 failed / 1 passed`.

Przyczyna: test uruchomiony przeciw produkcji używa lokalnie seedowanego auth/workspace state. UI próbuje komunikować się z realnym backendem z nieważnym tokenem, co generuje 401 w konsoli. Dodatkowo auth screenshot ma drift wysokości baseline. Lokalny visual gate przechodzi, więc problemem jest **brak osobnej produkcyjnej konfiguracji visual z realnym storage state**, nie tylko layout.

Missing regression:

- `tests/e2e/production-visual-authenticated.spec.ts`
- Komenda: `pnpm run test:e2e:production-visual`
- Wymaganie: storage state z `PRODUCTION_SMOKE_AUTH_TOKEN`, brak fake tokenów, fail na każdy nieallowlistowany 4xx/5xx.

### P1-02: UI action inventory nie jest jeszcze pełnym click crawlerem

Ekran: wszystkie główne widoki  
Obecnie `test:ui-actions` przechodzi, ale ma tylko 3 testy i sprawdza głównie dostępność nazw, podstawowe feedback surfaces oraz wybrane kontrolki transkryptu. Nie wykonuje jeszcze pełnej macierzy: create/edit/delete/refresh dla każdej zakładki.

Missing regression:

- `tests/e2e/ui-actions/production-action-crawler.spec.ts`
- `scripts/audit-ui-action-coverage.mjs`
- Wymaganie: każdy widoczny enabled button/menuitem/tab ma przypisany `interactionContractId`, expected outcome i network allowlist.

### P1-03: Production smoke nadal raportuje `persistenceEvidenceChecked:false`

Obecny GitHub strict smoke ma realne `audioUploadChecked:true`, `staleRecordingChecked:true`, `voiceProfileChecked:true`, ale nadal nie domyka osobnego dowodu persistence po redeploy/restart.

Missing regression:

- `tests/e2e/production-persistence.spec.ts`
- Komenda: `pnpm run release:prod-smoke:strict`
- Wymaganie: upload testowego audio -> asset remote exists -> refresh -> backend health/evidence confirms remote path -> opcjonalnie redeploy/restart evidence.

### P1-04: Krytyczne skipy nadal obniżają zaufanie

W repo nadal są skipy w obszarach audio pipeline, critical flows, Supabase storage, E2E critical flows, Studio task actions i visual legacy. Najgroźniejsze dla tego celu:

- `tests/e2e/critical-flows.spec.js`
- `server/tests/audio-pipeline.unit.test.ts`
- `server/tests/lib/supabaseStorage.test.ts`
- `src/services/mediaService.test.ts` remote mode
- `src/studio/StudioMeetingView.test.tsx` task action flows

Missing regression:

- `pnpm run test:skips:audit` powinien rozróżniać skipy krytyczne i failować bez issue, właściciela i daty wygaśnięcia.

### P1-05: Produkcyjny audyt kliknięć wymaga realnego tokena, więc nie powinien być odpalany lokalnym seedem

Lokalnie brakuje wartości sekretów produkcyjnych. GitHub ma sekrety, więc prawdziwy production click audit powinien być workflow dispatch albo scheduled workflow, nie zwykły lokalny Playwright z fake state.

Missing regression:

- `.github/workflows/production-system-audit.yml`
- Wymaganie: workflow failuje, jeśli brakuje `PRODUCTION_SMOKE_AUTH_TOKEN`, `PRODUCTION_SMOKE_WORKSPACE_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

### P2-01: Console hygiene nadal wymaga twardego runtime guardu

GitHub Sentry jest czysty, ale ręczne produkcyjne scenariusze wcześniej pokazywały `404`, `424`, `Build ID mismatch` i resource errors. Same techniczne wpisy z DevTools nie zawsze oznaczają brak obsługi UI, ale w produkcie premium powinny być albo allowlistowane i uzasadnione, albo blokujące.

Missing regression:

- `tests/e2e/production-console-guard.spec.ts`
- Wymaganie: po każdej akcji `page.on('console')` i `page.on('response')` zbiera błędy; fail dla nieallowlistowanych `4xx/5xx`.

## Root Cause Synthesis

Dlaczego takie błędy przechodziły:

1. Testy lokalne i produkcyjne były mieszane. Lokalne Playwrighty potrafią przejść na seedowanym Zustand/localStorage bez realnego backendu.
2. Produkcyjny smoke był zbyt wąski: upload, stale recording i voice profile smoke są dobre, ale nie obejmują każdej zakładki i wszystkich async kliknięć.
3. Action inventory sprawdza istnienie i podstawowe feedback states, nie pełny efekt biznesowy po refreshu.
4. Visual gate jest poprawny lokalnie, ale nie ma osobnej wersji produkcyjnej z prawdziwą sesją.
5. Skipy w krytycznych flow tworzą fałszywe poczucie kompletności.

## Systemic Fix

### 1. Dodać produkcyjny workflow audytu systemowego

Nowy workflow:

- `.github/workflows/production-system-audit.yml`
- Uruchamiany po deployu i ręcznie przez `workflow_dispatch`
- Node 22
- Secrets required:
  - `PRODUCTION_SMOKE_AUTH_TOKEN`
  - `PRODUCTION_SMOKE_WORKSPACE_ID`
  - `PRODUCTION_SMOKE_MEETING_ID`
  - `PRODUCTION_SMOKE_VOICE_PROFILE_RECORDING_ID`
  - `PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_ID`
  - `PRODUCTION_SMOKE_VOICE_PROFILE_SPEAKER_NAME`
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`

### 2. Dodać production storage state

Zamiast fake `e2e-token`:

- `tests/e2e/helpers/productionAuthState.ts`
- zapisuje realny token z secretu do storage state
- ustawia test workspace
- nie drukuje tokena
- failuje, jeśli token/workspace nie są ustawione

### 3. Rozszerzyć action inventory do interaction contracts

Dla każdej akcji:

- `screen`
- `selector/accessibility role`
- `expected feedback`
- `expected network`
- `expected persisted state`
- `cleanup action`
- `allowlisted errors`

### 4. Dodać full product journeys

Minimalny zestaw przed 9/10:

- Studio: rename speaker -> create voice sample -> profile refresh
- Studio: new speaker -> modal/name required -> no auto-save without name
- Studio: player visible and controls work
- Recordings: delete test recording -> refresh -> deleted item does not return
- Tasks: create/edit/complete/delete -> refresh
- Notes: create/edit/delete -> refresh
- People: create/edit/delete -> refresh
- Calendar: create/edit/delete test event -> refresh
- Command Palette: each listed command navigates or shows feedback
- Notification Center: mark read/dismiss state persists

## Release Quality Decision

**CONDITIONAL**, not full premium.

Można testować produkcję pod linkiem, bo najważniejsze health/deploy/Sentry/upload smoke są zielone. Nie można jeszcze uznać, że każda zakładka i każde kliknięcie są w pełni zabezpieczone automatycznie. Do standardu premium trzeba przenieść pełny click-through na GitHub workflow z realnymi sekretami i dodać brakujące testy zapisu/usuwania/refreshu.

## Top 10 Next Tests

1. `production-action-crawler.spec.ts`: każde enabled button/menu/tab ma outcome i brak nieallowlistowanego `4xx/5xx`.
2. `production-visual-authenticated.spec.ts`: visual baseline produkcji z realnym storage state.
3. `studio-voice-profile-production.spec.ts`: speaker assignment -> voice sample -> profile quality row.
4. `studio-new-speaker.spec.ts`: `Nowy mówca` wymaga nazwy i nie zapisuje profilu automatycznie.
5. `recordings-delete-persistence.spec.ts`: delete -> success -> refresh -> nie wraca.
6. `tasks-crud-persistence.spec.ts`: create/edit/complete/delete -> refresh.
7. `notes-crud-persistence.spec.ts`: create/edit/delete -> refresh.
8. `people-crud-persistence.spec.ts`: create/edit/delete -> refresh.
9. `calendar-crud-persistence.spec.ts`: create/edit/delete -> refresh.
10. `production-console-guard.spec.ts`: fail na nieallowlistowane console errors i network `4xx/5xx`.

## Review

Mocne strony:

- Produkcja jest wdrożona z tym samym SHA i znanym backend `gitSha`.
- `/ai/*` rewrite działa po ostatniej poprawce.
- Strict smoke i Sentry release health w GitHub są zielone.
- A11y gate jest czysty.
- Lokalny visual baseline jest zielony.

Słabe strony:

- Produkcyjny visual check z realnym URL jest czerwony.
- Pełny audyt kliknięć nie jest jeszcze workflowm z sekretami produkcyjnymi.
- Część testów krytycznych nadal jest skipowana.
- `persistenceEvidenceChecked:false` zostawia lukę w dowodzie Supabase persistence po redeploy/restart.

Rekomendacja:

Najbliższa iteracja powinna być test-first i bez redesignu: dodać `production-system-audit` workflow, production storage state, action crawler i pierwsze 5 pełnych CRUD/journey testów. Dopiero po zielonym przebiegu tej bramki ocena może realistycznie wzrosnąć do `9/10`.

## Update 2026-05-24

Zamknięte po audycie:

- Dodano `.github/workflows/production-system-audit.yml`.
- Dodano `pnpm run test:e2e:production-system`.
- Dodano `tests/e2e/production-system-audit.spec.js` z real-auth production session bootstrap.
- Krytyczne akcje UI mają teraz `interactionContract`: feedback, network, persistence i target command.
- Production system audit obejmuje pierwszy realny persistence scenario: `audit_20260524_` task write -> bootstrap verify -> delete via `removeIds` -> bootstrap verify that it does not return after refresh.

Nowe evidence:

- Node 22 targeted release/workflow tests: `41/41` passed.
- Node 22 `pnpm run test:workflows`: `123/123` passed.
- Node 22 production-system Playwright local syntax check: `3 skipped` bez sekretów, zgodnie z założeniem. W GitHub workflow `PRODUCTION_SYSTEM_AUDIT_REQUIRED=true`, więc brak sekretów będzie failure, nie skip.

Pozostałe do 9/10:

- Dodać produkcyjne CRUD/persistence scenariusze dla Notes, People, Calendar i Recordings delete.
- Dodać pełny Studio voice-profile UI journey przez prawdziwy backend, nie tylko endpoint smoke.
- Utrzymać osobny production visual baseline z realnym storage state, aby nie mieszać fake tokenów z produkcją.
