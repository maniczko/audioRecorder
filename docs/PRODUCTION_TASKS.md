# AudioRecorder / VoiceLog OS - zadania do realizacji

Data: 2026-06-20

Cel: jedna czytelna lista zadan potrzebnych do doprowadzenia projektu do stabilnego publicznego wydania produkcyjnego.

Zasady:

- Jedno zadanie = jeden logiczny PR albo commit.
- Kazda poprawka buga ma test regresji.
- Nie zmieniac logiki biznesowej przy okazji prac layout/security.
- Przed publikacja przejsc release gate z konca dokumentu.
- Ten plik jest robocza lista wykonawcza; GitHub Issues moga byc zrodlem prawdy dla autopilota.

Legenda:

- `[ ]` do zrobienia
- `[~]` w toku / czesciowo gotowe
- `[x]` gotowe lokalnie

## Najblizszy sprint

### 1. P0 - domknac kosztowe endpointy poza `/ai/*`

Status: `[x]`

Cel: zaden endpoint STT/LLM/RAG/analyze/embedding/image nie moze dzialac anonimowo, bez membership albo bez limitow kosztu.

Zakres:

- [x] Dodac testy `403` dla workspace/recording membership dla kosztowych endpointow.
- [x] Dopiac membership check w trasach, ktore jeszcze opieraja sie tylko na sesji.
- [x] Dodac rate limit/cost guard dla kosztowych endpointow poza `/ai/*`, gdzie go brakuje.
- [x] Uaktualnic `docs/COSTLY_ENDPOINTS_SECURITY_AUDIT.md`.

Pliki:

- `server/routes/media.ts`
- `server/routes/workspaces.ts`
- `server/routes/ai.ts`
- `server/tests/routes/costly-endpoints-auth.test.ts`
- `docs/COSTLY_ENDPOINTS_SECURITY_AUDIT.md`

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false
pnpm run test:server:retry
pnpm run typecheck:all
```

Kryteria akceptacji:

- Anonymous request do kazdego kosztowego endpointu zwraca `401`.
- Request do workspace bez membership zwraca `403`.
- Przekroczenie guard/rate limit zwraca `429`.
- Testy nie loguja transkryptow ani danych wrazliwych.

### 2. P0 - statusy transkrypcji w Studio i Nagraniach

Status: `[~]`

Cel: uzytkownik ma jednoznacznie widziec, czy transkrypcja trwa, jest pusta, zakonczona bledem, czy gotowa.

Zakres:

- [~] Wprowadzic jeden model statusu: `no_audio`, `uploading`, `uploaded`, `transcribing`, `ready`, `empty`, `failed`.
- [x] Nie pokazywac samego komunikatu `Brak transkrypcji`, gdy job jeszcze trwa.
- [x] Dodac diagnostyke dla pustego transcriptu.
- [x] Dodac retry transkrypcji z loading/error state.
- [~] Ujednolicic status w Studio detail i liscie Nagran.

Pliki:

- `src/studio/StudioMeetingView.tsx`
- `src/RecordingsTab.tsx`
- `src/components/RecordingPipelineStatus.tsx`
- `src/lib/recordingQueue.ts`
- `src/store/recorderQueueProcessor.ts`

Walidacja:

```bash
pnpm exec vitest run src/studio/StudioMeetingView.test.tsx src/RecordingsTab.test.tsx src/components/RecordingPipelineStatus.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

Kryteria akceptacji:

- Panel transkrypcji pokazuje aktywny stan przetwarzania.
- Pusty transcript ma jasne wyjasnienie i nastepna akcje.
- Retry nie dubluje jobow bez potrzeby.

### 3. P1 - formularz zadan i relacje many-to-many

Status: `[~]`

Cel: tworzenie, podglad i edycja zadania korzystaja z jednego modelu formularza, a zadanie moze miec wiele osob i tagow.

Zakres:

- [x] Ujednolicic formularz dodawania i podgladu zadania.
- [x] Naprawic wybor osoby i tagu w modalu.
- [x] Dodac mozliwosc przypisania kilku osob.
- [ ] Dodac test regresji dla multi-select osob.
- [ ] Zweryfikowac kontrakt danych: `assigneeIds` vs pojedyncze `personId`.
- [ ] Doprecyzowac chipy: kontrast, focus, remove action, empty state.
- [ ] Potwierdzic dzialanie z zakladki Zadania i ze Studio.

Pliki:

- `src/tasks/TaskCreateForm.tsx`
- `src/tasks/TaskDetailsPanel.tsx`
- `src/lib/tasks.ts`
- `src/shared/contracts.ts`
- `src/lib/tasks.coverage.test.ts`
- `src/shared/contracts.test.ts`

Walidacja:

```bash
pnpm exec vitest run src/lib/tasks.coverage.test.ts src/shared/contracts.test.ts --coverage.enabled=false
pnpm run typecheck:all
```

Kryteria akceptacji:

- Zadanie moze miec kilka przypisanych osob.
- Multi-select dziala myszka i klawiatura.
- Stare zadania z pojedynczym `personId` nadal sie wyswietlaja.

### 4. P1 - szczegoly osob jako osobny ekran

Status: `[~]`

Cel: lista osob nie pokazuje prawego preview panelu; klikniecie osoby prowadzi do szczegolow z zarzadzaniem.

Zakres:

- [x] Usunac prawy preview panel z listy osob.
- [x] Klikniecie osoby przenosi do szczegolow.
- [x] Dodac akcje zarzadzania, edycji i usuwania w szczegolach.
- [ ] Dodac test nawigacji lista osob -> szczegoly osoby.
- [ ] Dodac test delete person z confirm/error state.
- [ ] Sprawdzic responsive dla 1024, 768 i 390 px.

Pliki:

- `src/PeopleTab.tsx`
- `src/ProfileTab.tsx`
- `src/lib/people.ts`
- `src/hooks/usePeopleProfiles.ts`

Walidacja:

```bash
pnpm exec vitest run src/ProfileTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

Kryteria akceptacji:

- Lista osob ma jeden glowny focus: katalog.
- Szczegoly osoby sa miejscem edycji/usuwania/zarzadzania profilem AI.
- Mobile nie pokazuje scisnietych kolumn ani ukrytych akcji.

## P0 - blokery produkcyjne

### P0-1. Production smoke audio end-to-end

Status: `[x]`

Cel: automatyczny smoke ma potwierdzic, ze po deployu dziala health, auth, upload audio, transkrypcja, download i retry.

Gotowe:

- [x] Komenda `pnpm run release:audio-prod-smoke`.
- [x] Raport JSON.
- [x] Sprawdzenie `/health`.
- [x] Sprawdzenie `supabaseRemote`.
- [x] Login testowy.
- [x] Upload fixture audio.
- [x] Start transkrypcji i polling.
- [x] Download audio.
- [x] Retry-transcribe path.

Walidacja:

```bash
pnpm exec vitest run -c vitest.scripts.config.ts scripts/audio-prod-smoke.test.ts
pnpm run release:audio-prod-smoke
```

### P0-2. Widocznosc nowych nagran

Status: `[x]`

Cel: nowe nagranie pojawia sie na liscie nagran natychmiast po utworzeniu, nawet przed pelna synchronizacja backendu.

Gotowe:

- [x] Scalanie rekordow z lokalnej kolejki i backendu.
- [x] Statusy: `Wgrywanie`, `Wgrane`, `Transkrypcja`, `Gotowe`, `Brak mowy`, `Blad`.
- [x] Deduplikacja placeholdera lokalnego i rekordu backendowego.
- [x] Retry/refresh dla nieudanych albo zawieszonych uploadow.
- [x] Playwright smoke lokalnej kolejki.

Walidacja:

```bash
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx src/components/RecordingPipelineStatus.test.tsx --coverage.enabled=false
pnpm exec playwright test tests/e2e/recordings-queue-smoke.spec.ts --project=chromium
```

### P0-3. Trwale limity kosztow `/ai/*`

Status: `[x]`

Cel: endpointy `/ai/*` maja auth, membership, rate limit i quota odporna na wiele instancji.

Gotowe:

- [x] Auth na calym `/ai/*`.
- [x] Membership check dla workspace/meeting.
- [x] Limity per user, workspace, IP i endpoint.
- [x] `AiQuotaStore` z DB-backed storage i memory fallback.
- [x] Test quota wspoldzielonej przez dwie instancje.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/lib/aiQuotaStore.test.ts server/tests/routes/ai.test.ts --coverage.enabled=false
```

### P0-4. Auth Google idToken

Status: `[x]`

Cel: `/auth/google` nie ufa profilowi wyslanemu z klienta, tylko weryfikuje Google `idToken` po stronie backendu.

Gotowe:

- [x] Weryfikacja tokena po stronie serwera.
- [x] Sprawdzenie `aud`, `iss`, `exp`, `email_verified`.
- [x] Sesja tworzona dopiero z verified payload.
- [x] Testy braku tokena, falszywego tokena i payloadu bez tokena.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/auth-extended.test.ts server/tests/lib/googleIdToken.test.ts --coverage.enabled=false
```

## P1 - dane, storage i operacje

### P1-1. Data retention i pelne delete recording

Status: `[x]`

Cel: usuniecie nagrania usuwa wszystkie powiazane dane i obiekty storage.

Gotowe:

- [x] `retentionDays` dla workspace.
- [x] Cleanup `media_assets`.
- [x] Cleanup audio file w Supabase/local storage.
- [x] Cleanup transcript payload, part transcripts, RAG/vector rows.
- [x] Audit log deletion.
- [x] Job cleanup dla retencji.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/database.test.ts server/tests/lib/periodicCleanup.test.ts server/tests/routes/media.test.ts --coverage.enabled=false
```

### P1-2. CORS, tokeny i SSE hardening

Status: `[x]`

Cel: produkcja odrzuca query token, uzywa scislego CORS i krotkotrwalych progress tokenow.

Gotowe:

- [x] `?token=` odrzucany w `NODE_ENV=production`.
- [x] Progress token z TTL.
- [x] Progress token przypiety do `recordingId`.
- [x] Production CORS bez wildcard z credentials.
- [x] Vercel preview tylko za flaga.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/app-security.test.ts server/tests/middleware.test.ts server/tests/serverUtils.test.ts --coverage.enabled=false
```

### P1-3. Node 22 runtime

Status: `[x]`

Cel: local, CI i produkcja uzywaja Node 22.

Gotowe:

- [x] `.nvmrc` / `.node-version` / `engines`.
- [x] Test walidacji runtime.
- [x] Dokumentacja instalacji Node 22.

Walidacja:

```bash
node -v
pnpm run typecheck:all
```

## P2 - jakosc produktu i utrzymanie

### P2-1. UTF-8 / mojibake clean

Status: `[ ]`

Zakres:

- [ ] Uruchomic `pnpm run audit:mojibake`.
- [ ] Naprawic user-facing copy z uszkodzonymi polskimi znakami.
- [ ] Zostawic allowlist tylko dla uzasadnionych false positives.

Walidacja:

```bash
pnpm run audit:mojibake
```

### P2-2. Porzadek w artefaktach screenshotow

Status: `[ ]`

Zakres:

- [ ] Przeniesc wartosciowe baseline screenshots do `docs/audits/screenshots/`.
- [ ] Usunac/przeniesc przypadkowe PNG z root repo.
- [ ] Dopisac workflow screenshot evidence.
- [ ] Zaktualizowac `.gitignore`, jesli trzeba.

Walidacja:

```bash
git status --short
```

### P2-3. UI primitives i redukcja lokalnych CSS override

Status: `[ ]`

Zakres:

- [ ] Ustandaryzowac button/input/select/checkbox/card/table/modal.
- [ ] Zapewnic `cursor: pointer`, hover, focus-visible i disabled state.
- [ ] Stopniowo podmieniac lokalne style bez zmiany logiki.

Walidacja:

```bash
pnpm run lint:css
pnpm run typecheck:all
```

## Release gate

Przed wypchnieciem na produkcje:

- [ ] `pnpm run audit:mojibake`
- [ ] `pnpm run typecheck:all`
- [ ] `pnpm run lint:all`
- [ ] `pnpm run test:server:retry`
- [ ] `pnpm run test:frontend:ci` albo udokumentowany shard CI
- [ ] `pnpm run build`
- [ ] `pnpm run release:audio-prod-smoke`
- [ ] Smoke UI na `http://localhost:3000`
- [ ] Raport zmian: pliki, testy, ryzyka, runtime frontend/backend

## Kolejnosc wykonania

1. Domknac P0 kosztowych endpointow poza `/ai/*`.
2. Domknac statusy transkrypcji w Studio i Nagraniach.
3. Dodac brakujace testy formularza zadan i People details.
4. Uruchomic pelny release gate.
5. Posprzatac artefakty screenshotow i dokumenty pomocnicze.
