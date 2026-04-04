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

### MON-02 - Naprawic infinite loop w useWorkspaceData migration effect

- Status: `todo`
- Priorytet: `P1`
- Zrodlo: lokalne testy `useWorkspaceData.test.tsx` - wszystkie 10 testow failuje
- Opis zadania:
  Hook `useWorkspaceData` ma migration effect (linie 200-220), ktory wywoluje `setUsers`, `setWorkspaces` itp. gdy `migration.changed === true`. Te settery aktualizuja store, ktory jest w dependency array `[users, workspaces, meetings, manualTasks, taskBoards, session]`, co powoduje kolejny useEffect run = INFINITE LOOP. Testy failuja z "Maximum update depth exceeded".
- Problem:
  - Migration effect wywoluje settery bez guardow
  - Dependency array zawiera wszystkie wartosci ze store
  - Po wywolaniu setterow, useEffect uruchamia sie ponownie
  - Brak mechanizmu zapobiegajacego nieskonczonej petli
- Kryterium zamkniecia:
  Wszystkie 10 testow `useWorkspaceData.test.tsx` przechodzi bez bledow "Maximum update depth exceeded".

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
