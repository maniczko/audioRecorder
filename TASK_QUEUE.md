# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-03-28 aktualizacja)

### CI/CD Status:
- 48 workflow failures w ostatnich 7 dniach
- Główna przyczyna: **brakujący `pnpm/action-setup`** w 6 workflowach + 21× `npm run` zamiast `pnpm run`
- Naprawiono dziś: #GH-05, #GH-06, #GH-07 (wszystkie workflow pnpm fixes)

---

## Otwarta kolejka

### 🔴 Wysoki priorytet

#### `#GH-01` — Naprawić Optimized CI / CI Pipeline failures
Status: `in_progress`
Zakres: ci-optimized.yml miał 8× `npm run` zamiast `pnpm run` — **naprawione**.
Pozostaje: weryfikacja czy testy przechodzą po fix (frontend test failures mogą być pre-existing).
Akceptacja: Optimized CI workflow przechodzi na zielono.

#### `#GH-02` — Naprawić E2E Playwright Tests
Status: `todo`
Zakres: Playwright E2E testy failują z timeoutami. Playwright.yml jest poprawny (używa pnpm).
Przyczyny do zbadania:
- Timeouty testów (domyślne timeout za krótkie?)
- Backend nie startuje w CI (brak env variables?)
- Frontend build fails przed uruchomieniem testów
Akceptacja: E2E workflow przechodzi lub ma sensowne skip conditions.

#### `#GH-03` — Naprawić auto-fix.yml workflow
Status: `in_progress`
Zakres: Workflow poprawny (pnpm setup OK). Failuje bo `pnpm run test:retry` (vitest --retry=3) zwraca failing tests.
Przyczyna: pre-existing test failures w frontendzie (UI selector issues).
Akceptacja: auto-fix workflow przechodzi lub nie blokuje merge.

#### `#GH-04` — Naprawić Backend Production Smoke tests
Status: `todo`
Zakres: Smoke test łączy się z Railway production (`audiorecorder-production.up.railway.app/health`).
Przyczyny do zbadania:
- Railway deployment nie jest aktualne (nowy commit nie zdeplojowany?)
- Health endpoint nie odpowiada
- `EXPECTED_GIT_SHA` nie pasuje do zdeplojowanej wersji
Akceptacja: Smoke test przechodzi lub ma retry logic.

### ✅ Naprawione (do przeniesienia po weryfikacji)

#### `#GH-05` — Auto Security Patches workflow
Status: `done` (2026-03-28)
Zakres: Brakujący `pnpm/action-setup`, `npm audit` → `pnpm audit`, `npm run` → `pnpm run`.
Naprawione pliki: `.github/workflows/security-auto-patch.yml`

#### `#GH-06` — GitHub Error Reporter workflow
Status: `done` (2026-03-28)
Zakres: `npm ci` → `pnpm install`, brakujący `pnpm/action-setup`, exit(0) dla reportera, fix double-wrap logs.
Naprawione pliki: `.github/workflows/github-error-reporter.yml`, `scripts/fetch-github-errors.js`

#### `#GH-07` — Masowa naprawa npm→pnpm we wszystkich workflow
Status: `done` (2026-03-28)
Zakres: 6 workflowów miało brakujący `pnpm/action-setup@v3`, 21 komend `npm run` → `pnpm run`.
Naprawione pliki:
- `.github/workflows/ai-auto-fix.yml` — +pnpm setup, 5× npm→pnpm
- `.github/workflows/bundle-size.yml` — +pnpm setup, 1× npm→pnpm
- `.github/workflows/changelog.yml` — +pnpm setup, 1× npm→pnpm
- `.github/workflows/code-review.yml` — +pnpm setup ×4 jobs, 3× npm→pnpm, npm audit→pnpm audit
- `.github/workflows/issue-to-pr.yml` — +pnpm setup, 2× npm→pnpm (JS execSync)
- `.github/workflows/security-auto-patch.yml` — +pnpm setup, npm audit→pnpm audit, npm run→pnpm run
- `.github/workflows/ci-optimized.yml` — 8× npm→pnpm (lint, typecheck, format, test, coverage, audit, build, docs)
- `.github/workflows/auto-fix.yml` — 2× npm→pnpm (PR comment instructions)

### 🟡 Niski priorytet

- 🟡 `403` — Migrate inline styles to CSS variables (155 inline styles do refaktoryzacji)
- 🟡 `341` — Memory profiling w production (clinic.js, 0x profiling)
- 🟡 `342` — APM integration (DataDog/NewRelic)

---

## Wymagane następne kroki

1. **Push zmian** — wypchnąć wszystkie naprawki workflow na `main`
2. **Zweryfikować CI** — sprawdzić czy Optimized CI, CI Pipeline przechodzą
3. **#GH-02** — zbadać logi E2E Playwright (jeśli dalej failuje po pnpm fix)
4. **#GH-04** — sprawdzić Railway deployment status
5. **#GH-03** — jeśli test:retry dalej failuje, zbadać konkretne failing tests

