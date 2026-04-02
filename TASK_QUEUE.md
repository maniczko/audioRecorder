# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02)

### CI/CD Status:

- **GH-01 do GH-35**: 34 zrealizowane, 1 blocked (zewnetrzne secrety)
- **GH-AUTO (naprawione)**: Prettier, Docker require(), Railway login, Dependabot auto-merge, Railway filter, coverage thresholds
- **Vitest Frontend**: 1050 testow passing, 0 failures (91 plikow)
- **Vitest Server**: 680 testow passing, 0 failures (49 plikow)
- **CI/CD Pipeline**: Quality Checks, Unit Tests, Build Application przechodza

### Railway Health Check (2026-03-31 - LIVE)

| Metric       | Value       | Status  |
| ------------ | ----------- | ------- |
| Status       | ok          | Healthy |
| Database     | connected   | OK      |
| Memory (RSS) | 112.99 MB   | Normal  |

---

## Otwarta kolejka

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

<!-- Last updated: 2026-04-02 -->
