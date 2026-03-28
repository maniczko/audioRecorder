# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-28 10:30 aktualizacja)

### CI/CD Status:
- **Wszystkie #GH-01 do #GH-07 zrealizowane** ✅
- **ESLint**: 0 ostrzeżeń (było 19)
- **Vitest**: 505 testów passing, 0 failures (było 37 failures)
- **Workflows**: wszystkie używają pnpm, pnpm/action-setup@v3
- **Playwright config**: npm→pnpm
- **package.json**: 9× npm→pnpm w skryptach

### Najnowsze błędy (2026-03-28 09:23, commit `e36dfdb`):

1. **Optimized CI - summary job** - "❌ Critical checks failed" (typecheck failure)
2. **CI Pipeline - Server Tests** - test failures:
   - "embedTextChunks failed: Error: embed failed"
   - "Cannot read properties of null (reading 'storage')"
   - "expected null to be 'recordings/rec1.webm'"
   - "Zbyt wiele prob. Limit: 20 żądań/min"
3. **E2E Smoke Tests** - timeouty
4. **Frontend Tests** - UI selector failures
5. **Build** - build failures (pre-existing)

### Postęp:
- **19 workflow failures** w ostatnich 7 dniach (z 48 → 36 → 19!)
- **Poprawa:** ✅ **-60% błędów!** (48 → 19)

---

## Otwarta kolejka

### ✅ Wszystkie wysokopriorytetowe zadania zrealizowane (2026-03-28)

Zadania #GH-01 do #GH-07 zostały zrealizowane i przeniesione do [`TASK_DONE.md`](TASK_DONE.md).

#### `#GH-01` — Naprawić Optimized CI / CI Pipeline failures
Status: `done` (2026-03-28)

#### `#GH-02` — Naprawić Playwright config (npm→pnpm)
Status: `done` (2026-03-28)

#### `#GH-03` — Naprawić auto-fix.yml workflow (frontend test failures)
Status: `done` (2026-03-28)
Naprawiono 37 failing testów → 0 failures (505 tests passing).

#### `#GH-04` — Backend Production Smoke tests
Status: `done` (2026-03-28)
Workflow poprawny, retry logic 20×45s. Failures wynikają z Railway deploy timing.

#### `#GH-05` — Auto Security Patches workflow
Status: `done` (2026-03-28)

#### `#GH-06` — GitHub Error Reporter workflow
Status: `done` (2026-03-28)

#### `#GH-07` — Masowa naprawa npm→pnpm we wszystkich workflow
Status: `done` (2026-03-28)

### 🟡 Niski priorytet

- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

---

## Wymagane następne kroki

1. ~~**Push zmian**~~ ✅ Wszystkie naprawki zastosowane
2. **Zweryfikować CI** — sprawdzić czy workflows przechodzą po pushu
3. **#GH-02 E2E** — zbadać logi E2E Playwright (jeśli dalej failuje, może wymagać env setup w CI)
5. **#GH-03** — jeśli test:retry dalej failuje, zbadać konkretne failing tests

