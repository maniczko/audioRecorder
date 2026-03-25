# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-25)

**Zrealizowane zadania:**
- ✅ Docker security & reproducibility (101-104) — pinned images, torch-deps stage, resource limits, .env.example
- ✅ Audio pipeline optimizations (301-302, 310-312, 350-352) — parallel VAD+diarization, pyannote cache, memoization, code splitting, FFmpeg threads
- ✅ CI fixes (209-433) — wszystkie historyczne fixy zrealizowane
- ✅ CI fix `434` — Naprawiono test retries HTTP klienta (Server Tests)
- ✅ PROD fix `435` — Dodano logiczny fallback API zaplecza do zmiennych konfiguracyjnych dla środowiska Vercela
- ✅ UX fix `427` — Naprawiono pusty stan w oknie Studio występujący podczas aktywnego nagrywania

**Pozostalo do zrobienia:**
- 🟢 `201`, `208` — testy AI routes i coverage ProfileTab.tsx
- 🟢 `303-305`, `320-322`, `330-332` — optymalizacje performance (GPU, batch embeddings, HTTP/2, models)
- 🟢 `340-342` — monitoring & profiling
- 🟢 `080`, `018` — CSS cleanup i Outlook integracja
- 🟢 `401-407` — CSS Layout Cleanup

## Sprint: refactor architektury

Cel sprintu: zmniejszyc sprzezenia miedzy backendem, stanem frontendu i widokami, zeby dalszy rozwoj nie wymagal dotykania jednego wielkiego pliku.

Kolejnosc prac:
1. kontrakty danych i typy wspolne
2. backend bootstrap i orchestration pipeline
3. frontend state, hooks i services
4. `TabRouter` i ekrany
5. testy kontraktowe i regresyjne
6. porzadki layout / UX po stabilizacji architektury

## Otwarta kolejka

### Codex

- Brak otwartych zadan.

### Gemini High
- `201` [P1] `todo` - testy `ai/routes.ts`
  - Cel: podniesc coverage AI routes z 26% do 80%+.
  - Zakres: `/ai/analyze`, `/ai/suggest-tasks`, `/ai/search`, fallbacki i timeouty.
- `208` [P1] `todo` - coverage `ProfileTab.tsx`
  - Cel: podniesc coverage `ProfileTab.tsx` z 2% do 60%.
  - Zakres: render, interakcje, walidacja formularza, integracja z authStore.

### GPT
## Optymalizacja wydajności

### Pipeline audio

- `303` [P2] `todo` - [PERF] Optymalizacja chunking STT — overlap reduction
  - Cel: zmniejszyć redundancję i czas Whisper.
  - Problem: `CHUNK_OVERLAP_SECONDS` może dublować 10-15% audio.
  - Rozwiązanie: adaptacyjny overlap (0.5s dla ciszy, 2s dla mowy).
  - Akceptacja: redukcja tokenów Whisper o 20%+.

- `304` [P2] `todo` - [PERF] GPU acceleration dla pyannote w Docker
  - Cel: przyspieszyć diaryzację 5-10x.
  - Zakres: NVIDIA runtime w docker-compose, CUDA base image, torch z GPU.
  - Akceptacja: diarization 10min nagrania < 60s na GPU vs 600s CPU.

- `305` [P2] `todo` - [PERF] Batch embedding speaker clips
  - Cel: przyspieszyć generowanie embeddingów głosów.
  - Problem: pojedyncze zapytania do API per speaker clip.
  - Rozwiązanie: batchować wszystkie clipy jednego spotkania w jednym requeście.
  - Akceptacja: redukcja zapytań embeddings z N→1 per meeting.

### Frontend performance

### Backend / API

- `320` [P2] `todo` - [PERF] HTTP/2 + keep-alive dla external APIs
  - Cel: zmniejszyć latency do OpenAI/Groq/HuggingFace.
  - Zakres: reuse HTTP connections, enable HTTP/2 w fetch/axios.
  - Akceptacja: p95 latency do API zewnętrznych < 500ms.

- `321` [P2] `todo` - [PERF] Database connection pooling tuning
  - Cel: obsłużyć 50+ równoczesnych żądań.
  - Zakres: SQLite WAL mode + proper pooling, lub migracja do PostgreSQL.
  - Akceptacja: 100 req/s bez timeoutów, p95 < 100ms.

- `322` [P3] `todo` - [PERF] Streaming transcription progress
  - Cel: realtime update postępu zamiast polling.
  - Zakres: Server-Sent Events lub WebSocket do pushowania progressu.
  - Akceptacja: UI aktualizuje się na żywo co 1-2s podczas transkrypcji.

### Model optimization

- `330` [P1] `todo` - [PERF] Mniejszy model Whisper dla trybu fast
  - Cel: 3x szybsza transkrypcja w trybie fast.
  - Zakres: `distil-whisper` lub `whisper-tiny` dla VOICELOG_PROCESSING_MODE=fast.
  - Akceptacja: transkrypcja 10min < 2min z akceptowalną dokładnością.

- `331` [P2] `todo` - [PERF] Quantization pyannote model
  - Cel: zmniejszyć zużycie RAM i przyspieszyć inferencję.
  - Zakres: torch quantization INT8 dla pyannote 3.1.
  - Akceptacja: RAM usage < 2GB vs 4GB, speedup 1.5x.

- `332` [P3] `todo` - [PERF] ONNX Runtime dla Silero VAD
  - Cel: przyspieszyć VAD na CPU.
  - Zakres: Silero VAD w ONNX zamiast torch.hub.
  - Akceptacja: VAD 10min nagrania < 5s.

## Monitoring & Profiling

- `340` [P2] `todo` - [OBS] Dodaj metryki wydajności pipeline
  - Cel: mierzyć czas każdego etapu (VAD, STT, diarization, post-process).
  - Zakres: logowanie duration per stage, histogramy, p50/p95/p99.
  - Akceptacja: dashboard z medianami i percentylami per etap.

- `341` [P2] `todo` - [OBS] Memory profiling w production
  - Cel: wykrywać memory leaks.
  - Zakres: `clinic.js` lub `0x` profiling w Docker, heap snapshots.
  - Akceptacja: memory stabilne po 100+ transkrypcjach.

- `342` [P3] `todo` - [OBS] APM integration (DataDog/NewRelic)
  - Cel: end-to-end tracing żądań.
  - Zakres: distributed tracing od frontendu po Python scripts.
  - Akceptacja: flame graph pokazuje wąskie gardła.

## Quick wins (1-2h)

- `080` [P3] `todo` - [CSS] Konsolidacja plików i usunięcie `!important`
  - Cel: Oczyszczenie `tasks.css` i `StudioMeetingViewStyles.css` oraz likwidacja tagów `!important`.
  - Migracja kilkuset twardych bindowań paddingów/wielkości na tokeny z `index.css`.

- `018` [P3] `todo` - Outlook / Microsoft To Do / Microsoft Calendar
  - Cel: rozszerzyc integracje poza ekosystem Google.
  - Akceptacja: logowanie MSAL OAuth2, synchronizacja z Microsoft To Do, integracja z Outlook Calendar.

## CSS Layout Cleanup

- `401` [P0] `todo` - [CSS] Remove all `!important` declarations
  - Cel: przywrocic kaskade CSS i ulatwic utrzymanie.
  - Zakres: 13 wystąpień w `App.css`, `studio.css`, `tasks.css`, `NotesTabStyles.css`.
  - Akceptacja: `grep -r "!important" src/` zwraca 0 wyników.

- `402` [P1] `todo` - [CSS] Remove duplicate CSS blocks
  - Cel: zmniejszyć rozmiar bundle i uniknąć konfliktów.
  - Zakres: `tasks.css` (4x duplicate panel styles), `App.css` + `studio.css` (duplicate `.energy-*`).
  - Akceptacja: brak duplikatów, bundle size -33%.

- `403` [P1] `todo` - [CSS] Migrate inline styles to CSS variables
  - Cel: enable theme'owanie i responsive design.
  - Zakres: `JapaneseThemeSelector.tsx` (25+), `TaskKanbanView.tsx` (6), `RecordingsTab.tsx` (2).
  - Akceptacja: <20 inline styles w kodzie.

- `404` [P2] `todo` - [CSS] Add missing design tokens
  - Cel: eliminacja hardcoded values.
  - Zakres: colors (`--energy-*`), spacing, font-sizes w `index.css`.
  - Akceptacja: wszystkie magic numbers zastąpione tokenami.

- `405` [P2] `todo` - [CSS] Create reusable `<ProgressBar>` component
  - Cel: unifikacja progress bars across app.
  - Zakres: nowy komponent + CSS module.
  - Akceptacja: użyty w `RecordingsTab`, `TaskKanbanView`, `RecordingPipelineStatus`.

- `406` [P3] `todo` - [CSS] Add Stylelint configuration
  - Cel: automatyczne wykrywanie problemów z CSS.
  - Zakres: `.stylelintrc.json`, `stylelint` w devDependencies.
  - Akceptacja: `pnpm lint:css` działa w CI.

- `407` [P3] `todo` - [CSS] Document CSS conventions
  - Cel: ujednolicenie stylu w zespole.
  - Zakres: `CSS_GUIDELINES.md` z BEM-lite, specificity rules, mobile-first.
  - Akceptacja: dokument zatwierdzony, link w README.

## Uwagi

- Nie dopisuje tu zakonczonych zadan. Sa w [`TASK_DONE.md`](TASK_DONE.md).
- Jesli chcesz, moge tez przygotowac osobna sekcje `in_progress` i `blocked`, kiedy pojawi sie taka potrzeba.
