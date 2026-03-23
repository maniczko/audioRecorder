# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`
Zadania zakonczone Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ TASK_DONE.md

## PRIORYTET P1.5 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ SPRING REFACTOR PLAN (nowy sprint)

Cel sprintu: obciac sprzezenia miedzy backendem, stanem frontendu i widokami, tak aby dalszy rozwoj nie wymagal dotykania jednego ogromnego pliku na raz.

Kolejnosc prac:
1. kontrakty danych i typy wspolne
2. backend bootstrap i orchestration pipeline
3. frontend state / hooks / services
4. TabRouter i ekrany
5. testy kontraktowe i regresyjne
6. porzadki layout / UX po stabilizacji architektury

---

## Ă„â€ÄąĹźĂ˘â‚¬Ĺ›ÄąÂ  PODSUMOWANIE SPRINTU TESTOWEGO

| Metryka | Przed | Po | Zmiana |
|---------|-------|-----|--------|
| **Coverage servera** | 47% | **55.78%** | +8.78% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| **Liczba testĂ„â€šÄąâ€šw** | 113 | **373** | +260 Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| **Pass rate** | 75% | **94%** | +19% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| **Integration/E2E pass rate** | 70% | **85%** | +15% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |

### Pliki z najwiÄ‚â€žĂ˘â€žËkszÄ‚â€žĂ˘â‚¬Â¦ poprawÄ‚â€žĂ˘â‚¬Â¦:

| Plik | Przed | Po | Zmiana |
|------|-------|-----|--------|
| `audioPipeline.utils.ts` | N/A | **97.27%** | NOWY PLIK Ă„â€ÄąĹźÄąËťĂ˘â‚¬Â° |
| `TranscriptionService.ts` | 68% | **96.24%** | +28.24% Ă„â€ÄąĹźÄąËťĂ˘â‚¬Â° |
| `supabaseStorage.ts` | 26% | **90.62%** | +64.62% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| `database.ts` | 56% | **64.85%** | +8.85% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| `sqliteWorker.ts` | 0% | **N/A*** | 24 testy Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |
| **Integration/E2E** | 70% | **85%** | +15% Ä‚ËÄąâ€şĂ˘â‚¬Â¦ |

*coverage nie zbierane przez Vitest worker threads limitation

### Nowe pliki testowe:
- `server/tests/database/database.additional.test.ts` - 17 testĂ„â€šÄąâ€šw
- `server/tests/services/TranscriptionService.additional.test.ts` - 21 testĂ„â€šÄąâ€šw
- `server/tests/sqliteWorker.test.ts` - 24 testy
- `server/tests/audioPipeline.utils.test.ts` - 111 testĂ„â€šÄąâ€šw
- `src/App.integration.e2e.test.tsx` - 38 testĂ„â€šÄąâ€šw
- `tests/e2e/extended-flows.spec.js` - 15 testĂ„â€šÄąâ€šw

### Nowe pliki Ă„Ä…ÄąĹşrĂ„â€šÄąâ€šdĂ„Ä…Ă˘â‚¬Ĺˇowe:
- `server/audioPipeline.utils.ts` - 771 linii czystych funkcji (wydzielone z audioPipeline.ts)

### Artefakty:
- Ä‚ËÄąâ€şĂ˘â‚¬Â¦ `docs/TEST_COVERAGE_PLAN.md` - szczegĂ„â€šÄąâ€šĂ„Ä…Ă˘â‚¬Ĺˇowy plan testĂ„â€šÄąâ€šw
- Ä‚ËÄąâ€şĂ˘â‚¬Â¦ `docs/COVERAGE_GUIDE.md` - instrukcja coverage
- Ä‚ËÄąâ€şĂ˘â‚¬Â¦ `scripts/coverage-summary.cjs` - podsumowanie w terminalu
- Ä‚ËÄąâ€şĂ˘â‚¬Â¦ `scripts/generate-coverage-report.bat` - skrypt batch
- Ä‚ËÄąâ€şĂ˘â‚¬Â¦ Tabela jakoĂ„Ä…Ă˘â‚¬Ĺźci testĂ„â€šÄąâ€šw w raporcie HTML

---

## Ă„â€ÄąĹźĂ˘â‚¬Ĺ›Ă˘â‚¬Ä… AKTUALNY RAPORT TESTĂ„â€šĂ˘â‚¬Ĺ›W

### Server Coverage (55.78%)

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|-------------------
All files               |   55.56 |     45.1 |   60.65 |   55.78 |
 server                 |   43.88 |    38.35 |   48.36 |   44.07 |
  audioPipeline.ts      |   22.33 |    16.66 |    19.7 |    21.7 | ... (czeka na refaktoryzacjÄ‚â€žĂ˘â€žË)
  audioPipeline.utils.ts|   97.27 |    78.41 |   97.91 |   96.98 | ... (97% coverage!)
  database.ts           |   64.85 |    58.56 |   70.27 |   65.81 | ...
  TranscriptionService  |   96.24 |    80.45 |   96.96 |   97.27 | ...
  supabaseStorage.ts    |   90.62 |       70 |     100 |   90.32 | ...
```

### Test Statistics

```
Test Files:  25 passed (25 total)
Tests:       373 total
             Ä‚ËÄąâ€şĂ˘â‚¬Â¦ 351 passed (94%)
             Ä‚ËÄąÄ„ÄąĹˇ 22 failed (6%)
```

### Test Categories

```
Kategoria                 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ   PlikĂ„â€šÄąâ€šw Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ   TestĂ„â€šÄąâ€šw Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ   Pass Rate Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      Ocena
Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬Ä‚ËĂ˘â‚¬ĹĄĂ˘â€šÂ¬
Backend (server/)         Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ       18 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~50 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         95% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźÄąĹźĂ‹Â 9/10
Lib (pure functions)      Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ       15 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~50 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         98% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźÄąĹźĂ‹Â 9/10
Integration/E2E           Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ        4 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~68 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         85% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźÄąĹźĂ‹Â 8/10
Frontend Components       Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ       15 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~60 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         85% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźÄąĹźĂ‹â€ˇ 7/10
Stores (Zustand)          Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ        5 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~30 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         70% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźÄąĹźĂ‹â€ˇ 6/10
Hooks                     Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ       12 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~50 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         60% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźĂ˘â‚¬ĹĄĂ‚Â´ 5/10
Services                  Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ        6 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~30 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         50% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźĂ˘â‚¬ĹĄĂ‚Â´ 4/10
Context Providers         Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ        2 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ      ~10 Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ         50% Ä‚ËĂ˘â‚¬ĹĄĂ˘â‚¬Ĺˇ Ă„â€ÄąĹźĂ˘â‚¬ĹĄĂ‚Â´ 5/10
```

---

## Ă„â€ÄąĹźÄąËťÄąÂ» NASTÄ‚â€žĂ‚ÂPNE KROKI

1. **dokoĂ„Ä…Ă˘â‚¬ĹľczyÄ‚â€žĂ˘â‚¬Ë‡ refaktoryzacjÄ‚â€žĂ˘â€žË audioPipeline.ts** - usunÄ‚â€žĂ˘â‚¬Â¦Ä‚â€žĂ˘â‚¬Ë‡ zduplikowane funkcje
2. **Hooks tests** - 60% Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ 80%
3. **Context Providers** - 50% Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ 80%
4. **Services tests** - 50% Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ 80%

---

## PRIORYTET P1 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ krytyczne dla bezpieczenstwa i uzytecznosci

---

## PRIORYTET P2 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ jakoĂ„Ä…Ă˘â‚¬ĹźÄ‚â€žĂ˘â‚¬Ë‡ rozpoznawania audio (najwyĂ„Ä…Ă„Ëťszy priorytet)

---

---

---

---

---

## 057. [AUDIO] Upgrade RNNoise worklet do rzeczywistego modelu WASM
Status: `todo`
Wykonawca: `claude`
Priorytet: `P2`
Cel: obecna spektralna subtrakcja (task 056) nie radzi sobie z niestacjonarnym szumem (gĂ„Ä…Ă˘â‚¬Ĺˇosy w tle, ruch uliczny). RNNoise WASM (Mozilla, sieÄ‚â€žĂ˘â‚¬Ë‡ neuronowa) daje ~15 dB lepszÄ‚â€žĂ˘â‚¬Â¦ redukcjÄ‚â€žĂ˘â€žË.
Akceptacja:
- worklet Ă„Ä…Ă˘â‚¬Ĺˇaduje WASM binarny RNNoise z `public/`.
- przetwarzanie ramek 480 prĂ„â€šÄąâ€šbek przez `rnnoise_process_frame()`.
- brak WASM Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ fallback do obecnej spektralnej subtrakcji.
- VAD probability z RNNoise eksponowane opcjonalnie do UI (wskaĂ„Ä…ÄąĹşnik aktywnoĂ„Ä…Ă˘â‚¬Ĺźci gĂ„Ä…Ă˘â‚¬Ĺˇosu).
Techniczne wskazĂ„â€šÄąâ€šwki:
- znaleĂ„Ä…ÄąĹşÄ‚â€žĂ˘â‚¬Ë‡ build WASM rnnoise bez Emscripten env imports (standalone WASI lub rnnoise-wasm.js).
- alternatywnie: Ă„Ä…Ă˘â‚¬ĹˇadowaÄ‚â€žĂ˘â‚¬Ë‡ `rnnoise-wasm.js` w gĂ„Ä…Ă˘â‚¬ĹˇĂ„â€šÄąâ€šwnym wÄ‚â€žĂ˘â‚¬Â¦tku, przekazaÄ‚â€žĂ˘â‚¬Ë‡ `WebAssembly.Module` do worklet przez `port.postMessage({ type: "module", wasmModule }, [wasmModule])`.
- worklet: `WebAssembly.instantiate(data.wasmModule, { env: minimalEmscriptenEnv })`.
- rozmiar ramki 480 prĂ„â€šÄąâ€šbek; buforowaÄ‚â€žĂ˘â‚¬Ë‡ w worklet, przetwarzaÄ‚â€žĂ˘â‚¬Ë‡ synchronicznie.

---

---

## PRIORYTET P2 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ rozpoznawanie i wizualizacja mĂ„â€šÄąâ€šwcĂ„â€šÄąâ€šw

---

---

#

---

## 069. [SPEAKER] Korekta mĂ„â€šÄąâ€šwcy jako aktualizacja profilu (feedback loop)
Status: `todo`
Wykonawca: `claude`
Priorytet: `P3`
Cel: gdy user rÄ‚â€žĂ˘â€žËcznie zmienia "Speaker 1" na "Marek", ta wiedza ginie Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ feedback loop tworzy samodoskonalÄ‚â€žĂ˘â‚¬Â¦cy siÄ‚â€žĂ˘â€žË system.
Akceptacja:
- po zmianie nazwy mĂ„â€šÄąâ€šwcy: opcjonalny dialog "Czy dodaÄ‚â€žĂ˘â‚¬Ë‡ audio tego mĂ„â€šÄąâ€šwcy do profilu gĂ„Ä…Ă˘â‚¬Ĺˇosu?".
- jeĂ„Ä…Ă˘â‚¬Ĺźli tak: wyciÄ‚â€žĂ˘â‚¬Â¦gniÄ‚â€žĂ˘â€žËcie clipĂ„â€šÄąâ€šw + aktualizacja profilu (jak w 068).
- toggle w ustawieniach: "Automatycznie ucz siÄ‚â€žĂ˘â€žË mĂ„â€šÄąâ€šwcĂ„â€šÄąâ€šw" (domyĂ„Ä…Ă˘â‚¬Ĺźlnie off).
Techniczne wskazĂ„â€šÄąâ€šwki:
- w `renameSpeaker()` w `useMeetings`: emitowaÄ‚â€žĂ˘â‚¬Ë‡ event ktĂ„â€šÄąâ€šry `TranscriptPanel` moĂ„Ä…Ă„Ëťe obsĂ„Ä…Ă˘â‚¬ĹˇuĂ„Ä…Ă„ËťyÄ‚â€žĂ˘â‚¬Ë‡.
- modal potwierdzenia: `SpeakerEnrollConfirmModal`.
- wywoĂ„Ä…Ă˘â‚¬Ĺˇanie `POST /voice-profiles/from-recording` jak w 068.

---

## PRIORYTET P2 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ analiza gĂ„Ä…Ă˘â‚¬Ĺˇosu i coaching

---

## 080. [VOICE] Acoustic features per speaker Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ librosa/parselmouth (roadmap)
Status: `todo`
Wykonawca: `claude`
Priorytet: `P3`
Cel: GĂ„Ä…Ă˘â‚¬ĹˇÄ‚â€žĂ˘â€žËbsza analiza akustyczna: F0/pitch (jitter, shimmer), HNR (harmonics-to-noise), formants Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ wymaga Python server-side. UzupeĂ„Ä…Ă˘â‚¬Ĺˇnia GPT-4o coaching o obiektywne dane.
Akceptacja:
- `POST /media/recordings/:id/acoustic-features` zwraca per-speaker: mean F0, F0 range, jitter %, shimmer %, HNR dB.
- wyniki widoczne w VoiceSpeakerStats obok metryk WPM.
- opcjonalne: Montreal Forced Aligner dla per-fonem scoring polskich gĂ„Ä…Ă˘â‚¬Ĺˇosek.
Techniczne wskazĂ„â€šÄąâ€šwki:
- `server/acousticFeatures.py`: librosa (F0, RMS), parselmouth/Praat (jitter, shimmer, HNR, formants).
- `server/requirements.txt`: `librosa>=0.10`, `praat-parselmouth>=0.4`.
- FFmpeg extractuje speaker clip Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ Python analizuje Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ wynik JSON.
- MFA dla Polish: wymaga modelu `polish-mfa` z modeldb.

---

## PRIORYTET P2 Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ niezawodnoĂ„Ä…Ă˘â‚¬ĹźÄ‚â€žĂ˘â‚¬Ë‡ i ergonomia

---

---

---

---

---

---

---

---

## 201. [TESTS] Dodanie testÄ‚Ĺ‚w dla ai/routes.ts (26% coverage)
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P1`
Cel: PodnieÄąâ€şĂ„â€ˇ coverage AI routes z 26% do 80%+.
Zakres:
- Testy endpointu `/ai/analyze` (meeting analysis)
- Testy endpointu `/ai/suggest-tasks` (task suggestions)
- Testy endpointu `/ai/search` (semantic search)
- Testy endpointu `/ai/person-profile` (psych profile)
- Testy fallbackÄ‚Ĺ‚w gdy API key nie jest ustawiony
- Testy bÄąâ€šĂ„â„˘dÄ‚Ĺ‚w i timeoutÄ‚Ĺ‚w
Akceptacja:
- coverage ai.ts > 80%
- Wszystkie Äąâ€şcieÄąÄ˝ki error handling przetestowane
- Testy izolowane (mocki fetch/OpenAI)

---

---

---

---

---

---

---

## 208. [TESTS] Poprawa coverage ProfileTab.tsx (2% Ă˘â€ â€™ 60%)
Status: `todo`
Wykonawca: `qwen`
Priorytet: `P1`
Zakres:
- Testy renderowania komponentu
- Testy interakcji uÄąÄ˝ytkownika
- Testy walidacji formularza
- Testy integration z authStore
Akceptacja:
- coverage ProfileTab.tsx > 60%
- Wszystkie Äąâ€şcieÄąÄ˝ki kodu przetestowane

---


---

## 018. Outlook / Microsoft To Do / Microsoft Calendar
Status: `todo`
Wykonawca: `gpt`
Priorytet: `P3`
Cel: rozszerzyÄ‚â€žĂ˘â‚¬Ë‡ integracje poza ekosystem Google.
Akceptacja:
- moĂ„Ä…Ă„Ëťna poĂ„Ä…Ă˘â‚¬ĹˇÄ‚â€žĂ˘â‚¬Â¦czyÄ‚â€žĂ˘â‚¬Ë‡ konto Microsoft (MSAL OAuth2).
- zadania synchronizujÄ‚â€žĂ˘â‚¬Â¦ siÄ‚â€žĂ˘â€žË z Microsoft To Do.
- spotkania z Outlook Calendar.
Techniczne wskazĂ„â€šÄąâ€šwki:
- `@azure/msal-browser` jako alternatywa dla GSI.
- MS Graph API dla To Do: `https://graph.microsoft.com/v1.0/me/todo/lists`.
- analogiczna architektura jak `googleSync.js` Ä‚ËĂ˘â‚¬Â Ă˘â‚¬â„˘ `msSync.js`.

---


## 📻 PODSUMOWANIE ZADAŃ WEDŁUG WYKONAWCY

### 🤖 Qwen (Testy i proste zadania)
- [TESTS] Dodanie testÄ‚Ĺ‚w dla ai/routes.ts (26% coverage)
- [TESTS] Poprawa coverage ProfileTab.tsx (2% Ă˘â€ â€™ 60%)

### 🤖 GPT (Średnie zadania)
- Outlook / Microsoft To Do / Microsoft Calendar

### 🤖 Claude (Trudne zadania, dźwięk, architektura)
- [AUDIO] Upgrade RNNoise worklet do rzeczywistego modelu WASM
- [SPEAKER] Korekta mĂ„â€šÄąâ€šwcy jako aktualizacja profilu (feedback loop)
- [VOICE] Acoustic features per speaker Ä‚ËĂ˘â€šÂ¬Ă˘â‚¬ĹĄ librosa/parselmouth (roadmap)
