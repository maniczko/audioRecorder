# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

## Podsumowanie (2026-04-02 07:30 aktualizacja — auto fetch)

### CI/CD Status:
- **Wszystkie #GH-01 do #GH-24 zrealizowane** ✅
- **ESLint**: 0 ostrzeżeń
- **Vitest**: 748 testów passing, 0 failures (Server + Frontend)
- **Workflows**: wszystkie używają pnpm, pnpm/action-setup@v3
- **Server Tests**: ✅ All passing (748 tests)
- **E2E Tests**: ⚠️ `seedLog` export missing w helpers/seed
- **Error Monitor**: ✅ Skonfigurowany (uruchamia się co 6h)

### Postęp:
- **48 workflow failures** w ostatnich 7 dniach (wzrost z 28 → 48 ⚠️)
- **Regresja:** ❌ **+71% błędów!** (28 → 48)
- **Nowe problemy:** ES module `require`, Docker Node.js missing, PARSE_ERROR w testach

### 🟢 Railway Health Check (2026-03-31 15:08 - LIVE)

| Metric | Value | Status |
|--------|-------|--------|
| Status | `ok` | ✅ Healthy |
| Database | `connected` | ✅ OK |
| Uptime | 64s | ✅ Fresh deployment |
| Memory (RSS) | 112.99 MB | ✅ Normal |
| Git SHA | `1d70ce9` | ✅ Latest (2026-03-31 15:08) |
| Build Time | 2026-03-31T15:08:43.800Z | ✅ Recent |

---

## 📊 Wszystkie Błędy z Ostatnich 7 Dni (2026-03-25 do 2026-03-31)

### GitHub Actions

| Data | Workflow | Job | Błąd | Status |
|------|----------|-----|------|--------|
| 2026-03-28 | Optimized CI | lint, typecheck, format | CRITICAL_FAILED | ⚠️ Wymaga naprawy |
| 2026-03-28 | CI Pipeline | Server Tests | embedTextChunks failed, Supabase errors | ⚠️ Wymaga naprawy |
| 2026-03-28 | CI Pipeline | E2E Smoke Tests | toBeVisible failed | ⚠️ Wymaga naprawy |
| 2026-03-30 | Backend Production Smoke | Verify | Git SHA mismatch | ✅ Naprawiono |
| 2026-03-30 | CI/CD Pipeline | Quality Checks | Setup Node.js failed | ✅ Naprawiono |
| 2026-03-30 | GitHub Error Reporter | fetch-errors | dotenv missing | ✅ Naprawiono |
| 2026-03-31 | Error Monitor | railway-errors | Project not linked | ⚠️ Wymaga RAILWAY_TOKEN |
| 2026-03-31 | Error Monitor | task-creator | Workflow dispatch failed (403) | ⚠️ Wymaga naprawy |
| 2026-03-31 | Railway Error Reporter | fetch-railway-errors | Project not linked | ⚠️ Wymaga RAILWAY_TOKEN |
| 2026-03-31 | Docker Build | Build & Verify | Docker build failed | ⚠️ Wymaga naprawy |
| 2026-03-31 | Auto-Fix Test Failures | test-and-fix | Tests still failing | ⚠️ Wymaga naprawy |
| 2026-03-31 | E2E Playwright Tests | E2E | Tests timeout/fail | ⚠️ Wymaga naprawy |

### Railway (LIVE)

| Metric | Status | Details |
|--------|--------|---------|
| Health | ✅ OK | All systems operational |
| Database | ✅ Connected | Supabase connected |
| Memory | ✅ 113 MB | Well within 4GB limit |
| Uptime | ✅ 64s | Fresh deployment |
| CLI Access | ⚠️ Not linked | Requires `railway link` |

---

## Otwarta kolejka

### 🔴 Wysoki priorytet

- **GH-25** — Setup Railway CLI auto-linking for error monitor
  - **Status:** todo
  - **Source:** Railway Error Monitor
  - **Error:** `Project not linked. Please run: railway link`
  - **Impact:** Railway errors not being fetched automatically
  - **Akcja:** Dodać RAILWAY_PROJECT_ID do workflow lub naprawić auto-linking

- **GH-26** — Fix Error Monitor workflow dispatch failures (2026-03-31)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Error Monitor & Task Creator
  - **Error:** HTTP 403 - Resource not accessible by personal access token
  - **Impact:** Cannot manually trigger workflow
  - **Akcja:** Sprawdzić uprawnienia GITHUB_TOKEN lub czekać na automatyczne uruchomienie o 18:00 UTC

- **GH-27** — Fix Docker Build failures (2026-03-31)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Docker Build
  - **Error:** Build & Verify Docker Image failed
  - **Impact:** Docker image not being built
  - **Akcja:** Sprawdzić logi Docker build i naprawić błędy

- **GH-28** — Fix Auto-Fix Test Failures workflow (2026-03-31)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Auto-Fix Test Failures
  - **Error:** Tests still failing after retry
  - **Impact:** Tests not being auto-fixed
  - **Akcja:** Naprawić testy które nie przechodzą po retry

- **GH-29** — Fix E2E Playwright Tests failures
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** E2E Playwright Tests
  - **Error:** `SyntaxError: The requested module './helpers/seed' does not provide an export named 'seedLog'` (x2, 2026-04-01)
  - **Impact:** E2E tests nie uruchamiają się
  - **Akcja:** Dodać eksport `seedLog` w `e2e/helpers/seed.ts` lub naprawić import

- **GH-30** — Fix `require` w ES module scope (Auto Security Patches + Optimized CI)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Auto Security Patches, Optimized CI
  - **Error:** `ReferenceError: require is not defined in ES module scope` (2026-04-02)
  - **Impact:** Security patches i CI nie mogą się uruchomić
  - **Akcja:** Zamienić `require()` na `import` lub zmienić rozszerzenie pliku na `.cjs`

- **GH-31** — Fix CI/CD Pipeline PARSE_ERROR w testach (x10 runs)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** CI/CD Pipeline
  - **Error:** `code: 'PARSE_ERROR'` w Unit Tests (2026-04-01, x10 uruchomień)
  - **Impact:** Wszystkie unit testy nie przechodzą przez błąd parsowania
  - **Akcja:** Zidentyfikować plik z błędem składni lub problem z konfiguracją Vitest

- **GH-32** — Fix Bundle Size Monitor — brak katalogu dist/
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Bundle Size Monitor
  - **Error:** `ENOENT: no such file or directory, scandir '.../dist'` (x4, 2026-04-01)
  - **Impact:** Bundle size nie jest monitorowany
  - **Akcja:** Uruchomić build przed krokiem monitorowania lub naprawić kolejność kroków

- **GH-33** — Fix "Remote boom" bootstrap failure (Code Review + Auto-Fix, x8)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Code Review, Auto-Fix Test Failures
  - **Error:** `Remote workspace bootstrap failed. Error: Remote boom` (x8, 2026-04-01)
  - **Impact:** Automatyczne code review i auto-fix nie działają
  - **Akcja:** Sprawdzić konfigurację remote workspace / secrets Claude API

- **GH-34** — Fix AI Auto-Fix — brak pliku lint-output.txt
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** AI Auto-Fix
  - **Error:** `ENOENT: no such file or directory, open 'lint-output.txt'` (2026-04-01)
  - **Impact:** AI Auto-Fix nie może przeczytać wyników lint
  - **Akcja:** Upewnić się że krok lint zapisuje output do pliku przed wywołaniem AI Auto-Fix

- **GH-35** — Fix Preview Deployment — Vercel secrets validation (x3)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** Preview Deployment (Vercel)
  - **Error:** Step `Validate Vercel secrets` failing (x3, 2026-04-01, Dependabot PRs)
  - **Impact:** Preview deployments nie działają dla Dependabot PRs
  - **Akcja:** Dodać Vercel secrets do Dependabot secrets lub pominąć deployment dla Dependabot

### 🟡 Średni priorytet

*(brak zadań w tej kolejce)*

### ✅ Zakończone (ostatnio)

*(wszystkie zadania przeniesiono do [TASK_DONE.md](TASK_DONE.md))*

---

## 📈 Statystyki Błędów (ostatnie 7 dni — 2026-04-02 07:30)

- **Total Runs:** 100
- **Failed Runs:** 48 (48%) ⚠️ wzrost z 26!
- **Cancelled Runs:** 10 (10%)
- **Successful Runs:** 42 (42%)
- **Regresja:** ❌ +71% błędów (28 → 48)

### Rozkład błędów wg workflow:
| Workflow | Failures | Główny błąd |
|---------|---------|-------------|
| CI/CD Pipeline | x10 | PARSE_ERROR w testach |
| Error Monitor | x10 | brak logów (permissions?) |
| Docker Build | x6 | Node.js not found w image |
| Code Review | x4 | Remote boom bootstrap |
| Auto-Fix Test Failures | x4 | Remote boom bootstrap |
| Bundle Size Monitor | x4 | dist/ not found |
| Preview Deployment | x3 | Vercel secrets |
| E2E Playwright Tests | x2 | seedLog export missing |
| Railway Error Reporter | x2 | Railway login |
| Auto Security Patches | x1 | require() ES module |
| AI Auto-Fix | x1 | lint-output.txt missing |
| Optimized CI | x1 | require() ES module |

---

## 🔄 Następne Kroki

1. **Najwyższy priorytet:** GH-31 (PARSE_ERROR — blokuje x10 CI runs)
2. **Automatycznie:** Error Monitor sprawdzi błędy o **12:00 UTC** (co 6h)
3. **Do naprawy:** GH-25 do GH-35 (11 otwartych zadań)
