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
- **19 workflow failures** w ostatnich 7 dniach (z 48 → 19!)
- **Poprawa:** ✅ **-60% błędów!** (48 → 19)

---

## Otwarta kolejka

### 🟡 Niski priorytet

- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

---

## Uwagi

- Wszystkie zadania #GH-01 do #GH-07 zostały zrealizowane i przeniesione do TASK_DONE.md ✅
- Server tests: 585 passed, 14 skipped ✅
- Wszystkie workflowy używają pnpm ✅

