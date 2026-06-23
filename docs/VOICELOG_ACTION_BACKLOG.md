# VoiceLog OS / VoiceBóbr - backlog zadań wykonawczych

Data: 2026-06-23

Cel: zebrać aktualne zadania do dalszego utwardzania produkcji, stabilizacji audio pipeline i dopracowania UX. Plik jest roboczą rozpiską dla kolejnych commitów/PR-ów. Źródłem prawdy dla wykonania powinny docelowo być GitHub Issues, ale ten dokument może posłużyć do ich utworzenia.

## Zasady realizacji

- Jedno zadanie = jeden logiczny commit albo PR.
- Bug fix zaczyna się od testu regresji.
- Nie mieszać w jednym commicie zmian security, audio pipeline i UI.
- Nie przebudowywać architektury bez potrzeby.
- Po każdej zmianie uruchomić wskazaną walidację.
- Przy zmianach UI zebrać screenshot evidence, jeśli lokalny runtime działa.

## Statusy

- `[ ]` - nie rozpoczęte.
- `[~]` - w toku albo częściowo zweryfikowane.
- `[x]` - wykonane i zweryfikowane.
- `[!]` - zablokowane przez env, decyzję produktową albo usługę zewnętrzną.

## P0 - blokery produkcyjne

### TASK-P0-01 - Domknąć connectivity backend/Supabase/audio

Status: `[~]`

Cel: jednoznacznie potwierdzić, dlaczego transkrypcja albo nowe nagrania mogą nie pojawiać się w UI: backend, Supabase, storage, kolejka uploadu, job transkrypcji czy merge danych frontendowych.

Zakres:

- [x] Zweryfikować `/health` dla backendu lokalnego.
- [!] Zweryfikować `/health` dla backendu produkcyjnego.
- [x] Sprawdzić `supabaseRemote`, storage bucket i prawa zapisu/odczytu lokalnego backendu.
- [!] Sprawdzić zapis `media_assets` po zakończeniu nagrania w pełnym smoke z auth/workspace.
- [!] Sprawdzić start joba transkrypcji i polling statusu w pełnym smoke z auth/workspace.
- [x] Sprawdzić, czy lista nagrań łączy backend recordings z lokalną kolejką.
- [x] Dopisać czytelne komunikaty UI: backend offline, upload pending, transcribe processing, empty transcript, failed.
- [x] Dopisać actionable smoke diagnostics dla transportu i Supabase/storage.

Ustalenia 2026-06-23:

- Lokalny backend uruchomiony przez `pnpm run start:server`.
- `http://127.0.0.1:4001/health` zwrócił `200`, `supabaseRemote:true`, `supabaseStorage.ready:true`, bucket `recordings`.
- `http://localhost:4001/health` w bezpośrednim `Invoke-WebRequest` timeoutował w tym środowisku, ale `release:audio-prod-smoke` na domyślnym `http://localhost:4001` przeszedł kroki `/health ok` i `supabaseRemote true`.
- Smoke zatrzymał się na `auth login`/`preflight credentials`, bo brakuje `VOICELOG_SMOKE_TOKEN` albo `VOICELOG_SMOKE_EMAIL`/`VOICELOG_SMOKE_PASSWORD` i `VOICELOG_SMOKE_WORKSPACE_ID`.
- Ostatni raport smoke: `reports/audio-prod-smoke-1782223174217.json`.
- Dodano regresję: gdy `/health` wskazuje `supabaseRemote:false` albo storage not ready, raport smoke zawiera hint o `VOICELOG_SUPABASE_URL`, `VOICELOG_SUPABASE_SERVICE_ROLE_KEY`, `VOICELOG_SUPABASE_STORAGE_BUCKET` i uprawnieniach bucketa.

Pliki:

- `server/routes/media.ts`
- `server/routes/transcribe.ts`
- `server/serverRuntime.ts`
- `src/store/recorderQueueProcessor.ts`
- `src/RecordingsTab.tsx`
- `src/studio/TranscriptPanel.tsx`

Kryteria akceptacji:

- [x] Nowe nagranie z lokalnej kolejki pojawia się w Bazie nagrań po zakończeniu lokalnego nagrywania.
- [x] UI rozróżnia brak transkrypcji od transkrypcji w toku i od błędu.
- [x] Smoke raportuje konkretny powód awarii zamiast ogólnego `Failed to fetch`.
- [!] Pełny zapis `media_assets`, upload fixture, transcribe start i polling wymagają smoke credentials/workspace.

Walidacja:

```bash
pnpm run start:server:watch
pnpm start
pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx src/studio/TranscriptPanel.test.tsx --coverage.enabled=false
pnpm run release:audio-prod-smoke
```

### TASK-P0-02 - Pełny release gate na Node 22

Status: `[!]`

Cel: potwierdzić gotowość produkcyjną na właściwym runtime, nie na lokalnym Node 24.

Zakres:

- Uruchomić pełny gate na Node `22.x`.
- Uruchomić audio smoke z prawidłowymi envami.
- Zweryfikować frontend `localhost:3000`.
- Zweryfikować backend `localhost:4001` albo produkcyjny URL.
- Zebrać raport JSON smoke.

Blokery:

- Wymagane envy smoke: `VOICELOG_SMOKE_TOKEN` albo `VOICELOG_SMOKE_EMAIL`/`VOICELOG_SMOKE_PASSWORD` oraz `VOICELOG_SMOKE_WORKSPACE_ID`.
- Lokalny runtime raportuje Node `24.14.0`, a projekt deklaruje Node `22.x`.

Kryteria akceptacji:

- `typecheck`, `lint`, `server tests`, `frontend CI`, `build` i `audio smoke` mają wynik `pass` albo jawny blocker.
- Raport smoke jest zapisany w `reports/`.

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

## P1 - stabilność audio i danych

### TASK-P1-01 - Production smoke: kompletna ścieżka nagrania

Status: `[ ]`

Cel: mieć powtarzalny test produkcyjny dla uploadu audio, transkrypcji, pobrania audio i retry.

Zakres:

- Sprawdzić `/health`.
- Zalogować użytkownika smoke.
- Wgrać krótki fixture audio.
- Uruchomić transkrypcję.
- Pollować do `done`, `empty` albo `failed` z diagnostyką.
- Sprawdzić zapis transkryptu albo poprawny empty transcript.
- Sprawdzić download audio.
- Sprawdzić retry-transcribe dla stanów completed/processing.
- Generować JSON report.

Pliki:

- `server/scripts/audio-prod-smoke.ts`
- `docs/AUDIO_PROD_SMOKE.md`
- `server/tests/scripts/audio-prod-smoke.test.ts`

Kryteria akceptacji:

- Smoke da się uruchomić lokalnie i przeciw produkcji.
- Raport zawiera kroki, statusy, URL-e diagnostyczne bez sekretów i finalny wynik.

Walidacja:

```bash
pnpm run release:audio-prod-smoke
pnpm exec vitest run -c server/vitest.config.ts server/tests/scripts/audio-prod-smoke.test.ts --coverage.enabled=false
```

### TASK-P1-02 - Retention i usuwanie danych nagrań

Status: `[ ]`

Cel: usunięcie nagrania usuwa wszystkie powiązane dane i zapisuje audit log.

Zakres:

- Usunąć `media_assets`.
- Usunąć obiekt audio z Supabase/local storage.
- Usunąć transcript payload.
- Usunąć part transcripts.
- Usunąć RAG/vector rows, jeśli istnieją.
- Dodać workspace setting `retentionDays`.
- Dodać audit log deletion.

Pliki:

- `server/database.ts`
- `server/routes/media.ts`
- `server/lib/periodicCleanup.ts`
- `server/tests/routes/media.test.ts`
- `server/tests/lib/periodicCleanup.test.ts`

Kryteria akceptacji:

- Test mock storage potwierdza usunięcie obiektu.
- Audit log zawiera aktora i zdarzenie deletion.
- Retention nie usuwa danych spoza workspace.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/media.test.ts server/tests/lib/periodicCleanup.test.ts --coverage.enabled=false
```

## P1 - security i koszty AI

### TASK-P1-03 - Audyt kosztowych endpointów po hardeningu

Status: `[ ]`

Cel: potwierdzić, że żaden endpoint STT/LLM/RAG/analyze/embedding/image nie działa anonimowo ani bez limitu kosztów.

Zakres:

- Zweryfikować `/ai/*`.
- Zweryfikować `/transcribe/live`.
- Zweryfikować `/workspaces/:workspaceId/rag/ask`.
- Zweryfikować voice profiles i embeddings.
- Sprawdzić `401`, `403`, `429`.
- Sprawdzić, że logi nie zawierają pełnych transkryptów ani danych wrażliwych.

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
- Brak klucza modelu daje bezpieczny fallback dopiero po auth.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/ai.test.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false
```

### TASK-P1-04 - Google auth idToken verification audit

Status: `[ ]`

Cel: upewnić się, że `/auth/google` nie ufa danym profilu wysłanym z klienta.

Zakres:

- Sprawdzić brak tokena.
- Sprawdzić fałszywy token.
- Sprawdzić payload `email/sub/name` bez tokena.
- Sprawdzić mocked verified token.
- Potwierdzić walidację `aud`, `iss`, `exp`, `email_verified`.

Pliki:

- `server/routes/auth.ts`
- `server/lib/googleIdToken.ts`
- `server/tests/routes/auth.test.ts`
- `server/tests/routes/auth-extended.test.ts`
- `server/tests/lib/googleIdToken.test.ts`

Kryteria akceptacji:

- Email, sub i name są odczytywane tylko ze zweryfikowanego tokena.
- Testy nie wymagają prawdziwego Google tokena.

Walidacja:

```bash
pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/auth.test.ts server/tests/routes/auth-extended.test.ts server/tests/lib/googleIdToken.test.ts --coverage.enabled=false
```

## P1 - zadania i osoby

### TASK-P1-05 - Podgląd zadania jako ten sam formularz co tworzenie

Status: `[x]`

Cel: tworzenie, podgląd i edycja zadania używają tego samego wzorca UX i tego samego modelu interakcji.

Zakres:

- [x] Utrzymać jeden layout formularza.
- [x] Dopracować modal height i sticky footer.
- [x] Dodać czytelny auto-save status: `Zapisano`, `Zapisywanie...`, `Błąd zapisu`.
- [x] Powiększyć targety akcji do min. 44 px.
- [x] Zablokować scroll tła po otwarciu modalu.
- [x] Przywracać poprzedni `body.style.overflow` po zamknięciu create modalu.
- [x] Podbić kontrast chipów osoby/tagów.

Ustalenia 2026-06-23:

- `TaskDetailsPanel` w trybie `presentation="modal"` używa wspólnego `TaskCreateForm`, więc podgląd i tworzenie bazują na tym samym formularzu.
- Kontrakt CSS utrzymuje `max-height: min(820px, calc(100dvh - 48px))`, internal body scroll, sticky footer i 44 px targety.
- Footer podglądu pokazuje autosave status przez `aria-live="polite"`.
- Dodano regresję dla create modalu: scroll lock przywraca poprzedni stan `body.style.overflow`, zamiast czyścić go do pustej wartości.

Pliki:

- `src/tasks/TaskCreateForm.tsx`
- `src/tasks/TaskCreateModal.tsx`
- `src/tasks/TaskDetailsPanel.tsx`
- `src/tasks/TasksWorkspaceViewStyles.css`
- `src/tasks/TaskPreviewModal.contract.test.ts`

Kryteria akceptacji:

- [x] Preview i create wyglądają spójnie.
- [x] Nie ma dwóch konkurujących scrollbarów.
- [x] Footer nie przykrywa sekcji AI/opisu.
- [x] Focus-visible jest widoczny.
- [x] Scroll tła jest blokowany i poprawnie odtwarzany po zamknięciu modalu.

Walidacja:

```bash
pnpm exec vitest run src/tasks/TaskPreviewModal.contract.test.ts src/tasks/TaskDetailsPanel.test.tsx src/tasks/TaskCreateForm.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

### TASK-P1-06 - Szczegóły osoby jako osobna powierzchnia zarządzania

Status: `[x]`

Cel: lista osób nie pokazuje prawego preview panelu, a kliknięcie rekordu prowadzi do pełnych szczegółów osoby.

Zakres:

- [x] Usunąć prawy preview panel z listy osób.
- [x] Kliknięcie osoby prowadzi do szczegółów.
- [x] W szczegółach dodać zarządzanie, edycję i usuwanie.
- [x] Dodać confirm/error state dla usuwania.
- [x] Zweryfikować mobile 390 px.

Evidence 2026-06-23:

- `src/PeopleTab.tsx` używa `people-directory-layout no-preview` dla listy i osobnego `viewMode="detail"` dla szczegółów.
- `src/PeopleTab.test.tsx` pokrywa wejście lista -> szczegóły, akcje edycji/AI/usuwania i błąd usuwania.
- Screenshoty mobile istnieją w `docs/audits/screenshots/people-directory-mobile-390x844.png` i `docs/audits/screenshots/people-detail-mobile-390x844.png`.

Pliki:

- `src/PeopleTab.tsx`
- `src/ProfileTab.tsx`
- `src/ProfileTab.test.tsx`
- `src/lib/people.ts`
- `src/hooks/usePeopleProfiles.ts`

Kryteria akceptacji:

- [x] Lista osób jest katalogiem, bez prawego panelu.
- [x] Szczegóły osoby są osobnym ekranem zarządzania.
- [x] Usuwanie wymaga potwierdzenia i obsługuje błąd.

Walidacja:

```bash
pnpm exec vitest run src/PeopleTab.test.tsx src/ProfileTab.test.tsx --coverage.enabled=false
pnpm run typecheck:all
```

## P2 - UX, layout i design system

### TASK-P2-01 - Globalny layout shell

Status: `[~]`

Cel: wszystkie ekrany używają jednego shell: sidebar, topbar, content, padding i responsive breakpoints.

Zakres:

- Utrzymać `--sidebar-width: 260px`.
- Usunąć lokalne kompensacje sidebara.
- Nie stosować globalnego `max-width` dla całej strony.
- Utrzymać pełne nazwy menu na desktopie.
- Sprawdzić viewporty 1440, 1280, 1024, 768, 390.

Pliki:

- `src/styles/modern-layout.css`
- `src/index.css`
- `src/AppSidebar.tsx`
- `src/AppHeader.tsx`
- style ekranów głównych

Kryteria akceptacji:

- Sidebar ma tę samą szerokość na każdym ekranie desktop.
- Content zaczyna się zaraz po sidebarze.
- Nie ma pustych pasów po lewej/prawej.
- Mobile nav otwiera się i zamyka przewidywalnie.

Walidacja:

```bash
pnpm run lint:css
pnpm run typecheck:all
```

### TASK-P2-02 - UI primitives

Status: `[ ]`

Cel: button, input, select, checkbox, card, table i modal mają wspólne klasy, tokeny i stany.

Zakres:

- Zdefiniować minimalne `.ui-button`, `.ui-input`, `.ui-select`, `.ui-checkbox`, `.ui-card`, `.ui-table`, `.ui-modal`, `.ui-badge`.
- Dodać hover/focus-visible/disabled.
- Dodać `cursor: pointer` dla elementów interaktywnych.
- Zacząć od Studio links, Notes icon buttons i Tasks toolbar.

Pliki:

- `src/styles/reference-ui.css`
- `src/styles/modern-layout.css`
- `src/studio/StudioMeetingViewStyles.css`
- `src/NotesTabStyles.css`
- `src/tasks/TasksWorkspaceViewStyles.css`

Kryteria akceptacji:

- Elementy klikalne mają pointer, hover i focus-visible.
- Nie ma przypadkowych wariantów tego samego elementu.
- Nowe formularze korzystają z primitive albo zgodnych tokenów.

Walidacja:

```bash
pnpm run lint:css
pnpm run typecheck:all
```

### TASK-P2-03 - Responsywność kluczowych widoków

Status: `[ ]`

Cel: kluczowe widoki działają czytelnie na 1440, 1280, 1024, 768 i 390 px.

Zakres:

- Studio: detail meeting i empty state.
- Nagrania: toolbar, tabela, empty state.
- Kalendarz: week view i agenda na tablet/mobile.
- Zadania: toolbar, tabbar, tabela, modal.
- Osoby: katalog i szczegóły.
- Notatki: trzy panele i empty states.

Pliki:

- `tests/e2e/layout-visual.spec.js`
- `src/styles/modern-layout.css`
- style ekranów głównych

Kryteria akceptacji:

- Brak poziomego overflow poza kontrolowanymi tabelami.
- Główne akcje są widoczne i klikalne.
- Teksty nie są przypadkowo ucinane na desktopie.

Walidacja:

```bash
pnpm exec playwright test tests/e2e/layout-visual.spec.js --project=chromium
pnpm run lint:css
```

## P2 - jakość danych i copy

### TASK-P2-04 - Mojibake gate dla release-critical files

Status: `[x]`

Cel: polskie copy w UI, API i dokumentach release nie ma uszkodzonych znaków.

Zakres:

- Utrzymać `pnpm run audit:mojibake`.
- Rozszerzać listę plików release-critical, gdy dochodzą nowe surface.
- Nie dodawać allowlist bez uzasadnienia.

Pliki:

- `scripts/audit-mojibake.mjs`
- `scripts/release-readiness.test.ts`
- aktywne pliki UI/API/docs

Kryteria akceptacji:

- Audit przechodzi.
- Nowe user-facing copy jest czystym UTF-8.

Walidacja:

```bash
pnpm run audit:mojibake
```

## P3 - dokumentacja i porządki

### TASK-P3-01 - GitHub Issues z backlogu

Status: `[ ]`

Cel: przenieść zadania z tego pliku do GitHub Issues, żeby wykonanie było śledzone issue -> branch -> PR -> CI evidence -> close.

Zakres:

- Utworzyć issue dla każdego zadania P0/P1.
- Dodać label `area:*`, priorytet i acceptance criteria.
- Oznaczyć zadania gotowe do autonomicznej pracy `agent:ready` i `autopilot:allowed`.
- Zadania wymagające decyzji oznaczyć `needs-product-decision`.

Pliki:

- brak zmian kodu

Kryteria akceptacji:

- Każde P0/P1 ma GitHub Issue.
- Issue ma jasną walidację i kryteria akceptacji.

Walidacja:

```bash
gh issue list --repo maniczko/audioRecorder --limit 50
```

### TASK-P3-02 - Release notes po domknięciu P0/P1

Status: `[ ]`

Cel: przygotować krótkie release notes z rzeczywistą walidacją i znanymi ryzykami.

Zakres:

- Opisać zmiany security.
- Opisać zmiany audio/transcription.
- Opisać zmiany UX zadań/osób.
- Wpisać komendy, które przeszły.
- Wpisać blokery i ryzyka.

Pliki:

- `docs/PRODUCTION_HARDENING_TASKS.md`
- `docs/AUDIO_PROD_SMOKE.md`
- `docs/PRODUCTION_CORS.md`

Kryteria akceptacji:

- Nowy developer wie, jak zweryfikować release.
- Znane ograniczenia są jawne.

Walidacja:

```bash
pnpm run audit:mojibake
```

## Sugerowana kolejność

1. `TASK-P0-01` - connectivity backend/Supabase/audio.
2. `TASK-P0-02` - pełny release gate na Node 22.
3. `TASK-P1-05` - podgląd zadania jako ten sam formularz.
4. `TASK-P1-06` - szczegóły osoby bez prawego preview panelu.
5. `TASK-P1-03` - audyt kosztowych endpointów po hardeningu.
6. `TASK-P1-01` - production smoke dla kompletnej ścieżki audio.
7. `TASK-P2-01` - globalny layout shell.
8. `TASK-P2-02` - UI primitives.
9. `TASK-P2-03` - responsywność kluczowych widoków.
10. `TASK-P3-01` - GitHub Issues z backlogu.
