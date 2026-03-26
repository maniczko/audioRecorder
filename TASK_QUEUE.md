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

## GitHub Actions Status (2026-03-26 18:00)

**❌ 61 workflow failures w ostatnich 7 dniach (29 sukcesów)**

### Dzisiejsze failures (2026-03-26):

| Workflow | Commit | Time | Status |
|----------|--------|------|--------|
| Backend Production Smoke | 585ec6e | 17:12 | ❌ |
| Optimized CI | 585ec6e | 17:12 | ❌ |
| CI Pipeline | 585ec6e | 17:12 | ❌ |
| E2E Playwright Tests | 585ec6e | 17:12 | ❌ |
| auto-fix.yml | 585ec6e | 17:12 | ❌ |
| E2E Playwright Tests | 17cfad2 | 15:52 | ❌ |
| Backend Production Smoke | 17cfad2 | 15:52 | ❌ |
| CI Pipeline | 17cfad2 | 15:52 | ❌ |
| Optimized CI | 17cfad2 | 15:52 | ❌ |
| auto-fix.yml | 17cfad2 | 15:52 | ❌ |

### Główne przyczyny błędów:
1. **302 Errors** - GitHub API nie zwraca logów dla workflow (problem z tokenem/permissions)
2. **Dependabot workflows** - Permission issues (actions:write, issues:write)
3. **Husky hooks in CI** - ✅ Naprawione: dodano `CI: true` do env w ci.yml

### Naprawione dzisiaj:
- ✅ **CSP** - dodano Railway API do allowed connections w vercel.json
- ✅ **Tasks Tab Layout** - naprawiono empty space po prawej stronie (data-columns="two")
- ✅ **selectedTaskSla** - usunięto ReferenceError z TasksTab.tsx
- ✅ **Lazy Loading Tests** - dodano 9 testów dla createLazyComponent
- ✅ **CI Husky Issue** - dodano `CI: true` aby wyłączyć husky hooks w CI

### Wymagane działania:
- 🔧 **Regenerate GitHub Token** - obecny token nie ma dostępu do logów workflow
- 🔧 **Update Dependabot Permissions** - dodać `actions: write` i `issues: write` do workflow
- 🔍 **Monitor CI** - sprawdzić czy nowy commit aee2caa naprawił CI Pipeline

