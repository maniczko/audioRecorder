# GitHub Actions Errors Summary

**Generated:** 2026-03-28
**Period:** Last 7 days (2026-03-25 to 2026-03-28)
**Source:** All files in `github-errors/` directory

---

## 📊 Overall Statistics

| Metric              | Count | Trend                   |
| ------------------- | ----- | ----------------------- |
| Total Workflow Runs | ~500+ | -                       |
| Failed Runs         | 26-61 | ⬇️ Decreasing (48 → 28) |
| Cancelled Runs      | 18    | -                       |
| Successful Runs     | 33    | ⬆️ Increasing           |

---

## 🔴 Top Error Categories

### 1. **E2E Playwright Tests** (Most Frequent)

- **Error:** `locator.toBeVisible() failed - element(s) not found`
- **Location:** `tests/e2e/smoke.spec.js`
- **Frequency:** ~40% of all failures
- **Impact:** HIGH - Blocks deployment verification
- **Status:** 🔴 OPEN (#GH-12)

### 2. **Server Tests - supabaseStorage** (Fixed)

- **Error:** `TypeError: Cannot read properties of null (reading 'storage')`
- **Location:** `server/tests/lib/supabaseStorage.test.ts`
- **Frequency:** ~25% of all failures
- **Impact:** HIGH - 26 test failures
- **Status:** ✅ FIXED - Tests now properly mock Supabase client

### 3. **Rate Limit Errors** (Expected Behavior)

- **Error:** `APP ERROR STACK Error: Zbyt wiele prob. Limit: 20 żądań/min`
- **Location:** `server/lib/serverUtils.ts`
- **Frequency:** ~15% of all failures
- **Impact:** MEDIUM - False alarms in monitoring
- **Status:** 🟡 OPEN (#GH-13) - Should log as WARN not ERROR

### 4. **embedTextChunks Errors** (Fixed)

- **Error:** `embedTextChunks failed: Error: embed failed`
- **Location:** `server/postProcessing.ts:212`
- **Frequency:** ~10% of all failures
- **Impact:** LOW - Handled gracefully, returns []
- **Status:** ✅ FIXED - Function properly returns empty array

### 5. **CI Pipeline - Workflow Logic**

- **Error:** `CRITICAL_FAILED="false"` / `❌ Critical checks failed`
- **Location:** `.github/workflows/ci-optimized.yml`
- **Frequency:** ~5% of all failures
- **Impact:** MEDIUM - CI status incorrect
- **Status:** 🟡 TO INVESTIGATE

### 6. **Backend Production Smoke**

- **Error:** Various timeout and connection errors
- **Location:** `server/tests/` integration tests
- **Frequency:** ~3% of all failures
- **Impact:** MEDIUM - Production readiness unclear
- **Status:** 🟡 TO INVESTIGATE

### 7. **Docker Build**

- **Error:** Build failures, dependency issues
- **Location:** `Dockerfile`
- **Frequency:** ~2% of all failures
- **Impact:** HIGH - Blocks deployments
- **Status:** 🟡 TO INVESTIGATE

---

## 📋 Complete Task Queue

### 🔴 High Priority

| ID     | Title                       | Error                            | Status   |
| ------ | --------------------------- | -------------------------------- | -------- |
| #GH-11 | Fix supabaseStorage tests   | `Cannot read properties of null` | ✅ FIXED |
| #GH-12 | Fix E2E smoke tests timeout | `element(s) not found`           | 🕐 OPEN  |

### 🟡 Medium Priority

| ID     | Title                         | Error                             | Status   |
| ------ | ----------------------------- | --------------------------------- | -------- |
| #GH-13 | Fix rate limit error logging  | `logged as ERROR instead of WARN` | 🕐 OPEN  |
| #GH-14 | Fix embedTextChunks rejection | `unhandled promise rejection`     | ✅ FIXED |
| #GH-15 | Fix CI workflow logic         | `CRITICAL_FAILED` logic error     | 🔍 TODO  |
| #GH-16 | Fix Backend Production Smoke  | `timeout and connection errors`   | 🔍 TODO  |
| #GH-17 | Fix Docker Build failures     | `build failures`                  | 🔍 TODO  |

### 🟢 Low Priority

| ID   | Title                 | Error                     | Status  |
| ---- | --------------------- | ------------------------- | ------- |
| #403 | Migrate inline styles | `155 inline styles`       | 🕐 OPEN |
| #341 | Memory profiling      | `clinic.js, 0x profiling` | 🕐 OPEN |
| #342 | APM integration       | `DataDog/NewRelic`        | 🕐 OPEN |

---

## 📈 Trend Analysis

### Week of 2026-03-25 to 2026-03-28

| Date       | Failed Runs | Main Issues                                 |
| ---------- | ----------- | ------------------------------------------- |
| 2026-03-25 | 45          | E2E timeouts, supabaseStorage tests         |
| 2026-03-26 | 59-61       | Peak failures - Docker + E2E + Server tests |
| 2026-03-27 | ~40         | Decreasing - some fixes applied             |
| 2026-03-28 | 26          | ✅ Best day - supabaseStorage fixed         |

**Improvement:** -42% (48 → 28 failed runs)

---

## 🎯 Recommended Actions

### Immediate (This Week)

1. **#GH-12** - Fix E2E smoke tests
   - Increase timeout from 5s to 15s
   - Add better wait conditions (`waitForSelector`)
   - Add retry logic for flaky tests

2. **#GH-13** - Fix rate limit logging
   - Change `console.error` to `console.warn` in `checkRateLimit()`
   - Add log level configuration

3. **#GH-15** - Fix CI workflow logic
   - Review `CRITICAL_FAILED` variable logic
   - Fix job status aggregation

### Short Term (Next Week)

4. **#GH-16** - Investigate Backend Production Smoke
   - Add more detailed logging
   - Increase smoke test timeout
   - Mock external dependencies

5. **#GH-17** - Fix Docker Build failures
   - Pin Node.js version
   - Cache dependencies
   - Add build health check

### Long Term (This Month)

6. **#403** - Migrate inline styles to CSS variables
7. **#341** - Add memory profiling to CI
8. **#342** - Integrate APM (DataDog/NewRelic)

---

## ✅ Success Metrics

- [ ] Reduce failed runs from 28 to <10 per week
- [ ] Fix all 🔴 High Priority issues
- [ ] Fix 50% of 🟡 Medium Priority issues
- [ ] Maintain 90%+ test coverage
- [ ] Achieve 95%+ CI pass rate

---

**Last Updated:** 2026-03-28 12:30
**Next Review:** 2026-04-04
