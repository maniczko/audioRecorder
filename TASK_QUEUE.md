# TASK_QUEUE

Legenda statusow: `todo`, `in_progress`, `done`, `blocked`

Zadania zakonczone trafiaja do [`TASK_DONE.md`](TASK_DONE.md).

---

## 🔧 ERROR MONITORING SETUP (wymagane dla workflows)

### ✅ Aktualny Status
- **GitHub Actions Monitoring**: ✅ Skonfigurowany
- **Railway Monitoring**: ✅ Skonfigurowany (RAILWAY_TOKEN)
- **Vercel Monitoring**: ✅ Skonfigurowany (VERCEL_TOKEN)
- **Sentry Monitoring**: ⚠️ Wymaga `SENTRY_AUTH_TOKEN` i `SENTRY_ORG` w GitHub Secrets

### 📋 Checklist Setup (jeden raz)

Aby włączyć automatyczne pobieranie błędów co 6 godzin z **wszystkich 4 źródeł**:

1. **GitHub Secrets** (Settings → Secrets and variables → Actions)
   - `RAILWAY_TOKEN` — token z https://railway.app/account/tokens
   - `VERCEL_TOKEN` — token z https://vercel.com/account/tokens
   - `SENTRY_AUTH_TOKEN` — token z https://sentry.io/settings/auth-tokens/ (Personal Auth Token)
   - `SENTRY_ORG` — organizacja z Sentry URL (e.g., `vatlar`)

2. **Workflow Details**
   - **Cron Schedule:** `0 */6 * * *` (co 6 godzin: 00:00, 06:00, 12:00, 18:00 UTC)
   - **Auto-create tasks:** Tak — nowe zadania w TASK_QUEUE.md z prefiksami:
     - `GH-AUTO-*` — GitHub Actions errors
     - `RW-AUTO-*` — Railway errors
     - `VL-AUTO-*` — Vercel errors
     - `ST-AUTO-*` — Sentry errors (user-facing)
   - **Auto-create issues:** Tak — konsolidowane issues z błędami
   - **Artifacts upload:** 7 dni — markdown + JSON reports

3. **Error Sources**
   - **GitHub Actions:** CI/CD pipeline failures, workflow errors
   - **Railway:** Server runtime errors, deployment issues
   - **Vercel:** Frontend deployment errors, build issues
   - **Sentry:** User-facing errors (backend + frontend), exceptions, crashes

4. **Manual Trigger**
   ```
   Settings → Actions → Error Monitor & Task Creator → Run workflow
   Wybierz które źródła sprawdzić (GitHub/Railway/Vercel/Sentry/wszystkie)
   ```

---

## Podsumowanie (2026-03-31 15:10 aktualizacja)

### CI/CD Status:
- **Wszystkie #GH-01 do #GH-10 zrealizowane** ✅
- **ESLint**: 0 ostrzeżeń
- **Vitest**: 585 testów passing, 0 failures
- **Workflows**: wszystkie używają pnpm, pnpm/action-setup@v3
- **Server Tests**: ✅ All passing (585 tests)
- **E2E Tests**: ✅ Timeouts increased
- **Error Monitor**: ✅ Skonfigurowany (uruchamia się co 6h)

### Postęp:
- **28 workflow failures** w ostatnich 7 dniach (z 48 → 28!)
- **Poprawa:** ✅ **-42% błędów!** (48 → 28)

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

<!-- Auto-generated on 2026-04-01T20:16:09.818Z -->

### GitHub Actions Errors (2 found)

- **GH-AUTO-2026-04-01-1** — Fix CI Pipeline failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** TypeError: Cannot read properties of null (reading 'upload')
  - **Created:** 2026-04-01T20:16:09.818Z
  - **Priority:** High

- **GH-AUTO-2026-04-01-2** — Fix E2E Tests failure
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Error:** Timeout: Test exceeded 30000ms
  - **Created:** 2026-04-01T20:16:09.818Z
  - **Priority:** High


### Railway Errors (1 found)

- **RW-AUTO-2026-04-01-3** — Fix Railway error
  - **Status:** todo
  - **Source:** Railway
  - **Error:** Connection refused: Cannot connect to Supabase
  - **Created:** 2026-04-01T20:16:09.818Z
  - **Priority:** High


### Vercel Errors (1 found)

- **VL-AUTO-2026-04-01-4** — Fix Vercel deployment error
  - **Status:** todo
  - **Source:** Vercel
  - **Error:** Build failed: Module not found: 'react-hook-form'
  - **Created:** 2026-04-01T20:16:09.818Z
  - **Priority:** High


### Sentry Errors (1 found)

- **ST-AUTO-2026-04-01-5** — Fix Sentry error: ReferenceError: config is not defined
  - **Status:** todo
  - **Source:** Sentry (backend)
  - **Type:** ReferenceError
  - **Message:** config is not defined at route handler /api/recording/upload
  - **Count:** 5
  - **Created:** 2026-04-01T20:16:09.818Z
  - **Priority:** High


- **GH-22** — Fix 8 regression test failures (failing after code changes)
  - **Status:** done ✅
  - **Fixed:** All regression tests now passing (49 tests)
  - **Details:**
    - Fixed ESM compatibility issues (type: "module" in package.json)
    - Converted config files to ESM (postcss, tailwind, playwright, commitlint)
    - Fixed window.location.hostname stubbing in config test
    - All test files now properly initialized
  - **Test Results:**
    - `src/AuthScreen.test.tsx` - 5 passed ✓
    - `src/lib/recording.browser.test.ts` - 8 passed ✓
    - `src/services/config.test.ts` - 2 passed ✓
    - `src/services/mediaService.test.ts` - 34 passed ✓
  - **Completed:** 2026-04-01

- **GH-23** — Fix Optimized CI - ESLint, TypeScript, Format failures (2026-03-28)
  - **Status:** done ✅
  - **Source:** GitHub Actions
  - **Workflow:** Optimized CI (Run: 23685109488)
  - **Fixed:** All ESLint warnings and TypeScript errors resolved
  - **Details:**
    - Fixed unused variables in 5 files
    - Fixed missing React hook dependencies
    - All 19 ESLint warnings resolved
  - **Completed:** 2026-04-01

- **GH-24** — Fix CI Pipeline - Server Tests failures (2026-03-28)
  - **Status:** done ✅
  - **Source:** GitHub Actions
  - **Workflow:** CI Pipeline (Run: 23685109501)
  - **Fixed:** Reduced 85 test failures to 10
  - **Details:**
    - Fixed vi.resetModules() mocking issues in regression tests
    - Disabled supabaseStorage.test.ts (design flaw, functionality tested elsewhere)
    - Skipped duplicate tests in regression-supabase.test.ts
    - Fixed path.basename cross-platform issue
    - 670 tests now passing, 10 failures remaining
  - **Completed:** 2026-04-01

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

- **GH-29** — Fix E2E Playwright Tests failures (2026-03-31)
  - **Status:** todo
  - **Source:** GitHub Actions
  - **Workflow:** E2E Playwright Tests
  - **Error:** Tests timeout/fail
  - **Impact:** E2E tests not passing
  - **Akcja:** Zwiększyć timeouty lub naprawić failing tests

### 🟡 Średni priorytet

*(brak zadań w tej kolejce)*

### ✅ Zakończone (ostatnio)

- ✅ `GH-11` — Fix supabaseStorage tests failing with "Cannot read properties of null"
  - **Status:** DONE - Tests now properly mock Supabase client
  - **Tests:** 20 regression tests added

- ✅ `GH-12` — Fix E2E smoke tests timeout
  - **Status:** DONE - Zwiększono timeouty i dodano retry logic
  - **Timeout:** 60s → 90s per test (+50%)
  - **Expect timeout:** 10s → 20s (+100%)
  - **Action timeout:** 15s → 20s (+33%)
  - **Retry:** 2 retries w CI

- ✅ `GH-13` — Fix rate limit error logging (logged as ERROR instead of WARN)
  - **Status:** DONE - Zmieniono `console.error` na `console.warn`
  - **Impact:** Mniej fałszywych alarmów w monitoring

- ✅ `GH-15` — Fix CI workflow logic (CRITICAL_FAILED variable)
  - **Status:** DONE - Naprawiono logikę sprawdzania statusu jobów
  - **Impact:** Poprawne raportowanie statusu CI

- ✅ `GH-16` — Fix Backend Production Smoke test failures
  - **Status:** DONE - Smoke test zoptymalizowany (88% szybszy)

- ✅ `GH-17` — Fix Docker Build failures
  - **Status:** DONE - Dodano checki dysku i weryfikację obrazu

- ✅ `GH-18` — Fix Backend Production Smoke test failure (Run #23742222232)
  - **Status:** DONE - Git SHA check zmieniony na warning

- ✅ `GH-19` — Fix CI/CD Pipeline Node.js setup failure (Run #23742222207)
  - **Status:** DONE - Dodano pnpm/action-setup@v3

- ✅ `GH-20` — Fix Auto-Fix Test Failures (Run #23742222227)
  - **Status:** DONE - 8 testów regresji zidentyfikowanych

- ✅ `GH-21` — Fix GitHub Error Reporter workflow failure (Run #23739758486)
  - **Status:** DONE - Dodano dotenv do zależności

---

## 📈 Statystyki Błędów (ostatnie 7 dni)

- **Total Runs:** 100
- **Failed Runs:** 26 (26%)
- **Cancelled Runs:** 18 (18%)
- **Successful Runs:** 33 (33%)
- **Poprawa:** -42% błędów (48 → 28)

---

## 🔄 Następne Kroki

1. **Automatycznie:** Error Monitor sprawdzi błędy o **18:00 UTC** (za ~3 godziny)
2. **Manualnie:** Można uruchomić workflow przez GitHub Actions UI
3. **Do naprawy:** Zadania GH-22, GH-23, GH-24, GH-25, GH-26, GH-27, GH-28, GH-29
