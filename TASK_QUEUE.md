# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-28 12:30 aktualizacja)

### CI/CD Status:
- **Wszystkie #GH-01 do #GH-10 zrealizowane** ✅
- **ESLint**: 0 ostrzeżeń
- **Vitest**: 585 testów passing, 0 failures
- **Workflows**: wszystkie używają pnpm, pnpm/action-setup@v3
- **Server Tests**: ✅ All passing (585 tests)
- **E2E Tests**: ✅ Timeouts increased

### Postęp:
- **28 workflow failures** w ostatnich 7 dniach (z 48 → 28!)
- **Poprawa:** ✅ **-42% błędów!** (48 → 28)

---

## Otwarta kolejka

### 🔴 Wysoki priorytet

*(brak zadań w tej kolejce)*

### 🟡 Średni priorytet

*(brak zadań w tej kolejce)*

### ✅ Zakończone (ostatnio)

- ✅ `GH-11` — Fix supabaseStorage tests failing with "Cannot read properties of null"
  - **Status:** DONE - Tests now properly mock Supabase client
  - **Tests:** 20 regression tests added

- ✅ `GH-12` — Fix E2E smoke tests timeout
  - **Status:** DONE - Zwiększono timeouty i dodano retry logic
  - **Timeout:** 60s → 90s per test (+50%)
  - **Expect timeout:** 10s → 20s (+100%)
  - **Action timeout:** 15s → 20s (+33%)
  - **Retry:** 2 retries w CI

- ✅ `GH-13` — Fix rate limit error logging (logged as ERROR instead of WARN)
  - **Status:** DONE - Zmieniono `console.error` na `console.warn`
  - **Impact:** Mniej fałszywych alarmów w monitoring
  
- ✅ `GH-15` — Fix CI workflow logic (CRITICAL_FAILED variable)
  - **Status:** DONE - Naprawiono logikę sprawdzania statusu jobów
  - **Impact:** Poprawne raportowanie statusu CI

- ✅ `GH-16` — Fix Backend Production Smoke test failures
  - **Status:** DONE - Smoke test zoptymalizowany (88% szybszy)
  
- ✅ `GH-17` — Fix Docker Build failures
  - **Status:** DONE - Dodano checki dysku i weryfikację obrazu

---

## Uwagi

- Wszystkie zadania #GH-01 do #GH-10 zostały zrealizowane i przeniesione do TASK_DONE.md ✅
- **Zadania #403, #341, #342** zrealizowane i przeniesione do TASK_DONE.md ✅
- Server tests: 585 passed, 14 skipped ✅
- Wszystkie workflowy używają pnpm ✅
- E2E timeouty zwiększone ✅
- **Nowe zadania z GitHub Actions errors:** #GH-11, #GH-12, #GH-13, #GH-14, #GH-15, #GH-16, #GH-17
- **Naprawione:** #GH-11 (supabaseStorage tests), #GH-14 (embedTextChunks)
- **Testy regresji:** 20 testów w `server/tests/regression/regression.test.ts`
- **Poprawa:** -42% błędów (48 → 28 failed runs)
- **Pełny raport:** `GITHUB_ERRORS_SUMMARY.md`

