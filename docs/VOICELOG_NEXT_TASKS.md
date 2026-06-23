# VoiceLog OS / VoiceBobr - rozpiska zadan

Data utworzenia: 2026-06-21
Ostatnia aktualizacja: 2026-06-23

Cel: uporzadkowana lista najblizszych zadan po hardeningu produkcyjnym. Dokument sluzy jako plan wykonawczy dla kolejnych PR/commitow. Nie zastepuje GitHub Issues, ale moze byc zrodlem do ich utworzenia.

## Zasady pracy

- Jedno zadanie = jeden logiczny PR albo commit.
- Kazdy bug fix musi miec test regresji.
- Nie mieszac zmian UI, security i audio pipeline w jednym commicie.
- Nie zmieniac logiki biznesowej przy okazji poprawek layoutu.
- Przed wypchnieciem uruchomic wskazane komendy walidacji.
- Przy zmianach UI zebrac screenshot evidence, gdy jest to realnie mozliwe.

## Priorytety

- `P0` - blocker produkcji albo bezpieczenstwa.
- `P1` - wysoki wplyw na stabilnosc, dane, audio lub kluczowy UX.
- `P2` - jakosc produktu, ergonomia, utrzymanie.
- `P3` - porzadki, dokumentacja, polish.

Statusy:

- `[ ]` - nie zaczete.
- `[~]` - w toku albo czesciowo zweryfikowane.
- `[x]` - wykonane i zweryfikowane testami albo release gate.
- `[!]` - zablokowane przez env, decyzje produktowa albo zewnetrzna usluge.

## P0 - domkniecie produkcji

### TASK-P0-01 - Retry transkrypcji z loading/error state

Status: `[x]`

Cel: uzytkownik ma widziec, ze ponowienie transkrypcji zostalo uruchomione, a blad jest czytelny i nie znika po cichu.

Zakres:

- Dodac stan `retryingRecordingId` w Studio detail.
- Dodac stan `retryingRecordingId` w Bazie nagran.
- Zmienic tekst akcji na `Ponawiam transkrypcje...` podczas requestu.
- Zablokowac przycisk podczas retry.
- Pokazac blad retry w `role="alert"`.
- Nie dublowac jobow retry dla tego samego nagrania.

Pliki:

- `src/studio/StudioMeetingView.tsx`
- `src/studio/StudioMeetingView.test.tsx`
- `src/RecordingsTab.tsx`
- `src/RecordingsTab.test.tsx`

Kryteria akceptacji:

- Klik retry pokazuje loading state.
- Blad retry jest widoczny i testowalny.
- Po sukcesie przycisk wraca do normalnego stanu.
- Testy regresji pokrywaja loading i error.

Walidacja:

```bash
pnpm exec vitest run src/studio/StudioMeetingView.test.tsx src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### TASK-P0-02 - Pelny release gate lokalny

Status: `[!]`

Cel: potwierdzic, ze aktualny stan repo przechodzi minimalny gate przed wysylka na produkcje.

Zakres:

- [x] Uruchomic mojibake audit.
- [x] Uruchomic typecheck.
- [x] Uruchomic server retry tests.
- [x] Uruchomic build.
- [!] Uruchomic audio prod smoke lub opisac brak env jako blocker.
- [x] Zweryfikowac `localhost:3000`.
- [x] Zweryfikowac backend `127.0.0.1:4001`.
- [x] Naprawic CLI smoke, aby wypisywal faktycznie zapisana sciezke raportu.

Blokery:

- `pnpm run release:audio-prod-smoke` nie moze przejsc pelnego upload/transcribe bez `VOICELOG_SMOKE_TOKEN` albo `VOICELOG_SMOKE_EMAIL`/`VOICELOG_SMOKE_PASSWORD` i `VOICELOG_SMOKE_WORKSPACE_ID`. API na `http://localhost:4001` odpowiada.
- Ostatni raport smoke: `reports/audio-prod-smoke-1782199278813.json`.
- Lokalny Node raportuje wersje `24.14.0`, a repo deklaruje runtime `22.x`; przed release trzeba uruchomic gate na Node 22.

Pliki:

- brak zmian kodu, tylko raport w finalnej notatce albo release logu.

Kryteria akceptacji:

- Kazda komenda ma status `pass` albo jawnie opisany blocker.
- Lokalny frontend nie zwraca `ERR_CONNECTION_REFUSED`.
- Znane ryzyka sa wypisane przed pushem.

Walidacja:

```bash
pnpm run audit:mojibake
pnpm run typecheck:all
pnpm run test:server:retry
pnpm run build
pnpm run release:audio-prod-smoke
```

### TASK-P0-03 - Backend i Supabase production connectivity

Status: `[x]`

Cel: ustalic, czy brak transkrypcji, brak nowych nagran i smoke failures wynikaja z backendu, env, Supabase albo kolejek.

Zakres:

- [x] Zweryfikowac start backendu na `http://127.0.0.1:4001`.
- [x] Zweryfikowac `/health` i flage `supabaseRemote`.
- Zweryfikowac env Supabase dla lokalnego i produkcyjnego trybu.
- Zweryfikowac zapis media asset po nagraniu.
- Zweryfikowac start joba transkrypcji i polling statusu.
- Zweryfikowac, czy lista nagran laczy backend recordings z lokalna kolejka.
- [x] Zapisac jasny komunikat smoke, gdy backend/Supabase sa niedostepne.

Ustalenia 2026-06-23:

- Lokalna konfiguracja `.env` uzywa `PORT=4001`, `VOICELOG_API_PORT=4001`, `VITE_API_BASE_URL=http://127.0.0.1:4001`.
- `pnpm run start:server` uruchamia API na `http://0.0.0.0:4001`.
- Kontrolny `/health` potwierdzil, ze route dziala; chwilowy `503` wskazal `Supabase Storage: fetch failed`.
- Kolejny smoke przy dzialajacym backendzie potwierdzil `/health ok` i `supabaseRemote true`.
- Smoke nadal blokuje pelny upload/transcribe bez `VOICELOG_SMOKE_TOKEN` albo `VOICELOG_SMOKE_EMAIL`/`VOICELOG_SMOKE_PASSWORD` oraz `VOICELOG_SMOKE_WORKSPACE_ID`.
- Raport: `reports/audio-prod-smoke-1782199278813.json`.
- `server/scripts/audio-prod-smoke.ts` raportuje teraz transport diagnostics (`baseUrl`, `path`, `url`, `method`, `hint`) zamiast samego `fetch failed`.

Pliki:

- `server/serverRuntime.ts`
- `server/routes/media.ts`
- `server/routes/transcribe.ts`
- `src/store/recorderQueueProcessor.ts`
- `src/RecordingsTab.tsx`
- `src/studio/TranscriptPanel.tsx`

Kryteria akceptacji:

- Frontend rozroznia `backend offline`, `transcription processing`, `empty transcript` i `failed`.
- Nowe nagranie jest widoczne w Bazie nagran po lokalnym zakonczeniu nagrywania.
- [x] Smoke wskazuje konkretna przyczyne awarii zamiast ogolnego `Failed to fetch`.

Walidacja:

```bash
pnpm run start:server:watch
pnpm start
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx src/studio/TranscriptPanel.test.tsx --coverage.enabled=false
pnpm run release:audio-prod-smoke
```

## P1 - audio pipeline i dane

### TASK-P1-01 - Statusy transkrypcji jako jeden kontrakt

Status: `[x]`

Cel: Studio, panel transkrypcji i Baza nagran uzywaja jednego modelu statusu przetwarzania.

Zakres:

- Spisac finalny model statusow: `no_audio`, `uploading`, `queued`, `processing`, `diarization`, `empty`, `done`, `failed`, `failed_permanent`.
- Upewnic sie, ze komponent `RecordingPipelineStatus` obsluguje kazdy status.
- Upewnic sie, ze `TranscriptPanel` nie pokazuje `Brak transkrypcji`, gdy job trwa.
- Upewnic sie, ze Baza nagran pokazuje te same etykiety i klasy statusow.
- Dodac mapowanie legacy statusow.

Pliki:

- `src/components/RecordingPipelineStatus.tsx`
- `src/components/RecordingPipelineStatus.test.tsx`
- `src/studio/TranscriptPanel.tsx`
- `src/studio/TranscriptPanel.test.tsx`
- `src/RecordingsTab.tsx`
- `src/lib/recordingQueue.ts`

Kryteria akceptacji:

- Kazdy status ma etykiete, aria label i styl.
- Pusty transcript rozroznia `brak mowy` od `blad` i `w toku`.
- Legacy recordings nadal renderuja sie poprawnie.

Walidacja:

```bash
pnpm exec vitest run src/components/RecordingPipelineStatus.test.tsx src/studio/TranscriptPanel.test.tsx src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm run audit:mojibake
```

### TASK-P1-02 - Widocznosc nowych nagran po nagraniu

Status: `[x]`

Cel: nagranie utworzone lokalnie jest widoczne w Bazie nagran bez czekania na pelna synchronizacje.

Zakres kontrolny:

- Zweryfikowac merge lokalnej kolejki i backendu.
- Zweryfikowac deduplikacje placeholdera.
- Zweryfikowac sortowanie najnowszych nagran.
- Zweryfikowac odswiezanie po retry upload/transcribe.

Pliki:

- `src/store/recorderQueueProcessor.ts`
- `src/store/recorderStore.ts`
- `src/RecordingsTab.tsx`
- `tests/e2e/recordings-queue-smoke.spec.ts`

Kryteria akceptacji:

- Nowe nagranie pojawia sie na liscie po zakonczeniu lokalnego nagrania.
- Nie ma duplikatu po synchronizacji z backendem.
- E2E smoke przechodzi na Chromium.

Walidacja:

```bash
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx --coverage.enabled=false
pnpm exec playwright test tests/e2e/recordings-queue-smoke.spec.ts --project=chromium
```

### TASK-P1-03 - Usuwanie nagrania i retention smoke

Status: `[x]`

Cel: usuniecie nagrania usuwa dane aplikacyjne, transcript, storage i wpisuje audit log.

Zakres:

- [x] Zweryfikowac delete media asset.
- [x] Zweryfikowac delete storage object.
- [x] Zweryfikowac cleanup transcript payload i part transcripts.
- [x] Zweryfikowac cleanup RAG/vector rows, jesli istnieja.
- [x] Zweryfikowac retention job dla workspace `retentionDays`.
- [x] Zweryfikowac audit log deletion z prawidlowym aktorem.

Ustalenia 2026-06-23:

- `deleteMediaAsset` usuwa `media_assets`, remote/local audio, RAG rows i zapisuje `recording.deleted` w `audit_logs`.
- Manualny `DELETE /media/recordings/:recordingId` przekazuje teraz `session.user_id` jako `actorUserId`, wiec audit log wskazuje faktycznego uzytkownika usuwajacego, a nie tylko tworce nagrania.
- Retention cleanup nadal uzywa tego samego `deleteMediaAsset`; gdy brak aktora systemowego, zachowuje fallback do `created_by_user_id`.
- `server/tests/routes/media.test.ts` uzywa teraz izolowanego katalogu tymczasowego dla uploadu, wiec pelna suite nie zalezy od wspolnego `C:\tmp\preflight`.
- Pelny zestaw `server/tests/routes/media.test.ts`, `server/tests/lib/periodicCleanup.test.ts`, `server/tests/database.test.ts` przechodzi lokalnie.

Pliki:

- `server/routes/media.ts`
- `server/database.ts`
- `server/lib/periodicCleanup.ts`
- `server/tests/routes/media.test.ts`
- `server/tests/lib/periodicCleanup.test.ts`

Kryteria akceptacji:

- [x] Test mock storage potwierdza usuniecie obiektu.
- [x] Audit log zawiera deletion event.
- [x] Audit log manualnego delete zapisuje faktycznego aktora.
- [x] Retention nie usuwa danych spoza workspace.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/lib/periodicCleanup.test.ts --coverage.enabled=false
```

## P1 - security i koszty

### TASK-P1-04 - Finalna kontrola kosztowych endpointow

Status: `[x]`

Cel: zadne STT/LLM/RAG/analyze/embedding/image endpointy nie dzialaja anonimowo i bez limitow.

Zakres kontrolny:

- Sprawdzic `/ai/*`.
- Sprawdzic `/transcribe/live`.
- Sprawdzic `/workspaces/:workspaceId/rag/ask`.
- Sprawdzic voice profiles / embeddings.
- Utrzymac testy `401`, `403`, `429`.

Pliki:

- `server/routes/ai.ts`
- `server/routes/media.ts`
- `server/routes/workspaces.ts`
- `server/tests/routes/ai.test.ts`
- `server/tests/routes/costly-endpoints-auth.test.ts`

Kryteria akceptacji:

- Anonymous request zwraca `401`.
- Request bez membership zwraca `403`.
- Quota/rate limit zwraca `429`.
- Logi nie zawieraja pelnych transkryptow ani danych wrazliwych.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/ai.test.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false
```

### TASK-P1-05 - Google auth idToken hardening

Status: `[x]`

Cel: `/auth/google` ufa tylko zweryfikowanemu `idToken`, nie payloadowi klienta.

Zakres kontrolny:

- Brak tokena = `400` albo `401`.
- Falszywy token = `401`.
- Payload email/sub bez tokena nie tworzy sesji.
- Mock verified token tworzy albo zwraca sesje.

Pliki:

- `server/routes/auth.ts`
- `server/lib/googleIdToken.ts`
- `server/tests/routes/auth.test.ts`
- `server/tests/routes/auth-extended.test.ts`
- `server/tests/lib/googleIdToken.test.ts`

Kryteria akceptacji:

- Backend sprawdza `aud`, `iss`, `exp`, `email_verified`.
- Email/sub/name sa brane z verified tokena.
- Testy nie wymagaja prawdziwego Google tokena.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/auth-extended.test.ts server/tests/lib/googleIdToken.test.ts --coverage.enabled=false
```

## P1 - zadania i osoby

### TASK-P1-06 - Multi-assignee w formularzu zadania

Status: `[x]`

Cel: zadanie moze miec kilka przypisanych osob, a stary model pojedynczej osoby nadal dziala.

Zakres:

- Zweryfikowac model `assignedTo` jako kanoniczna lista osob.
- Zachowac kompatybilnosc ze starymi danymi bez wprowadzania nowego `personId` shadow field.
- [x] Dodac test regresji multi-select osob.
- [x] Zweryfikowac kontrakt danych: `assignedTo` jako kanoniczna lista, bez `personId` i `assigneeIds`.
- [x] Zweryfikowac create, preview i edit przez testy `TaskCreateForm` i `TaskDetailsPanel`.
- [x] Dodac test usuwania osoby z chipa.
- [x] Zweryfikowac create task ze Studio.
- [x] Zweryfikowac keyboard multi-select w `TagInput`.

Pliki:

- `src/tasks/TaskCreateForm.tsx`
- `src/tasks/TaskDetailsPanel.tsx`
- `src/lib/tasks.ts`
- `src/lib/tasks.coverage.test.ts`
- `src/shared/contracts.ts`
- `src/shared/contracts.test.ts`

Kryteria akceptacji:

- [x] Mozna wybrac kilka osob.
- [x] Mozna usunac jedna osobe bez czyszczenia pozostalych.
- [x] Zapisywany kontrakt nie gubi starych danych.
- [x] Multi-select dziala klawiatura.
- [x] Tworzenie zadania ze Studio zachowuje wiele osob.

Walidacja:

```bash
pnpm exec vitest run src/tasks/TaskCreateForm.test.tsx src/tasks/TaskDetailsPanel.test.tsx src/lib/tasks.coverage.test.ts src/shared/contracts.test.ts src/shared/TagInput.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### TASK-P1-07 - Podglad zadania jako ten sam formularz co tworzenie

Status: `[~]`

Cel: dodawanie, podglad i edycja zadania uzywaja tego samego wzorca UX.

Zakres:

- [x] Utrzymac jeden layout formularza.
- [x] Dopracowac modal height i sticky footer.
- [x] Dodac czytelny auto-save status: `Zapisano`, `Zapisywanie...`, `Blad zapisu`.
- [x] Powiekszyc targety akcji do min. 44 px.
- [x] Zablokowac scroll tla po otwarciu modalu.
- [x] Przywracac poprzedni `body.style.overflow` po zamknieciu create modalu.
- [x] Podbic kontrast chipow osoby/tagow.

Ustalenia 2026-06-23:

- Podglad zadania w trybie modalnym uzywa wspolnego `TaskCreateForm` przez `TaskDetailsPanel`, tak jak tworzenie zadania.
- Kontrakt CSS utrzymuje kompaktowa wysokosc, internal scroll, sticky footer i 44 px targety.
- Footer podgladu pokazuje autosave status przez `aria-live="polite"`.
- Dodano regresje dla create modalu: scroll lock przywraca poprzedni stan `body.style.overflow`, zamiast czyscic go do pustej wartosci.

Pliki:

- `src/tasks/TaskCreateForm.tsx`
- `src/tasks/TaskDetailsPanel.tsx`
- `src/tasks/TasksWorkspaceViewStyles.css`
- `src/tasks/*.test.tsx`

Kryteria akceptacji:

- [x] Preview i create wygladaja spojnie.
- [x] Nie ma dwoch konkurujacych scrollbarow.
- [x] Footer nie przykrywa sekcji AI/opisu.
- [x] Focus-visible jest widoczny.
- [x] Scroll tla jest blokowany i poprawnie odtwarzany po zamknieciu modalu.

Walidacja:

```bash
pnpm exec vitest run src/tasks --coverage.enabled=false
pnpm run typecheck:all
```

### TASK-P1-08 - Szczegoly osoby zamiast prawego preview panelu

Status: `[x]`

Cel: lista osob jest katalogiem, a klikniecie osoby prowadzi do szczegolow z edycja i usuwaniem.

Zakres:

- [x] Utrzymac brak prawego preview panelu na liscie.
- [x] Klik w osobe przenosi do szczegolow.
- [x] Dodac zarzadzanie, edycje i usuwanie w szczegolach.
- [x] Dodac test nawigacji lista -> szczegoly.
- [x] Dodac test delete person z confirm/error state.
- [x] Sprawdzic mobile 390 px.

Evidence 2026-06-23:

- `docs/audits/screenshots/people-directory-mobile-390x844.png`
- `docs/audits/screenshots/people-detail-mobile-390x844.png`

Uwaga: podczas evidence mobile element nav `Osoby` byl poza widocznym obszarem i wymagal programmatic click w Playwright. To nie blokuje tego zadania, ale zostaje do poprawy w `TASK-P2-01` jako globalny mobile nav/shell issue.

Pliki:

- `src/PeopleTab.tsx`
- `src/ProfileTab.tsx`
- `src/ProfileTab.test.tsx`
- `src/lib/people.ts`
- `src/hooks/usePeopleProfiles.ts`

Kryteria akceptacji:

- [x] Lista osob nie ma prawego panelu.
- [x] Szczegoly osoby sa osobna powierzchnia zarzadzania.
- [x] Usuwanie wymaga potwierdzenia i pokazuje blad.
- [x] Mobile 390 px ma screenshot/browser evidence.

Walidacja:

```bash
pnpm exec vitest run src/PeopleTab.test.tsx src/ProfileTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### TASK-P1-09 - Wylaczenie automatycznego dodawania zadan ze spotkan

Status: `[x]`

Cel: aplikacja moze sugerowac zadania ze spotkania, ale nie tworzy ich automatycznie bez decyzji uzytkownika.

Zakres:

- [x] Usunac albo zablokowac efekt auto-create dla `autoTaskDrafts`.
- [x] Zostawic manualne `+ Dodaj zadanie` w zakladce spotkania.
- [x] Jesli sugestie AI zostaja, musza miec jawny flow: `Generuj sugestie` -> `Zatwierdz`.
- [x] Dodac regresje: wejscie w spotkanie z `studioAnalysis.tasks` nie wywoluje `onCreateTask`.
- [x] Dodac regresje: reczne dodanie zadania ze Studio nadal dziala.
- [x] Upewnic sie, ze zadania nie dubluja sie po odswiezeniu strony.

Pliki:

- `src/studio/StudioMeetingView.tsx`
- `src/studio/StudioMeetingView.test.tsx`
- `src/tasks/TaskCreateModal.tsx`
- `src/tasks/TaskCreateForm.tsx`

Kryteria akceptacji:

- [x] Zadanie ze spotkania powstaje tylko po kliknieciu uzytkownika.
- [x] AI suggestions nie generuja wpisow w store bez zatwierdzenia.
- [x] Manualny formularz zadania w Studio zachowuje tytul, termin, osoby, tagi i opis.

Walidacja:

```bash
pnpm exec vitest run src/studio/StudioMeetingView.test.tsx src/tasks/TaskCreateForm.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

## P2 - UX, layout i design system

### TASK-P2-01 - Globalny layout shell

Status: `[~]`

Cel: wszystkie ekrany uzywaja jednego shell: sidebar, topbar, content, padding.

Zakres:

- Utrzymac `--sidebar-width: 260px`.
- Usunac lokalne kompensacje sidebara.
- Nie stosowac globalnego `max-width` dla calej strony.
- Utrzymac pelne nazwy menu na desktopie.
- Sprawdzic viewporty 1440, 1280, 1024, 768, 390.

Pliki:

- `src/styles/modern-layout.css`
- `src/index.css`
- `src/AppSidebar.tsx`
- `src/AppHeader.tsx`
- style ekranow glownych

Kryteria akceptacji:

- Sidebar ma te sama szerokosc na kazdym ekranie desktop.
- Content zaczyna sie zaraz po sidebarze.
- Nie ma pustych pasow po lewej/prawej.
- Mobile nav otwiera sie i zamyka przewidywalnie.

Walidacja:

```bash
pnpm run lint:css
pnpm run typecheck:all
```

### TASK-P2-02 - UI primitives

Status: `[ ]`

Cel: button, input, select, checkbox, card, table i modal maja wspolne klasy i stany.

Zakres:

- Zdefiniowac minimalne `.ui-button`, `.ui-input`, `.ui-select`, `.ui-checkbox`, `.ui-card`, `.ui-table`, `.ui-modal`, `.ui-badge`.
- Dodac hover/focus-visible/disabled.
- Dodac `cursor: pointer` dla elementow interaktywnych.
- Zaczac od Studio links, Notes icon buttons i Tasks toolbar.

Pliki:

- `src/styles/reference-ui.css`
- `src/styles/modern-layout.css`
- `src/studio/StudioMeetingViewStyles.css`
- `src/NotesTabStyles.css`
- `src/tasks/TasksWorkspaceViewStyles.css`

Kryteria akceptacji:

- Elementy klikalne maja pointer, hover i focus-visible.
- Nie ma bootstrap-like przypadkowych wariantow dla tego samego elementu.
- Nowe formularze korzystaja z primitive albo zgodnych tokenow.

Walidacja:

```bash
pnpm run lint:css
pnpm run typecheck:all
```

### TASK-P2-03 - Mojibake i polskie copy

Status: `[x]`

Cel: user-facing copy nie ma uszkodzonych polskich znakow.

Zakres:

- [x] Uruchomic `audit:mojibake`.
- [x] Naprawic teksty z uszkodzonym UTF-8 w aktywnych release-critical plikach.
- Utrzymac dokumenty techniczne w ASCII albo czystym UTF-8.
- Dodac test/allowlist tylko dla uzasadnionych false positives.

Ustalenia 2026-06-23:

- `server/routes/media.ts` mial uszkodzone user-facing komunikaty; zostaly zamienione na poprawny UTF-8.
- `server/tests/routes/media.test.ts` mial popsute polskie stringi w opisach regresji i danych testowych; zostaly poprawione.
- `scripts/audit-mojibake.mjs` obejmuje teraz aktywny backlog i release docs: `docs/VOICELOG_NEXT_TASKS.md`, `docs/PRODUCTION_HARDENING_TASKS.md`, `docs/AUDIO_PROD_SMOKE.md`, `docs/PRODUCTION_CORS.md`.
- `pnpm run audit:mojibake` przechodzi, ale reczny scan moze nadal pokazywac historyczne mojibake w archiwalnych dokumentach `docs/automation/TASK_DONE.md`; nie sa release-critical UI/API surface.

Pliki:

- komponenty UI z copy
- `scripts/audit-mojibake*`
- dokumenty release, jesli dotyczy

Kryteria akceptacji:

- [x] Audit przechodzi.
- [x] Ekrany i API nie pokazuja uszkodzonych znakow w release-critical surface.
- [x] Nowe copy jest spojne jezykowo.

Walidacja:

```bash
pnpm run audit:mojibake
```

### TASK-P2-04 - Porzadek w screenshot artifacts

Status: `[x]`

Cel: root repo nie jest zasypany tymczasowymi PNG z audytow.

Zakres:

- [x] Przeniesc wartosciowe screenshoty do `docs/audits/screenshots/`.
- [x] Usunac albo zignorowac tymczasowe artefakty.
- [x] Dopisac workflow evidence dla UI.
- [x] Sprawdzic `.gitignore`.

Ustalenia 2026-06-23:

- Root-level screenshoty `/*.png`, `/*.jpg`, `/*.jpeg`, `/*.webp` sa ignorowane w `.gitignore`.
- Wartosciowe evidence zostaje jawnie widoczne w `docs/audits/screenshots/`.
- Workflow zapisu evidence opisuje `docs/audits/SCREENSHOT_EVIDENCE.md`.

Pliki:

- `docs/audits/screenshots/`
- `.gitignore`
- dokumenty audytowe

Kryteria akceptacji:

- [x] `git status --short` nie pokazuje przypadkowych PNG w root.
- [x] Wartosciowe baseline sa nazwane i opisane.

Walidacja:

```bash
git status --short
```

## P3 - dokumentacja i release hygiene

### TASK-P3-01 - Release notes dla hardeningu

Status: `[x]`

Cel: opisac co zostalo zabezpieczone i jak weryfikowac produkcje.

Zakres:

- [x] Zapisac zmiany auth Google.
- [x] Zapisac zmiany `/ai/*` i kosztowych endpointow.
- [x] Zapisac smoke audio.
- [x] Zapisac data retention.
- [x] Zapisac znane ryzyka.

Ustalenia 2026-06-23:

- `docs/PRODUCTION_HARDENING_TASKS.md` ma sekcje `Release verification notes - 2026-06-23` z security, audio, retention, envami, ryzykami i minimalnym zestawem komend.
- `docs/AUDIO_PROD_SMOKE.md` ma lokalny przyklad uruchomienia i typowe failure modes.
- `docs/PRODUCTION_CORS.md` ma minimalny test matrix dla allowed/disallowed origin i Vercel previews.

Pliki:

- `docs/PRODUCTION_HARDENING_TASKS.md`
- `docs/AUDIO_PROD_SMOKE.md`
- `docs/PRODUCTION_CORS.md`

Kryteria akceptacji:

- [x] Nowy developer wie, jakie env vars sa wymagane.
- [x] Smoke ma jasna instrukcje uruchomienia.
- [x] Znane ograniczenia sa jawne.

Walidacja:

```bash
pnpm run audit:mojibake
```

## Sugerowana kolejnosc

1. `TASK-P0-03` - backend i Supabase connectivity.
2. `TASK-P0-02` - pelny release gate po uruchomieniu backend/env.
3. `TASK-P1-09` - wylaczenie automatycznego dodawania zadan ze spotkan.
4. `TASK-P1-06` - domkniecie create task ze Studio dla multi-assignee.
5. `TASK-P1-08` - testy people details.
6. `TASK-P1-03` - usuwanie nagrania i retention smoke.
7. `TASK-P2-03` - mojibake clean.
8. `TASK-P2-04` - porzadek w artefaktach.
9. `TASK-P2-02` - UI primitives etapami.
