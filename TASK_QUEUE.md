# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02, aktualizacja wieczorna)

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


<!-- Auto-generated on 2026-04-02T18:09:15.711Z -->

### GitHub Actions Errors (10 found)

- **GH-AUTO-2026-04-02-1** — Fix CI/CD Pipeline failure (E2E selector)
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** E2E tests used `.tab-pill` selector (old Topbar) but app now uses `.modern-nav-item` (AppShellModern sidebar). All `.tab-pill` → `.modern-nav-item` in auth/command-palette/meeting/tasks spec files.
  - **Created:** 2026-04-02T18:09:15.711Z
  - **Priority:** High

- **GH-AUTO-2026-04-02-2** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** `cd server &&` added before ffmpeg-static check (commit 2c57566). Docker ✅ passing since run 23914920737.
  - **Priority:** High

- **GH-AUTO-2026-04-02-3** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions  
  - **Fix:** Same as GH-AUTO-2. Docker Build ✅ passing.
  - **Priority:** High

- **GH-AUTO-2026-04-02-4** — Fix CI/CD Pipeline failure (E2E click timeout)
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Same as GH-AUTO-1. `.tab-pill` selector not found causing `.click()` timeout. Fixed by updating to `.modern-nav-item`.
  - **Priority:** High

- **GH-AUTO-2026-04-02-5** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Same as GH-AUTO-2. Docker Build ✅ passing.
  - **Priority:** High

- **GH-AUTO-2026-04-02-6** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** `cd server &&` added before ffmpeg-static check (commit 2c57566).
  - **Priority:** High

- **GH-AUTO-2026-04-02-7** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Same as GH-AUTO-6.
  - **Priority:** High

- **GH-AUTO-2026-04-02-8** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Same as GH-AUTO-6.
  - **Priority:** High

- **GH-AUTO-2026-04-02-9** — Fix Docker Build failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Same as GH-AUTO-6.
  - **Priority:** High

- **GH-AUTO-2026-04-02-10** — Fix Railway Error Reporter failure
  - **Status:** done
  - **Source:** GitHub Actions
  - **Fix:** Removed `railway login --token` step (unsupported flag). Reporter now uses RAILWAY_TOKEN env var directly. Run 23915129717 ✅ success.
  - **Priority:** High


### Railway Errors (1 found)

- **RW-AUTO-2026-04-02-11** — Fix Railway error
  - **Status:** done
  - **Source:** Railway
  - **Fix:** Part of Railway Error Reporter fix (GH-AUTO-10). Reporter run 23915129717 ✅ success.
  - **Priority:** High

