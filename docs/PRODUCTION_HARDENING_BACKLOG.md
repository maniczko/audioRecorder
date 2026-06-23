# AudioRecorder / VoiceLog OS - backlog produkcyjny

Data: 2026-06-19

Cel dokumentu: zebrać najważniejsze zadania potrzebne do stabilnego publicznego wydania produkcyjnego. Backlog nie zastępuje GitHub Issues, ale może posłużyć jako źródło do rozbicia prac na issue/PR.

## P0 - blokery produkcyjne

### P0-1. Production smoke audio end-to-end

Status: wdrożone lokalnie 2026-06-20. Dowody: `pnpm exec vitest run -c vitest.scripts.config.ts scripts/audio-prod-smoke.test.ts`, `pnpm run test:server:retry`, `pnpm run typecheck:all`.

Problem: brakuje jednego automatycznego smoke testu potwierdzającego, że pełny przepływ audio działa po deployu.

Zakres:

- Sprawdzić `/health`.
- Potwierdzić `supabaseRemote: true`.
- Zalogować użytkownika testowego.
- Wgrać krótki fixture audio.
- Uruchomić transkrypcję.
- Pollować status do `done`, `empty` albo `failed`.
- Potwierdzić zapis transcriptu albo kontrolowany empty transcript.
- Sprawdzić download audio.
- Sprawdzić retry-transcribe dla stanów completed/processing.
- Generować JSON report.

Kryteria akceptacji:

- Istnieje komenda `pnpm run release:audio-prod-smoke`.
- Raport JSON zawiera status każdego kroku, requestId i diagnostykę błędów.
- Smoke nie wymaga ręcznych kliknięć.
- Smoke nie loguje sekretów ani pełnych transkryptów.

Walidacja:

- `pnpm run release:audio-prod-smoke`
- `pnpm run test:server:retry`

Pliki:

- `server/scripts/audio-prod-smoke.ts`
- `docs/AUDIO_PROD_SMOKE.md`
- `package.json`

### P0-2. Stabilizacja widoczności nowych nagrań

Status: częściowo wdrożone lokalnie 2026-06-20. Lista nagrań scala rekordy z lokalnej kolejki i backendu oraz pokazuje konkretne statusy: `Wgrywanie`, `Wgrane`, `Transkrypcja`, `Gotowe`, `Brak mowy`, `Błąd`. Dowody: `pnpm exec vitest run src/RecordingsTab.test.tsx --coverage.enabled=false`, `pnpm run typecheck:all`. Do domknięcia: Playwright smoke Studio -> nagranie -> Nagrania oraz ewentualny backend refresh/retry UX.

Problem: po wykonaniu nagrania użytkownik nie zawsze widzi je na liście nagrań albo nie wie, czy jest jeszcze przetwarzane.

Zakres:

- Prześledzić przepływ `MediaRecorder -> queue -> upload -> media_assets -> workspace state -> recordings list`.
- Upewnić się, że lista nagrań pokazuje zarówno rekordy z lokalnej kolejki, jak i rekordy z backendu.
- Dodać statusy: `uploading`, `uploaded`, `transcribing`, `ready`, `empty transcript`, `failed`.
- Dodać kontrolowany retry i refresh.
- Dodać regresję dla scenariusza: nagraj 4 sekundy -> upload ok -> rekord widoczny na liście.

Kryteria akceptacji:

- Nowe nagranie pojawia się na liście bez ręcznego reloadu strony.
- Użytkownik widzi status przetwarzania.
- Brak transcriptu nie wygląda jak zniknięcie nagrania.

Walidacja:

- `pnpm exec vitest run src/store/recorderQueueProcessor.test.ts src/RecordingsTab.test.tsx --coverage.enabled=false`
- Playwright smoke: Studio -> nagranie -> Nagrania.

Pliki:

- `src/store/recorderQueueProcessor.ts`
- `src/store/recorderStore.ts`
- `src/RecordingsTab.tsx`
- `src/services/mediaService.ts`

### P0-3. Trwałe limity kosztów AI

Status: wdrożone lokalnie 2026-06-20. `/ai/*` korzysta z adaptera `AiQuotaStore`: DB-backed store dla środowisk nietestowych z DB oraz memory fallback dla local/test. Dodany test potwierdza, że dwie instancje aplikacji współdzielą quota przez ten sam DB store i druga instancja zwraca `429` z `Retry-After`. Dowody: `pnpm exec vitest run -c server/vitest.config.ts server/tests/lib/aiQuotaStore.test.ts server/tests/routes/ai.test.ts --coverage.enabled=false`, `pnpm run test:server:retry`, `pnpm run typecheck:all`, `pnpm run audit:mojibake`.

Problem: limity `/ai/*` są obecnie in-memory, więc nie są odporne na restart procesu ani wiele instancji.

Zakres:

- Przenieść quota counters do shared storage: Redis/Upstash albo Supabase/Postgres.
- Zachować obecne limity per user, workspace, IP i endpoint.
- Dodać TTL/okna czasowe dla hour/day/minute.
- Dodać migrację albo adapter storage.
- Zachować in-memory fallback tylko dla local/test.

Kryteria akceptacji:

- Limity działają między restartami procesu.
- Dwie instancje aplikacji współdzielą quota.
- Przekroczenie limitu zwraca `429` i `Retry-After`.

Walidacja:

- `pnpm run test:server:retry`
- test integracyjny adaptera quota storage.

Pliki:

- `server/routes/ai.ts`
- nowy `server/lib/aiQuotaStore.ts`
- testy w `server/tests/lib/` i `server/tests/routes/ai.test.ts`

### P0-4. Audit wszystkich kosztowych endpointów

Status: wdrożone lokalnie 2026-06-20. Dodano raport `docs/COSTLY_ENDPOINTS_SECURITY_AUDIT.md` oraz kontraktowy test anonymous=401 dla kosztowych tras poza `/ai`: STT, retry-transcribe, live transcribe, meeting analyze, RAG ask, voice coaching, rediarize, sketchnote i voice profile embedding. Dowody: `pnpm exec vitest run -c server/vitest.config.ts server/tests/routes/costly-endpoints-auth.test.ts --coverage.enabled=false`, `pnpm run test:server:retry`, `pnpm run typecheck:all`.

Problem: `/ai/*` zostało zabezpieczone, ale trzeba potwierdzić, że żaden inny endpoint LLM/STT/image/analyze nie działa anonimowo.

Zakres:

- Zrobić grep po providerach: OpenAI, Anthropic, Gemini, Groq, transcribe, analyze.
- Sprawdzić auth/membership/rate limit dla każdego kosztowego endpointu.
- Dodać testy anonymous = `401`.
- Dodać testy no membership = `403`, jeśli endpoint dotyczy workspace/recording/meeting.

Kryteria akceptacji:

- Lista kosztowych endpointów jest udokumentowana.
- Każdy endpoint ma test anonymous rejection.
- Żaden kosztowy endpoint nie działa bez sesji.

Walidacja:

- `pnpm run test:server:retry`
- raport grep w PR description.

Pliki:

- `server/routes/media.ts`
- `server/routes/ai.ts`
- `server/routes/*`
- `server/tests/routes/*`

## P1 - security, dane i operacje

### P1-1. Data retention i pełne delete recording

Problem: usunięcie nagrania powinno usuwać wszystkie powiązane dane i obiekty storage.

Zakres:

- Dodać setting `retentionDays` na workspace.
- Delete recording usuwa:
  - `media_assets` row,
  - plik audio w Supabase/local storage,
  - transcript payload,
  - part transcripts,
  - vector/RAG rows, jeśli istnieją,
  - powiązane job/status rows.
- Dodać audit log deletion.
- Dodać job cleanup dla retencji.

Kryteria akceptacji:

- Delete recording usuwa storage object mock w teście.
- Nie zostają osierocone transcript/vector rows.
- Operacja jest audytowana bez logowania treści transcriptu.

Walidacja:

- `pnpm run test:server:retry`
- test regresji w `server/tests/routes/media.test.ts` albo `server/tests/regression/`.

Pliki:

- `server/routes/media.ts`
- `server/database/*`
- `server/lib/periodicCleanup.ts`
- `server/tests/routes/media.test.ts`

### P1-2. CORS, tokeny i SSE hardening

Problem: produkcja musi mieć twardy kontrakt CORS i nie może akceptować query tokenów poza krótkotrwałym progress tokenem.

Zakres:

- Potwierdzić, że `?token=` jest odrzucony w `NODE_ENV=production`.
- Progress token ma TTL, jest przypięty do `recordingId` i wygasa.
- Production CORS nie dopuszcza wildcard z credentials.
- Vercel previews tylko gdy `VOICELOG_ALLOW_VERCEL_PREVIEWS=true`.

Kryteria akceptacji:

- Production query token rejected.
- Bearer token działa.
- Progress token działa tylko dla danego recordingId i wygasa.
- Disallowed origin nie dostaje credentials.

Walidacja:

- `pnpm run test:server:retry`
- targeted middleware tests.

Pliki:

- `server/routes/middleware.ts`
- `server/lib/progressTokens.ts`
- `server/lib/serverUtils.ts`
- `server/tests/middleware.test.ts`

### P1-3. Node 22 jako jedyny runtime produkcyjny

Problem: lokalnie pojawia się ostrzeżenie, że repo oczekuje Node 22, a uruchomienie było na Node 24.

Zakres:

- Dodać/sprawdzić `.nvmrc`, `.node-version`, `engines`, config Railway/Vercel/CI.
- Udokumentować instalację Node 22.
- Upewnić się, że CI używa Node 22.

Kryteria akceptacji:

- `pnpm install` nie ostrzega o niezgodnym runtime w środowisku docelowym.
- CI, local docs i production config wskazują Node 22.

Walidacja:

- `node -v`
- `pnpm run typecheck:all`
- `pnpm run test:server:retry`

Pliki:

- `package.json`
- `.nvmrc`
- `.node-version`
- `.github/workflows/*`
- docs setup.

### P1-4. Mojibake i UTF-8 clean release

Problem: w części plików/logów widać uszkodzone polskie znaki.

Zakres:

- Uruchomić `pnpm run audit:mojibake`.
- Naprawić user-facing copy i release-critical logs.
- Dodać test/allowlist dla znanych false positives.

Kryteria akceptacji:

- User-facing UI i API messages są UTF-8 clean.
- Audit przechodzi albo ma jawny allowlist z uzasadnieniem.

Walidacja:

- `pnpm run audit:mojibake`
- `pnpm run test:frontend:ci` dla dotkniętych komponentów.

Pliki:

- `src/**`
- `server/**`
- `docs/**`

## P1 - UX krytyczny

### P1-5. Statusy transkrypcji w Studio i Nagraniach

Problem: użytkownik nie rozumie, czy transkrypcja nie istnieje, jest w trakcie, czy nie udała się.

Zakres:

- Dodać jeden model statusu transkrypcji.
- Pokazywać diagnostykę: `w kolejce`, `transkrybuje`, `gotowe`, `brak mowy`, `błąd`, `retry`.
- Ujednolicić Studio detail i Nagrania list.

Kryteria akceptacji:

- Pusty panel transkrypcji nigdy nie jest jedyną informacją.
- Użytkownik ma jasną akcję retry przy błędzie.

Walidacja:

- component tests dla statusów.
- Playwright screenshot Studio/Nagrania.

Pliki:

- `src/studio/StudioMeetingView.tsx`
- `src/RecordingsTab.tsx`
- `src/lib/recordingQueue.ts`

### P1-6. Formularz zadań jako jeden komponent

Problem: formularz zadania występuje w kilku miejscach i łatwo o rozjazdy UX.

Zakres:

- Utrzymać jeden komponent dla create/edit/preview.
- Obsłużyć wiele osób w zadaniu.
- Poprawić tag multi-select.
- Dodać status auto-save: `Zapisano`, `Zapisywanie`, `Błąd zapisu`.
- Targety klikane min. 44px.

Kryteria akceptacji:

- Ten sam formularz działa z zakładki Zadania i ze Studio.
- Można przypisać kilka osób.
- Można wybrać i usunąć wiele tagów.
- Podgląd i dodawanie mają ten sam layout.

Walidacja:

- `pnpm exec vitest run src/lib/tasks.coverage.test.ts src/*Task*.test.tsx --coverage.enabled=false`
- Playwright modal create/edit/preview.

Pliki:

- `src/tasks/TaskCreateForm.tsx`
- `src/tasks/TaskDetailsPanel.tsx`
- `src/lib/tasks.ts`

### P1-7. Osoby: szczegóły jako osobny ekran

Problem: prawy preview panel konkuruje z listą i nie daje pełnego miejsca na zarządzanie osobą.

Zakres:

- Usunąć prawy preview panel z listy osób.
- Kliknięcie osoby przenosi do szczegółów.
- W szczegółach dodać zarządzanie, edycję i usuwanie.
- Zachować responsywność mobile.

Kryteria akceptacji:

- Lista osób nie pokazuje prawego preview panelu.
- Kliknięcie rekordu otwiera szczegóły.
- Szczegóły mają akcje: edytuj, usuń, zarządzaj profilem AI.

Walidacja:

- `pnpm exec vitest run src/PeopleTab*.test.tsx --coverage.enabled=false`
- Playwright desktop/mobile.

Pliki:

- `src/PeopleTab.tsx`
- `src/lib/people.ts`
- style People.

## P2 - porządek techniczny i design system

### P2-1. Porządek w screenshotach i artefaktach

Problem: root repo zawiera wiele nieśledzonych screenshotów z audytów UI.

Zakres:

- Przenieść wybrane baseline screenshots do `docs/audits/screenshots/`.
- Resztę artefaktów dodać do `.gitignore` albo trzymać w temp.
- Opisać workflow screenshot evidence.

Kryteria akceptacji:

- `git status --short` nie pokazuje przypadkowych PNG w root.
- Baseline screenshots są tylko tam, gdzie mają wartość dokumentacyjną.

Walidacja:

- `git status --short`
- review `.gitignore`.

Pliki:

- `.gitignore`
- `docs/audits/screenshots/`
- docs workflow.

### P2-2. UI primitives i redukcja rozjazdów CSS

Problem: te same button/input/card/table/modal są stylowane lokalnie na wielu ekranach.

Zakres:

- Ustandaryzować klasy/primitives:
  - button,
  - icon button,
  - input/search,
  - select,
  - checkbox,
  - badge/status,
  - card/panel,
  - table,
  - modal.
- Stopniowo podmieniać lokalne style bez zmiany logiki.

Kryteria akceptacji:

- Nowe formularze i listy używają wspólnych primitives.
- Interaktywne elementy mają `cursor: pointer`, hover, focus-visible i disabled state.

Walidacja:

- `pnpm run lint:css`
- visual smoke na głównych ekranach.

Pliki:

- `src/styles/reference-ui.css`
- `src/styles/modern-layout.css`
- style ekranów.

### P2-3. Dokumentacja release gate

Problem: projekt ma dużo komend testowych i smoke, ale potrzebny jest jeden krótki release gate dla publicznego wydania.

Zakres:

- Spisać kolejność walidacji.
- Dodać checklistę envów produkcyjnych.
- Dodać checklistę rollbacku.
- Dodać linki do raportów smoke.

Kryteria akceptacji:

- Release można wykonać z jednego dokumentu bez szukania po historii czatu.
- Checklist uwzględnia audio, auth, Supabase, AI quota i UI smoke.

Walidacja:

- review dokumentu przez release ownera.

Pliki:

- `docs/RELEASE_GATE_PUBLIC_PROD.md`

## Proponowana kolejność realizacji

1. P0-1 Production smoke audio end-to-end.
2. P0-2 Stabilizacja widoczności nowych nagrań.
3. P0-3 Trwałe limity kosztów AI.
4. P0-4 Audit wszystkich kosztowych endpointów.
5. P1-1 Data retention i pełne delete recording.
6. P1-5 Statusy transkrypcji w Studio i Nagraniach.
7. P1-6 Formularz zadań jako jeden komponent.
8. P1-7 Osoby: szczegóły jako osobny ekran.
9. P1-2 CORS, tokeny i SSE hardening.
10. P1-3 Node 22 jako jedyny runtime produkcyjny.
11. P1-4 Mojibake i UTF-8 clean release.
12. P2-1, P2-2, P2-3 jako porządkowanie po stabilizacji P0/P1.
