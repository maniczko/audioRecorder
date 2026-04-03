# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-03, aktualizacja)

### CI/CD Status:

- **CI/CD Pipeline**: ✅ ALL PASSING (run 23937730146 - 2026-04-03)
- **Docker Build**: ✅ passing
- **E2E Tests**: ✅ passing (all selector issues fixed)
- **Quality Checks**: ✅ passing
- **Unit Tests**: ✅ passing
- **Deploy to Production**: ✅ passing

### Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status  |
| ------------ | ----------- | ------- |
| Status       | ok          | Healthy |
| Database     | connected   | OK      |
| Memory (RSS) | 112.99 MB   | Normal  |

---
## Aktualne Zadania

### BLOCKED (wymaga konfiguracji zewnetrznej)

- **GH-33** - Auto code review/auto-fix workflow ("Remote boom")
  - **Status:** blocked
  - **Error:** Remote workspace bootstrap failed. Error: Remote boom
  - **Blokada:** Brak ANTHROPIC_API_KEY w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ANTHROPIC_API_KEY w GitHub Settings > Secrets > Actions

- **GH-AUTO-VITE** - Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design, non-blocking)
  - **Error:** VITE_DATA_PROVIDER: BRAK, VITE_MEDIA_PROVIDER: BRAK
  - **Uwaga:** Krok ma continue-on-error: true. Nie blokuje CI.
  - **Akcja:** Opcjonalnie dodaj sekrety VITE_* w GitHub Settings > Secrets > Actions

---

## Nastepne Kroki

1. Dodaj ANTHROPIC_API_KEY w GitHub Settings > Secrets > Actions (odblokuje GH-33)
2. Opcjonalnie: dodaj sekrety VITE_* aby wyciszyc warnings
