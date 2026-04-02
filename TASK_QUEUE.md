# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 zrealizowane, 1 blocked (zewnetrzne secrety)
- **GH-AUTO (Prettier, Docker, Railway filter, coverage)**: naprawione
- **ESLint**: 0 ostrzezen
- **Vitest Frontend**: 1050 testow passing, 0 failures (91 plikow)
- **Vitest Server**: 680 testow passing, 0 failures (49 plikow)
- **CI/CD Pipeline**: Quality Checks, Unit Tests, Build Application przechodza (run 23901618675)
- **Error Monitor workflow**: Dziala

### Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status     |
| ------------ | ----------- | ---------- |
| Status       | ok          | Healthy    |
| Database     | connected   | OK         |
| Memory (RSS) | 112.99 MB   | Normal     |
| Git SHA      | 1d70ce9     | Latest     |

---

## Otwarta kolejka

### BLOCKED (wymaga konfiguracji zewnetrznej)

- **GH-33** - "Remote boom" bootstrap failure (Code Review + Auto-Fix workflow)
  - **Status:** blocked
  - **Error:** Remote workspace bootstrap failed. Error: Remote boom
  - **Blokada:** Brak Claude API key w GitHub Actions Secrets
  - **Akcja:** Dodaj secret ANTHROPIC_API_KEY lub CLAUDE_API_KEY w GitHub Settings Secrets Actions

- **GH-AUTO-1/7/9** - Missing VITE_* env vars w CI (validate-env.js)
  - **Status:** blocked (by design)
  - **Error:** VITE_DATA_PROVIDER: BRAK, VITE_MEDIA_PROVIDER: BRAK
  - **Uwaga:** Krok ma continue-on-error: true - nie blokuje CI. Brakuje produkcyjnych sekretow.
  - **Akcja:** Opcjonalnie dodaj sekrety VITE_DATA_PROVIDER, VITE_MEDIA_PROVIDER itp.

---

## Nastepne Kroki

1. **GH-33** - Dodaj ANTHROPIC_API_KEY secret w GitHub Settings Secrets Actions (odblokuje automatyczny code review i auto-fix)
2. Opcjonalnie: dodaj sekrety VITE_* jesli chcesz wyciszyc warnings w validate-env job

<!-- Last updated: 2026-04-02 -->
