# AudioRecorder / VoiceLog OS - zadania produkcyjne

Data: 2026-06-20

Cel: rozpisac prace potrzebne do publicznego wydania produkcyjnego w formie zadan do realizacji, walidacji i domkniecia w PR-ach.

Zasada pracy: jedno zadanie = jedna mala zmiana, testy regresji, walidacja lokalna, bez przypadkowej zmiany logiki biznesowej.

## Release verification notes - 2026-06-23

Ten dokument jest aktualnym skrótem hardeningu produkcyjnego. Szczególowy backlog kolejnych prac jest w `docs/VOICELOG_NEXT_TASKS.md`.

### Security and auth

- `/auth/google` nie ufa juz profilowi z klienta. Backend wymaga Google `idToken` i weryfikuje `aud`, `iss`, `exp` oraz `email_verified`.
- `/ai/*` wymaga autoryzacji, workspace membership, rate limitow i quota per user/workspace/IP/endpoint.
- Kosztowe endpointy poza `/ai/*` maja testy anonymous `401` i membership `403` tam, gdzie dotyczy STT/LLM/RAG/analyze/image generation.
- Query token w produkcji jest odrzucony. SSE/progress uzywa `Authorization: Bearer`,
  `X-Progress-Token` albo same-site cookie; krotkotrwaly progress token jest przypisany
  do `recordingId` i nie powinien trafiac do URL.
- Production CORS nie pozwala na wildcard z credentials; allowlista pochodzi z `VOICELOG_ALLOWED_ORIGINS`.

### Audio and data retention

- Upload audio uzywa streaming tempfile path zamiast pelnego `arrayBuffer` dla glownego PUT audio endpointu.
- Production smoke `release:audio-prod-smoke` sprawdza health, Supabase remote, auth, upload, transcribe, polling, persisted/empty transcript, download i retry-transcribe.
- `deleteMediaAsset` usuwa audio storage, `media_assets`, transcript payload references, RAG rows i zapisuje `recording.deleted` w `audit_logs`.
- Manualny `DELETE /media/recordings/:recordingId` przekazuje `session.user_id` jako audit actor.
- Workspace ma `retentionDays`, a periodic cleanup korzysta z tego samego delete flow.

### Required release environment

- Runtime: Node 22.x.
- Required frontend/API origin allowlist: `VOICELOG_ALLOWED_ORIGINS`.
- Optional preview origins: `VOICELOG_ALLOW_VERCEL_PREVIEWS=true` tylko swiadomie.
- Smoke: `VOICELOG_SMOKE_BASE_URL`, `VOICELOG_SMOKE_WORKSPACE_ID` oraz `VOICELOG_SMOKE_TOKEN` albo `VOICELOG_SMOKE_EMAIL` + `VOICELOG_SMOKE_PASSWORD`.
- STT/LLM provider keys musza byc obecne tylko po stronie backendu; sekretow nie wolno wystawiac do klienta.

### Known release risks

- Lokalna maszyna moze raportowac Node `24.x`; finalny gate nalezy uruchomic na Node 22.x.
- Pelny `release:audio-prod-smoke` wymaga prawdziwego smoke usera i workspace membership. Bez tych envow raport konczy sie kontrolowanym failure.
- `docs/automation/TASK_DONE.md` zawiera historyczne mojibake i nie jest release-critical UI/API surface. `pnpm run audit:mojibake` obejmuje krytyczne powierzchnie i przechodzi.

### Minimum verification command set

```bash
pnpm run audit:mojibake
pnpm run typecheck:all
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/lib/periodicCleanup.test.ts server/tests/database.test.ts --coverage.enabled=false
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/ai.test.ts server/tests/routes/costly-endpoints-auth.test.ts server/tests/lib/aiQuotaStore.test.ts --coverage.enabled=false
pnpm exec vitest run -c vitest.scripts.config.ts scripts/audio-prod-smoke.test.ts
pnpm run release:audio-prod-smoke
```

## Status legend

- `[ ]` Do zrobienia
- `[~]` W toku / czesciowo wdrozone
- `[x]` Gotowe lokalnie

## Najblizszy plan prac

Kolejnosc ponizej jest rekomendowana do dalszej realizacji. Kazdy punkt powinien byc osobnym PR-em albo osobnym logicznym commitem, z testem regresji i jasna walidacja.

### 1. Domknac P0-2: widocznosc nowych nagran

Cel: nowe nagranie ma byc widoczne na liscie nagran natychmiast po utworzeniu, z czytelnym statusem przetwarzania.

Zakres:

- [x] Dodac Playwright smoke: Studio -> Nagrania z lokalnym rekordem kolejki.
- [x] Potwierdzic, ze rekord z lokalnej kolejki jest widoczny przed synchronizacja backendu.
- [x] Potwierdzic, ze rekord z backendu nie duplikuje lokalnego placeholdera.
- [x] Dodac stan UI dla zawieszonego uploadu.
- [x] Dodac akcje retry/refresh dla nieudanego albo zawieszonego uploadu.
- [x] Sprawdzic filtry/statusy, zeby rekord nie znikal po transkrypcji.

Walidacja:

```bash
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm exec playwright test tests/e2e/recordings*.spec.ts
pnpm run typecheck:all
```

### 2. Domknac P0-4: kosztowe endpointy poza `/ai/*`

Cel: zaden endpoint generujacy koszt STT/LLM/RAG/analyze nie moze dzialac anonimowo ani poza workspace membership.

Zakres:

- [x] Rozszerzyc testy `403` dla workspace/recording membership.
- [x] Dodac rate-limit/cost guard dla kosztowych endpointow poza `/ai/*`, gdzie brakuje wspolnego mechanizmu.
- [x] Uaktualnic raport `docs/COSTLY_ENDPOINTS_SECURITY_AUDIT.md`.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false
pnpm run test:server:retry
pnpm run typecheck:all
```

### 3. Poprawic statusy transkrypcji w Studio i Nagraniach

Cel: uzytkownik ma widziec, czy transkrypcja trwa, jest pusta, zakonczyla sie bledem, czy jest gotowa.

Zakres:

- [~] Wprowadzic jeden model statusu transkrypcji dla Studio i listy Nagran.
- [x] Nie pokazywac pustego `Brak transkrypcji`, gdy job jeszcze trwa.
- [x] Dodac czytelna diagnostyke dla pustego transcriptu.
- [x] Dodac retry transkrypcji z loading/error state.

Walidacja:

```bash
pnpm exec vitest run src/studio/StudioMeetingView.test.tsx src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### 4. Domknac formularze zadan i relacje many-to-many

Cel: tworzenie, podglad i edycja zadania uzywaja jednego formularza, a zadanie moze miec kilka osob i kilka tagow.

Zakres:

- [ ] Dodac test regresji dla multi-select osob.
- [ ] Zweryfikowac kontrakt danych: `assigneeIds` / `personId` / kompatybilnosc wsteczna.
- [ ] Doprecyzowac UX chipow: kontrast, focus, remove action, empty state.
- [ ] Potwierdzic dzialanie formularza z zakladki Zadania i ze Studio.

Walidacja:

```bash
pnpm exec vitest run src/lib/tasks.coverage.test.ts src/shared/contracts.test.ts --coverage.enabled=false
pnpm run typecheck:all
```

### 5. Domknac szczegoly osob

Cel: lista osob nie ma prawego preview panelu, a zarzadzanie rekordem odbywa sie na ekranie szczegolow osoby.

Zakres:

- [ ] Dodac test nawigacji lista osob -> szczegoly osoby.
- [ ] Dodac test usuwania osoby z confirm/error state.
- [ ] Sprawdzic responsive dla 1024, 768 i 390 px.

Walidacja:

```bash
pnpm exec vitest run src/PeopleTab.test.tsx src/ProfileTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### 6. Release gate przed publikacja

Cel: przed wypchnieciem na produkcje potwierdzic security, audio pipeline, UI smoke i build.

Walidacja:

```bash
pnpm run audit:mojibake
pnpm run typecheck:all
pnpm run lint:all
pnpm run test:server:retry
pnpm run test:frontend:ci
pnpm run build
pnpm run release:audio-prod-smoke
```

## P0 - blokery produkcyjne

### P0-1. Production smoke audio end-to-end

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Dodac skrypt `release:audio-prod-smoke`.
- [x] Sprawdzac `/health`.
- [x] Potwierdzac `supabaseRemote: true`.
- [x] Obslugiwac logowanie testowe.
- [x] Wgrywac krotki fixture audio.
- [x] Uruchamiac transkrypcje.
- [x] Polling statusu do `done`, `empty` albo `failed`.
- [x] Raportowac transcript persisted albo kontrolowany empty transcript.
- [x] Sprawdzac download audio.
- [x] Sprawdzac retry-transcribe.
- [x] Generowac raport JSON.

Walidacja:

```bash
pnpm exec vitest run -c vitest.scripts.config.ts scripts/audio-prod-smoke.test.ts
pnpm run release:audio-prod-smoke
pnpm run test:server:retry
```

Kryteria akceptacji:

- Smoke dziala bez recznych klikniec.
- Raport JSON zawiera statusy krokow, requestId i diagnostyke.
- Smoke nie loguje sekretow ani pelnych transkryptow.

### P0-2. Stabilizacja widocznosci nowych nagran

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Scalac rekordy z lokalnej kolejki i backendu na liscie nagran.
- [x] Pokazywac statusy: `Wgrywanie`, `Wgrane`, `Transkrypcja`, `Gotowe`, `Brak mowy`, `Blad`.
- [x] Dodac test listy nagran dla lokalnej kolejki.
- [x] Dodac Playwright smoke: Studio -> Nagrania z lokalnym rekordem kolejki.
- [x] Doprecyzowac UX odswiezania statusu po uploadzie.
- [x] Dodac retry/refresh dla nieudanych lub zawieszonych uploadow.
- [x] Sprawdzic, czy po transkrypcji rekord nie znika przez filtr/status.

Walidacja:

```bash
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

Kryteria akceptacji:

- Nowe nagranie pojawia sie na liscie bez reloadu strony.
- Uzytkownik widzi jasny status przetwarzania.
- Brak transkrypcji nie wyglada jak znikniecie nagrania.

### P0-3. Trwale limity kosztow AI

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Dodac `AiQuotaStore`.
- [x] Dodac memory fallback dla local/test.
- [x] Dodac DB-backed quota store dla srodowisk z DB.
- [x] Zachowac limity per user, workspace, IP i endpoint.
- [x] Dodac test wspoldzielonej quota miedzy instancjami aplikacji.
- [x] Zwracac `429` i `Retry-After` po przekroczeniu limitu.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/lib/aiQuotaStore.test.ts server/tests/routes/ai.test.ts --coverage.enabled=false
pnpm run test:server:retry
pnpm run typecheck:all
```

Kryteria akceptacji:

- Limity dzialaja poza pamiecia pojedynczego procesu.
- Dwie instancje korzystaja ze wspolnego licznika.
- Limity sa konfigurowalne envami.

### P0-4. Audit kosztowych endpointow

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Zidentyfikowac kosztowe endpointy poza `/ai/*`.
- [x] Dodac test anonymous = `401` dla endpointow STT/LLM/analyze/RAG.
- [x] Dodac raport audytu.
- [x] Rozszerzyc testy `403` dla workspace/recording membership tam, gdzie brakuje pokrycia.
- [x] Dodac rate-limit/cost guard dla kosztowych endpointow poza `/ai/*`, jesli jeszcze nie korzystaja ze wspolnego mechanizmu.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false
pnpm run test:server:retry
```

Kryteria akceptacji:

- Zaden kosztowy endpoint nie dziala anonimowo.
- Raport zawiera liste endpointow i dowody testowe.

## P1 - security, dane i operacje

### P1-1. Data retention i pelne delete recording

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Zmapowac wszystkie tabele powiazane z nagraniem: `media_assets`, transcript payload w manifest JSON, vector/RAG rows w `rag_chunks`.
- [x] Sprawdzic obecny przeplyw `DELETE /media/recordings/:recordingId`.
- [x] Dodac test RED: delete usuwa storage object mock.
- [x] Rozszerzyc `deleteMediaAsset` o cleanup powiazanych rekordow RAG.
- [x] Dodac audit log deletion bez zapisywania tresci transcriptu.
- [x] Dodac workspace setting `retentionDays`.
- [x] Dodac job cleanup dla retencji.
- [x] Dodac test braku osieroconych transcript/vector rows.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts --coverage.enabled=false
pnpm run test:server:retry
pnpm run typecheck:all
```

Kryteria akceptacji:

- Usuniecie nagrania usuwa plik audio z Supabase/local storage.
- Nie zostaja osierocone dane transcript/vector/job.
- Operacja jest audytowana.

### P1-2. CORS, tokeny i SSE hardening

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Odrzucac `?token=` w `NODE_ENV=production`.
- [x] Dodac progress token z TTL.
- [x] Przypisac progress token do `recordingId`.
- [x] Utwardzic production CORS.
- [x] Dodac test expiry progress tokenu w scenariuszu SSE.
- [x] Dodac test allowed/disallowed origin z credentials.
- [x] Uzupelnic dokumentacje envow CORS.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/middleware.test.ts server/tests/serverUtils.test.ts --coverage.enabled=false
pnpm run test:server:retry
```

Kryteria akceptacji:

- Query token w produkcji jest odrzucony.
- Bearer token dziala.
- Progress token dziala tylko dla danego nagrania i wygasa.
- Wildcard CORS nie dziala z credentials w produkcji.

### P1-3. Node 22 jako runtime produkcyjny

Status: `[x]` Gotowe lokalnie.

Zadania:

- [x] Sprawdzic `.nvmrc`, `.node-version`, `package.json engines`.
- [x] Sprawdzic konfiguracje CI/Vercel/Railway.
- [x] Ujednolicic runtime na Node 22.
- [x] Udokumentowac instalacje i wymagany runtime.
- [x] Dodac szybka walidacje runtime w smoke albo preflight.

Walidacja:

```bash
node -v
pnpm install --frozen-lockfile
pnpm run typecheck:all
```

Kryteria akceptacji:

- CI i produkcja uzywaja Node 22.
- `pnpm install` nie ostrzega w docelowym runtime.

## P2 - UX produkcyjny i obserwowalnosc

### P2-1. Transkrypcja i statusy nagran

Status: `[~]` Czesciowo wdrozone lokalnie.

Zadania:

- [~] Rozroznic statusy: brak audio, audio wgrywane, audio gotowe, transkrypcja w toku, transkrypcja pusta, transkrypcja failed.
- [x] Pokazac diagnostyke, gdy transkrypcja jest pusta.
- [x] Dodac retry transkrypcji z czytelnym stanem loading/error.
- [x] Upewnic sie, ze UI nie pokazuje `Brak transkrypcji` podczas aktywnego przetwarzania.
- [x] Dodac test komponentu widoku szczegolow nagrania.

Walidacja:

```bash
pnpm exec vitest run src/studio/StudioMeetingView.test.tsx src/RecordingsTab.test.tsx --coverage.enabled=false
```

Kryteria akceptacji:

- Uzytkownik wie, czy transkrypcja jeszcze trwa, jest pusta, czy sie nie powiodla.
- Retry ma widoczny efekt i nie dubluje jobow bez potrzeby.

### P2-2. Formularze zadan i relacje many-to-many

Status: `[~]` Czesciowo wdrozone lokalnie.

Zadania:

- [x] Ujednolicic formularz dodawania i podgladu zadania.
- [x] Naprawic wybor osoby/tagu w modalach.
- [x] Dodac mozliwosc przypisania kilku osob.
- [ ] Dodac test regresji dla multi-select osob.
- [ ] Sprawdzic kontrakt danych: task assignees vs pojedyncze `personId`.
- [ ] Doprecyzowac UX chipow, focus state, remove action i empty state.

Walidacja:

```bash
pnpm exec vitest run src/lib/tasks.coverage.test.ts src/shared/contracts.test.ts --coverage.enabled=false
pnpm run typecheck:all
```

Kryteria akceptacji:

- Zadanie moze miec kilka przypisanych osob.
- Dodawanie, edycja i podglad uzywaja tego samego modelu formularza.
- Multi-select jest dostepny klawiatura i czytelny wizualnie.

### P2-3. People details bez prawego preview panelu

Status: `[~]` Czesciowo wdrozone lokalnie.

Zadania:

- [x] Usunac prawy panel preview z listy osob.
- [x] Klikniecie osoby przenosi do szczegolow.
- [x] Dodac akcje zarzadzania, edycji i usuwania w szczegolach osoby.
- [ ] Dodac test nawigacji lista -> szczegoly.
- [ ] Dodac test delete person z confirm/error state.
- [ ] Sprawdzic responsive dla 1024/768/390.

Walidacja:

```bash
pnpm exec vitest run src/PeopleTab.test.tsx src/ProfileTab.test.tsx --coverage.enabled=false
```

Kryteria akceptacji:

- Lista osob nie pokazuje konkurujacego preview panelu.
- Szczegoly osoby sa jedynym miejscem zarzadzania rekordem.

## Release checklist

- [ ] `pnpm run audit:mojibake`
- [ ] `pnpm run typecheck:all`
- [ ] `pnpm run lint:all`
- [ ] `pnpm run test:server:retry`
- [ ] `pnpm run test:frontend:ci` albo udokumentowany shard CI
- [ ] `pnpm run build`
- [ ] `pnpm run release:audio-prod-smoke`
- [ ] Smoke UI na `http://localhost:3000`
- [ ] Raport zmian: pliki, testy, ryzyka, runtime frontend/backend
