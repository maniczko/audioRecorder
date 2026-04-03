# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-03, aktualizacja po naprawie CI/CD)

### CI/CD Status (commit 40e52a7c, push 2026-04-03):

- **Optimized CI**: ✅ success
- **Auto-Fix Test Failures**: ✅ success
- **Docker Build**: ✅ success
- **E2E Playwright Tests**: ✅ success
- **Backend Production Smoke**: ✅ success
- **Production Deployment (Vercel)**: ✅ success
- **CI/CD Pipeline**: ✅ success

### Railway Health Check (2026-04-03 - LIVE)

| Metric       | Value                          | Status  |
| ------------ | ------------------------------ | ------- |
| Status       | ok                             | ✅ Healthy |
| Database     | connected                      | ✅ OK      |
| Build Time   | 2026-04-03T12:15:06Z           | ✅ Fresh   |
| Memory (RSS) | 113.44 MB                      | ✅ Normal  |
| Uptime       | 626s                           | ✅ Stable  |

### Client Error Endpoint

- `GET /api/client-errors` → ✅ Działa end-to-end (zweryfikowane POST + GET + DELETE)

---
## Aktualne Zadania

### TODO

_Brak aktualnych zadań._

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

## Następne Kroki (priorytet 🔴 → 🟡 → 🟢)

1. 🔴 **GH-33** — dodaj ANTHROPIC_API_KEY secret (wymaga konfiguracji w GitHub Settings)
2. 🟢 **GH-AUTO-VITE** — opcjonalnie dodaj VITE_* sekrety w GitHub Settings
