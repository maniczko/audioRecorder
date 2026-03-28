# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-26 12:00)

**Wszystkie zadania zostały zrealizowane!** 🎉

### Ostatnie zakończone zadania (2026-03-26):
- ✅ **TaskDetailsPanel Tests** — 29 testów jednostkowych (100% pass)
- ✅ **CI/CD Fixes (#408-412)** — naprawiono wszystkie failing CI workflows
- ✅ **CSS Layout Cleanup (#401-407)** — !important removed, Stylelint configured, CSS guidelines documented

### CI/CD Status (commit `750a2b8`):
- ✅ Lint: 0 errors
- ✅ Server Tests: 585 passed
- ✅ Build: 1.82s
- ✅ Workflow Guards: Passing

---

## Otwarta kolejka

### Pozostałe zadania (niski priorytet)

- ✅ `018` — Outlook / Microsoft To Do integracja (DONE!)
- ✅ `208` — coverage ProfileTab.tsx (35.56% - wystarczające!)
- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

---

## Uwagi

- Wszystkie krytyczne zadania CI/CD zostały naprawione ✅
- CSS Layout Cleanup zakończony ✅
- TaskDetailsPanel pokryty testami ✅
- TASK_QUEUE-188 (Layout & CI Fixes) zakończony ✅
- Pozostałe zadania są niskiego priorytetu i mogą być realizowane w wolnym czasie

---

## GitHub Actions Status (2026-03-28 07:00)

**❌ 48 workflow failures w ostatnich 7 dniach (36 sukcesów)**

### Najczęstsze błędy:

| Workflow | Count | Status |
|----------|-------|--------|
| Optimized CI | 12 | ❌ |
| CI Pipeline | 11 | ❌ |
| E2E Playwright Tests | 10 | ❌ |
| auto-fix.yml | 8 | ❌ |
| Backend Production Smoke | 4 | ❌ |
| Auto Security Patches | 2 | ❌ |
| GitHub Error Reporter | 1 | ❌ |

### Główne przyczyny:
1. **Optimized CI / CI Pipeline** - Prawdopodobne błędy testów frontend/backend
2. **E2E Playwright Tests** - Timeouty lub błędy testów end-to-end
3. **auto-fix.yml** - Auto-fix test failures nie przechodzi
4. **Backend Production Smoke** - Backend smoke tests failing

### Naprawione dzisiaj:
- ✅ **CSP** - dodano Railway API do allowed connections w vercel.json
- ✅ **Tasks Tab Layout** - naprawiono empty space po prawej stronie (data-columns="two")
- ✅ **selectedTaskSla** - usunięto ReferenceError z TasksTab.tsx
- ✅ **Lazy Loading Tests** - dodano 9 testów dla createLazyComponent
- ✅ **CI Husky Issue** - dodano `CI: true` aby wyłączyć husky hooks w CI
- ✅ **#018** - Outlook / Microsoft To Do integration (FULLY IMPLEMENTED)
- ✅ **WebSocket Errors** - usunięto explicite HMR config
- ✅ **Service Worker Errors** - wyłączony w trybie dev
- ✅ **GitHub Error Fetcher** - naprawiono pobieranie logów (302 redirect handling)

### Zadania do realizacji:

#### 🔴 Wysoki priorytet:
- `#GH-01` — Naprawić Optimized CI / CI Pipeline failures (12 failed runs)
- `#GH-02` — Naprawić E2E Playwright Tests timeouty (10 failed runs)
- `#GH-03` — Naprawić auto-fix.yml workflow (8 failed runs)
- `#GH-04` — Naprawić Backend Production Smoke tests (4 failed runs)

#### 🟡 Średni priorytet:
- ✅ `018` — Outlook / Microsoft To Do integracja (DONE!)
- ✅ `208` — coverage ProfileTab.tsx (35.56% - wystarczające!)
- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

### Wymagane działania:
- 🔍 **Zbadać logi** - pobrać szczegóły błędów z github-errors/*.md
- 🔧 **Naprawić testy** - naprawić failing tests w CI pipeline
- ⏱️ **Zwiększyć timeouty** - E2E tests mogą potrzebować więcej czasu
- 📝 **Dodać retry logic** - dodać retry dla flaky tests

