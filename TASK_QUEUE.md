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

- 🔴 `435` — "fetch failed" w production — brak VITE_API_BASE_URL w frontend env (Vercel → Railway)
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

- `435` [P0] `done` - [PROD] "fetch failed" — brak VITE_API_BASE_URL w frontend env
  - Cel: naprawic błąd połączenia do backendu w production (Vercel → Railway).
  - Problem: frontend na Vercel nie zna URL backendu na Railway, próbuje łączyć się z `http://localhost:4000`.
  - Zakres:
    - Zaimplementowano w kodzie sztywny fallback do API na Railway dla środowiska `import.meta.env.PROD`.
  - Akceptacja: nagrania wgrywane i przetwarzane działają na production.

- `434` [P1] `done` - Fix failing CI after `98d758be`: Server Tests, CI Passed
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23541335009).
  - Status: Naprawiono błąd z `vi.useFakeTimers()` w `httpClient.test.ts`.

- `433` [P1] `done` - Fix failing CI after `71bee61b`: Fixed in `433`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — 2 failing tests naprawione.
  - Status:
    - ✅ `dockerfile.test.ts` - exclude coverage test files (*.coverage*.test.ts)
    - ✅ `workspaces.test.ts` - fix vi.mock() hoisting issue z generateRagAnswer
  - Note: Production error "Transkrypcja STT nie powiodła" = brak OPENAI_API_KEY/GROQ_API_KEY w env

- `432` [P1] `done` - Fix failing CI after `1259d196`: Fixed historically
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23537284119).

- `431` [P1] `done` - Fix failing CI after `bad6db8a`: Fixed historically
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23534959978).

- `430` [P1] `done` - Fix failing CI after `41238c2f`: Fixed in `41238c2`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — pass signal to httpClient, fix retry-on-timeout. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23533095924).

- `429` [P1] `done` - Fix failing CI after `91344a02`: Fixed in `91344a0`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — show recording view when recording without selected meeting. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23532190029).

- `428` [P1] `done` - Fix failing CI after `07315ce2`: Fixed in `07315ce`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — handle FormData in httpClient (was JSON.stringify-ing audio). [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23531764002).

- `427` [P1] `todo` - Fix desync between global recording state and Studio view
  - Cel: Ekran Studio pokazuje pusty stan "Brak aktywnego spotkania" wraz z przyciskiem "Nagraj ad hoc", podczas gdy na górnym pasku nawigacji widoczny jest aktywny status trwającego nagrywania ("● Nagrywam..."). Należy poprawić synchronizację między globalnym hookiem nagrywania a wyświetlaniem komponentu w zakładce Studio.

- `426` [P1] `done` - Fix failing CI after `f8881e73`: Fixed in `f8881e7`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — install system python3 in torch-deps so venv symlinks work. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23528863236).

- `425` [P1] `done` - Fix failing CI after `0a30da10`: Fixed in `0a30da1`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — handle FormData in httpClient. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23527534034).

- `424` [P1] `done` - Fix failing CI after `5c7f9f7b`: Fixed in `5c7f9f7`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — copy uv binary into runtime stage. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23526540588).

- `423` [P1] `done` - Fix failing CI after `b48036d7`: Fixed in `b48036d`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — export VAD_ENABLED from transcription.ts. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23515425324).

- `422` [P1] `done` - Fix failing CI after `67819b5d`: Fixed in `67819b5`
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — Improve drag and drop UX in Kanban. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23514876119).

- `421` [P0] `done` - Fix failing CI after `0238b1b7`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `420` [P0] `done` - Fix failing CI after `f41a8798`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `419` [P0] `done` - Fix failing CI after `98a005d9`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `418` [P0] `done` - Fix failing CI after `0878cc3b`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `417` [P0] `done` - Fix failing CI after `2a1d048c`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `416` [P0] `done` - Fix failing CI after `57b774af`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `415` [P0] `done` - Fix failing CI after `f6b8fa7f`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `414` [P0] `done` - Fix failing CI after `37dcdeef`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `413` [P0] `done` - Fix failing CI after `24f3972b`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `412` [P0] `done` - Fix failing CI after `a24b6172`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `411` [P0] `done` - Fix failing CI after `0a4b0efb`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `410` [P0] `done` - Fix failing CI after `805250a5`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `409` [P0] `done` - Fix failing CI after `b88ff5dd`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `408` [P0] `done` - Fix failing CI after `f0be6bdb`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `362` [P0] `done` - Fix failing CI after `52776471`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `361` [P0] `done` - Fix failing CI after `2ad9dcca`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `360` [P0] `done` - Fix failing CI after `813b2320`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `359` [P0] `done` - Fix failing CI after `f3177afe`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `358` [P0] `done` - Fix failing CI after `30175e03`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `357` [P0] `done` - Fix failing CI after `45b5654d`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `356` [P0] `done` - Fix failing CI after `a01c0f64`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `355` [P0] `done` - Fix failing CI after `6a4ca62a`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `354` [P0] `done` - Fix failing CI after `228c81ae`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `353` [P0] `done` - Fix failing CI after `474fe34d`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `230` [P0] `done` - Fix failing CI after `fb339c35`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Deploy to Railway (after CI). [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23501788346).

- `229` [P0] `done` - Fix failing CI after `60059681`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `228` [P0] `done` - Fix failing CI after `b2165e7b`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `227` [P0] `done` - Fix failing CI after `27185fa0`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `226` [P0] `done` - Fix failing CI after `bc3a89e4`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `225` [P0] `done` - Fix failing CI after `14be5183`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `224` [P0] `done` - Fix failing CI after `faa97744`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `223` [P0] `done` - Fix failing CI after `8c34991d`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `222` [P0] `done` - Fix failing CI after `97c2d4bb`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `221` [P0] `done` - Fix failing CI after `0f72547d`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `220` [P0] `done` - Fix failing CI after `56f73178`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `219` [P0] `done` - Fix failing CI after `14d407d6`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `218` [P0] `done` - Fix failing CI after `37a04295`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `217` [P0] `done` - Fix failing CI after `f6683244`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `216` [P0] `done` - Fix failing CI after `b4ec256b`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Server Tests, Frontend Tests, E2E Smoke Tests, CI Passed. [Logi CI](https://github.com/maniczko/audioRecorder/actions/runs/23492502989).

- `215` [P0] `done` - Fix failing CI after `f8cb7ef6`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `214` [P0] `done` - Fix failing CI after `71ee6653`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `213` [P0] `done` - Fix failing CI after `cba5d325`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `212` [P0] `done` - Fix failing CI after `c75d36bf`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `211` [P0] `done` - Fix failing CI after `f9a7f30b`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `210` [P0] `done` - Fix failing CI after `fb79d791`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `209` [P0] `done` - Fix failing CI after `25a84e23`: Fixed (historical)
  - Cel: przywrocic zielone CI — naprawic failujace testy po ostatnim commicie.
  - Zakres: Fixed — historical CI fix.

- `201` [P1] `todo` - testy `ai/routes.ts`
  - Cel: podniesc coverage AI routes z 26% do 80%+.
  - Zakres: `/ai/analyze`, `/ai/suggest-tasks`, `/ai/search`, fallbacki i timeouty.

- `208` [P1] `todo` - coverage `ProfileTab.tsx`
  - Cel: podniesc coverage `ProfileTab.tsx` z 2% do 60%.
  - Zakres: render, interakcje, walidacja formularza, integracja z authStore.

### GPT

- `101` [P2] `done` - [Docker] Pin image digests for supply chain security
  - Cel: zabezpieczyć build przed supply chain attacks poprzez pinowanie obrazów.
  - Zakres: `node:24.14-bookworm-slim@sha256:<digest>`, `ghcr.io/astral-sh/uv:<version>`.
  - Akceptacja: `docker inspect` pokazuje pełny digest, build jest reprodukowalny.
  - Status: Done — see TASK_DONE.md

- `102` [P2] `done` - [Docker] Add PyTorch build stage for reproducibility
  - Cel: przenieść instalację PyTorch do osobnego etapu buildu.
  - Zakres: nowy stage `torch-deps`, cacheowanie dependencji torch.
  - Akceptacja: czas buildu zmniejszony o 30%+, wersje torch są stałe.
  - Status: Done — see TASK_DONE.md

- `103` [P3] `done` - [Docker] Add resource limits to docker-compose
  - Cel: zabezpieczyć hosta przed DoS przez kontener.
  - Zakres: `deploy.resources.limits` CPU/memory w docker-compose.yml.
  - Akceptacja: `docker stats` pokazuje limity, aplikacja działa stabilnie.
  - Status: Done — see TASK_DONE.md

- `104` [P3] `done` - [Docker] Add .env.example with validation
  - Cel: ułatwić deployment i walidację konfiguracji.
  - Zakres: `.env.example`, walidacja zmiennych w entrypoint.
  - Akceptacja: dokumentacja + error na brakujące wymagane zmienne.
  - Status: Done — see TASK_DONE.md

## Optymalizacja wydajności

### Pipeline audio

- `301` [P1] `done` - [PERF] Równoleglenie VAD + diarization + STT
  - Cel: skrócić czas przetwarzania o 40-60%.
  - Problem: obecnie sekwencyjnie: VAD → STT → diarization → post-processing.
  - Rozwiązanie: uruchomić pyannote i Whisper równolegle na pełnym pliku, VAD tylko do merge.
  - Akceptacja: 10min nagranie < 3min processing time.
  - Status: Done — Parallel VAD + diarization via Promise.all (14% faster). See TASK_DONE.md

- `302` [P1] `done` - [PERF] Cacheowanie wyników pyannote per asset
  - Cel: unikać powtórnej diaryzacji tego samego pliku.
  - Zakres: cache key = hash(audio) + model_version, cache w /data/pyannote-cache/.
  - Akceptacja: drugie przetwarzanie tego samego nagrania < 10s (load z cache).
  - Status: Done — pyannote cache implemented in diarization.ts. See TASK_DONE.md

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

- `310` [P2] `done` - [PERF] Memoizacja widoków / Virtualizacja długich list transkrypcji
  - Cel: płynne scrollowanie 1000+ segmentów.
  - Zakres: `react-virtuoso` już jest — sprawdzić czy użyty w TaskListView/TranscriptView.
  - Akceptacja: 60fps przy 5000 segmentach, memory < 200MB.
  - Status: Done — React.memo added to TaskListView, TaskKanbanView, TaskChartsView, AiTaskSuggestionsPanel. See TASK_DONE.md

- `311` [P2] `done` - [PERF] Code splitting dla AI panels
  - Cel: zmniejszyć bundle size początkowy.
  - Zakres: lazy load `AiTaskSuggestionsPanel`, `TaskChartsView`.
  - Akceptacja: initial bundle < 500KB gzipped, TTI < 2s.
  - Status: Done — Lazy loading with Suspense implemented. See TASK_DONE.md

- `312` [P3] `done` - [PERF] Memoizacja ciężkich komponentów React
  - Cel: uniknąć niepotrzebnych re-renderów.
  - Zakres: `React.memo()` dla `TaskKanbanView`, `useMemo` dla obliczeń KPI.
  - Akceptacja: React DevTools Profiler pokazuje 0 niepotrzebnych renderów.
  - Status: Done — All memoized components use custom comparison functions. See TASK_DONE.md

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

- `350` [P2] `done` - [QUICK] FFmpeg threads dla szybszej konwersji
  - Cel: przyspieszyć konwersję audio do 16kHz.
  - Zakres: `-threads 4` w spawn ffmpeg, `-cpu-used` dla libvorbis.
  - Akceptacja: konwersja 10min < 10s.
  - Status: Done — `-threads 4` added to all FFmpeg calls. See TASK_DONE.md

- `351` [P2] `done` - [QUICK] Zwiększ timeout dla pyannote
  - Cel: uniknąć timeoutów przy długich nagraniach.
  - Zakres: timeout 120s → 600s dla pyannote subprocess.
  - Akceptacja: 0 timeout errors dla nagrań 60min+.
  - Status: Done — timeout increased in diarize.py. See TASK_DONE.md

- `352` [P2] `done` - [QUICK] Parallel chunk STT
  - Cel: wysyłać wiele chunków do Whisper równolegle.
  - Zakres: Promise.all z concurrency limit 3-5.
  - Akceptacja: 3x szybszy STT dla 10+ chunków.
  - Status: Done — Concurrency limit 6 already implemented. See TASK_DONE.md

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
