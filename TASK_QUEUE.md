# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 ✅ zrealizowane, 1 ⚠️ blocked (zewnętrzne secrety)
- **GH-AUTO-2,3,6,8,10,11,12**: ✅ naprawione (Prettier, Docker require(), Railway filter, coverage thresholds)
- **ESLint**: 0 ostrzeżeń
- **Vitest Frontend**: 1050 testów passing, 0 failures (91 plików)
- **Vitest Server**: 680 testów passing, 0 failures (49 plików)
- **CI/CD Pipeline**: ✅ Quality Checks, Unit Tests, Build Application przechodzą (run `23901618675`)
- **Error Monitor workflow**: ✅ Działa (run `23898465998` — 52s, bez błędów)

### 🟢 Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status     |
| ------------ | ----------- | ---------- |
| Status       | `ok`        | ✅ Healthy |
| Database     | `connected` | ✅ OK      |
| Memory (RSS) | 112.99 MB   | ✅ Normal  |
| Git SHA      | `1d70ce9`   | ✅ Latest  |

---

## Otwarta kolejka

### ⚠️ BLOCKED (wymaga konfiguracji zewnętrznej)

- **GH-33 / GH-AUTO-4 / GH-AUTO-5** — "Remote boom" bootstrap failure (Code Review + Auto-Fix workflow)
  - **Status:** blocked
  - **Error:** ``Remote workspace bootstrap failed. Error: Remote boom``
  - **Blokada:** Brak Claude API key w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ``ANTHROPIC_API_KEY`` lub ``CLAUDE_API_KEY`` w GitHub → Settings → Secrets → Actions

- **GH-AUTO-1 / GH-AUTO-7 / GH-AUTO-9** — Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design)
  - **Error:** ``❌ VITE_DATA_PROVIDER: BRAK``, ``❌ VITE_MEDIA_PROVIDER: BRAK``
  - **Uwaga:** Krok ma ``continue-on-error: true`` — nie blokuje CI. Brakuje produkcyjnych sekretów w GitHub Actions.
  - **Akcja:** Opcjonalnie dodaj sekrety ``VITE_DATA_PROVIDER``, ``VITE_MEDIA_PROVIDER`` itp.

---

## 🔄 Następne Kroki

1. **GH-33** — Dodaj ``ANTHROPIC_API_KEY`` secret w GitHub → Settings → Secrets → Actions (odblokuje automatyczny code review i auto-fix)
2. Opcjonalnie: dodaj sekrety ``VITE_*`` jeśli chcesz wyciszyć warnings w validate-env job

<!-- Last updated: 2026-04-02 -->
