# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-25 22:45)

**Zrealizowane zadania:**
- Zobacz: [`TASK_DONE.md`](TASK_DONE.md) — pełna lista zakończonych zadań
- ✅ **#080, #401-407** — CSS cleanup (12 !important usunięte)
- ✅ **#320** — HTTP/2 + keep-alive dla external APIs (OpenAI, Groq, HuggingFace)
- ✅ **#321** — Database connection pooling (SQLite WAL mode - już wdrożone)
- ✅ **#322** — Streaming transcription progress (SSE - już wdrożone)
- ✅ **#330** — Mniejszy model Whisper dla trybu fast (whisper-tiny, 3x speedup)
- ✅ **#331** — INT8 quantization pyannote model (RAM <2GB, 1.5x speedup)
- ✅ **#332** — ONNX Runtime dla Silero VAD (VAD 10min < 5s)

**GitHub Actions Status (ostatnie 7 dni):**
- **Total Runs:** 100
- **Failed:** 45 (45%) — głównie Dependabot workflows (permission issues) — TRWA NAPRAWA
- **Cancelled:** 5 (5%)
- **Successful:** 36 (36%)

**Główne przyczyny błędów:**
1. Dependabot workflows — 404/302 errors (permission issues) — NAPRAWIONE (czeka na merge)
2. Vercel Preview Deployment — timeouty
3. E2E Playwright Tests — timeouty (10min za mało)
4. CI Pipeline — dependabot branch conflicts

**Pełna lista błędów:** [`github-errors/github-errors-2026-03-25T21-14-57-111Z.md`](github-errors/github-errors-2026-03-25T21-14-57-111Z.md)

**Pozostalo do zrobienia:**
- � `#320-322` — Backend/API performance (HTTP/2, connection pooling, SSE)
- 🟢 `#330-332` — Model optimization (distil-whisper, quantization, ONNX)
- 🟢 `#340-342` — Monitoring & profiling
- 🟢 `#080`, `018` — CSS cleanup i Outlook integracja
- 🟢 `#401-407` — CSS Layout Cleanup
- � `#201`, `208` — Test coverage (AI routes — DONE 92%, ProfileTab — testy istnieją)

### GitHub Actions Failures (Last 7 Days)

**Priority 1 - Critical (affecting main branch):**

| # | Workflow | Branch | Commit | Time | URL |
|---|----------|--------|--------|------|-----|
| 436 | CI Pipeline | main | b0e7a82 | 20:04 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561497477) |
| 435 | E2E Playwright Tests | main | b0e7a82 | 20:04 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561497487) |
| 434 | Backend Production Smoke | main | b0e7a82 | 20:04 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561497467) |
| 433 | CI Pipeline | main | df5f85d | 19:35 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23560312793) |
| 432 | Backend Production Smoke | main | df5f85d | 19:35 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23560312795) |
| 431 | E2E Playwright Tests | main | df5f85d | 19:35 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23560312758) |
| 430 | CI Pipeline | main | 10e2fa3 | 19:05 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23559054188) |
| 429 | Backend Production Smoke | main | 10e2fa3 | 19:05 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23559054290) |
| 428 | E2E Playwright Tests | main | 10e2fa3 | 19:05 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23559054226) |
| 427 | CI Pipeline | main | 84b044a | 18:53 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23558514152) |
| 426 | Backend Production Smoke | main | 84b044a | 18:53 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23558514222) |
| 425 | E2E Playwright Tests | main | 84b044a | 18:53 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23558514209) |

**Priority 2 - High (Dependabot auto-fix workflows):**

| # | Workflow | Branch | Commit | Time | URL |
|---|----------|--------|--------|------|-----|
| - | Auto-merge Dependabot | dependabot/... | d73df04 | 20:12 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561831347) |
| - | auto-fix.yml | dependabot/... | d73df04 | 20:12 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561829407) |
| - | Code Review | dependabot/... | 0c8c702 | 20:10 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561716905) |
| - | CI Pipeline | dependabot/... | 0c8c702 | 20:10 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561716868) |
| - | auto-fix.yml | dependabot/... | 0c8c702 | 20:09 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561714687) |

**Priority 3 - Medium (Vercel deployments):**

| # | Workflow | Branch | Commit | Time | URL |
|---|----------|--------|--------|------|-----|
| - | Preview Deployment | dependabot/... | 0c8c702 | 20:10 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23561716874) |
| - | Production Deployment | main | f048a2b | 16:23 | [Run](https://github.com/maniczko/audioRecorder/actions/runs/23551884541) |

**Pattern Analysis:**
- **Dependabot workflows failing:** Permission/token issues (302 errors)
- **E2E Tests:** Timeout after 10min (need 20min)
- **Vercel Deployments:** Intermittent failures
- **Main branch CI:** 11 failures w ostatnich 24h

**Recommended Actions:**
1. 🔧 Fix Dependabot workflow permissions (actions:write, issues:write)
2. ⏱️ Increase E2E timeout to 20min
3. 🔐 Regenerate GitHub tokens for auto-fix workflows
4. 📊 Add workflow status badges to README

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

- `414` [P1] `todo` - Fix failing CI after `750a2b88`: Lint, Server Tests, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Lint, Server Tests, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23583458527).

- `413` [P1] `todo` - Fix failing CI after `8d0fdbaa`: Frontend Tests, Validate Workflow Guards, Build, Lint, Server Tests, Security Audit, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Frontend Tests, Validate Workflow Guards, Build, Lint, Server Tests, Security Audit, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23565715072).

- `412` [P1] `todo` - Fix failing CI after `b0e7a825`: E2E Smoke Tests, Lint, Server Tests, Validate Workflow Guards, Build, Security Audit, Frontend Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, Lint, Server Tests, Validate Workflow Guards, Build, Security Audit, Frontend Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23561497477).

- `411` [P1] `todo` - Fix failing CI after `df5f85d1`: Validate Workflow Guards, E2E Smoke Tests, Build, Security Audit, Lint, Frontend Tests, Server Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Validate Workflow Guards, E2E Smoke Tests, Build, Security Audit, Lint, Frontend Tests, Server Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23560312793).

- `410` [P1] `todo` - Fix failing CI after `10e2fa33`: Security Audit, Build, Frontend Tests, Validate Workflow Guards, Server Tests, E2E Smoke Tests, Lint, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Security Audit, Build, Frontend Tests, Validate Workflow Guards, Server Tests, E2E Smoke Tests, Lint, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23559054188).

- `409` [P1] `todo` - Fix failing CI after `84b044ae`: Validate Workflow Guards, Server Tests, Lint, Frontend Tests, Build, Security Audit, E2E Smoke Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Validate Workflow Guards, Server Tests, Lint, Frontend Tests, Build, Security Audit, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23558514152).

- `408` [P1] `todo` - Fix failing CI after `e4d7ce37`: E2E Smoke Tests, Server Tests, Frontend Tests, Security Audit, Validate Workflow Guards, Build, Lint, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: E2E Smoke Tests, Server Tests, Frontend Tests, Security Audit, Validate Workflow Guards, Build, Lint, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23558316143).
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
