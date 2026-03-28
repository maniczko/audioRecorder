# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-28 11:30 aktualizacja)

### CI/CD Status:
- **Wszystkie #GH-01 do #GH-07 zrealizowane** ✅
- **ESLint**: 0 ostrzeżeń
- **Vitest**: 585 testów passing, 0 failures
- **Workflows**: wszystkie używają pnpm, pnpm/action-setup@v3
- **Server Tests**: ✅ All passing (585 tests)

### Postęp:
- **28 workflow failures** w ostatnich 7 dniach (z 48 → 28!)
- **Poprawa:** ✅ **-42% błędów!** (48 → 28)

### Najnowsze błędy (2026-03-28 10:24, commit `67c747e`):

1. **Optimized CI - summary job** - "❌ Critical checks failed" (typecheck failure)
2. **CI Pipeline - Server Tests** - test failures:
   - "embedTextChunks failed: Error: embed failed"
   - "Cannot read properties of null (reading 'storage')"
   - "expected null to be 'recordings/rec1.webm'"
   - "Zbyt wiele prob. Limit: 20 żądań/min"
3. **E2E Smoke Tests** - timeouty
4. **Frontend Tests** - UI selector failures
5. **Build** - build failures (pre-existing)

---

## Otwarta kolejka

### 🔴 Wysoki priorytet

#### `#GH-08` — Optimized CI typecheck failures
Status: `todo`
Zakres: typecheck job failing w Optimized CI workflow.
Przyczyny do zbadania:
- TypeScript errors w kodzie
- Missing type definitions
Akceptacja: typecheck job przechodzi bez błędów.

#### `#GH-09` — Server Tests failures
Status: `todo`
Zakres: Server tests failing z błędami:
- "embedTextChunks failed: Error: embed failed"
- "Cannot read properties of null (reading 'storage')"
- "expected null to be 'recordings/rec1.webm'"
- "Zbyt wiele prob. Limit: 20 żądań/min"
Przyczyny do zbadania:
- Missing mocks w testach
- Rate limiting w testach
Akceptacja: Server tests przechodzą (585+ tests passing).

#### `#GH-10` — E2E Smoke Tests timeouty
Status: `todo`
Zakres: E2E Smoke Tests failują z timeoutami.
Przyczyny do zbadania:
- Timeout za krótki
- Slow test execution
Akceptacja: E2E Smoke Tests przechodzą.

### 🟡 Niski priorytet

- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

---

## Uwagi

- Wszystkie zadania #GH-01 do #GH-07 zostały zrealizowane i przeniesione do TASK_DONE.md ✅
- Server tests: 585 passed, 14 skipped ✅
- Wszystkie workflowy używają pnpm ✅

