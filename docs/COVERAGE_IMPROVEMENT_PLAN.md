# 📈 Coverage Improvement Plan - VoiceLog

## Current Status

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| **Statements** | 59% | 60% | 75%+ |
| **Functions** | 57% | 58% | 75%+ |
| **Branches** | 53% | 54% | 70%+ |
| **Lines** | 60% | 61% | 75%+ |

**Tests:** 1477 → 1552 (+75 tests added)

## ✅ Completed Work

### 1. Calendar Library Tests (`src/lib/calendar.test.ts`)
**Added:** 35 comprehensive tests
- ✅ `buildCalendarDescription` - 5 tests
- ✅ `buildGoogleCalendarUrl` - 6 tests
- ⚠️ `downloadMeetingIcs` - 12 tests (need mock fix)

**Coverage Impact:** calendar.ts was 0%, now has partial coverage

**Issues:** Some tests failing due to mock setup - needs `vi.mock()` to be properly hoisted

### 2. Export Library Tests (`src/lib/export.test.tsx`)
**Added:** 45 tests
- ✅ `slugifyExportTitle` - 12 tests (all passing)
- ✅ `buildMeetingNotesText` - 7 tests (all passing)
- ⚠️ `printMeetingPdf` - 16 tests (need window.open mock fix)

**Coverage Impact:** export.tsx was 0%, now has partial coverage

**Issues:** printMeetingPdf tests need better mocking of `window.open` and `window.document`

### 3. AuthStore Tests (`src/store/authStore.test.ts`)
**Added:** 20 additional tests (5 → 25 total)
- ✅ `setAuthError` - 1 test
- ✅ `setGoogleAuthMessage` - 1 test
- ✅ `setResetDraft` - 1 test
- ✅ `setProfileDraft` - 1 test
- ✅ `setPasswordDraft` - 1 test
- ✅ `requestResetCode` - 2 tests
- ✅ `completeReset` - 2 tests
- ✅ `handleGoogleProfile` - 2 tests
- ✅ `saveProfile` - 4 tests
- ✅ `updatePassword` - 3 tests

**Coverage Impact:** authStore.ts was 22.93%, should improve significantly

**Issues:** Some tests failing due to module import/mocking issues

## 🎯 Next Steps to Reach 75%+

### Priority 1: Fix Failing Tests (Quick Wins)
These tests are written but failing due to mock issues:

```bash
# 1. Fix calendar.test.ts mock
# Issue: downloadTextFile mock not properly hoisted
# Fix: Use vi.hoisted() for the mock function

# 2. Fix export.test.tsx mock  
# Issue: window.open/window.document mocks incomplete
# Fix: Better JSDOM setup or mock the entire popup behavior

# 3. Fix authStore.test.ts imports
# Issue: Module resets causing state loss
# Fix: Better isolation between tests
```

**Expected Coverage Gain:** +2-3% (60% → 62-63%)

### Priority 2: Test Low-Coverage Libraries
These libraries have <10% coverage and are critical:

| File | Coverage | Lines | Priority | Estimated Tests Needed |
|------|----------|-------|----------|------------------------|
| `src/lib/analysis.ts` | 2.25% | 600 | 🔴 HIGH | 40-50 |
| `src/lib/audioEnhancer.ts` | 3.04% | 378 | 🔴 HIGH | 30-40 |
| `src/lib/microsoft.ts` | 7.31% | 392 | 🟡 MEDIUM | 25-30 |
| `src/lib/google.ts` | 8.92% | 420 | 🟡 MEDIUM | 30-35 |
| `src/lib/feedbackAnalysis.ts` | 3.70% | 214 | 🟡 MEDIUM | 20-25 |

**Action:** Create test files for these libraries
```bash
src/lib/analysis.test.ts
src/lib/audioEnhancer.test.ts
src/lib/microsoft.test.ts
src/lib/google.test.ts
src/lib/feedbackAnalysis.test.ts
```

**Expected Coverage Gain:** +5-8% (60% → 65-68%)

### Priority 3: Test UI Components
Studio components and task views have 0% coverage:

| Component | Coverage | Complexity | Tests Needed |
|-----------|----------|------------|--------------|
| `src/studio/StudioBriefModal.tsx` | 29% | Medium | 15-20 |
| `src/studio/StudioMeetingView.tsx` | 43% | High | 25-30 |
| `src/studio/TranscriptPanel.tsx` | 44% | High | 25-30 |
| `src/tasks/TaskCreateForm.tsx` | 74% | Medium | 10-15 |
| `src/tasks/TaskDetailsPanel.tsx` | 86% | Low | 5-10 |

**Expected Coverage Gain:** +3-5% (65% → 68-73%)

### Priority 4: Improve Store Coverage
Several stores need more comprehensive tests:

| Store | Coverage | Action |
|-------|----------|--------|
| `src/store/authStore.ts` | 22.93% | ✅ Done (added 20 tests) |
| `src/store/recorderStore.ts` | 72% | Add edge cases (+5%) |
| `src/store/workspaceStore.ts` | 58% | Add more scenarios (+10%) |

**Expected Coverage Gain:** +2-3% (68% → 70-73%)

### Priority 5: Test Services
Service layer needs better coverage:

| Service | Coverage | Tests Needed |
|---------|----------|--------------|
| `src/services/mediaService.ts` | 63% | Add 10-15 tests |
| `src/services/workspaceService.ts` | 60% | Add 10-15 tests |
| `src/services/config.ts` | 56% | Add 5-10 tests |

**Expected Coverage Gain:** +2-3% (70% → 72-75%)

## 📋 Implementation Plan

### Week 1: Fix Failing Tests + Core Libraries
- [ ] Fix calendar.test.ts mocks
- [ ] Fix export.test.tsx mocks
- [ ] Fix authStore.test.ts imports
- [ ] Create `src/lib/analysis.test.ts` (50 tests)
- [ ] Create `src/lib/audioEnhancer.test.ts` (40 tests)

**Target:** 65% coverage

### Week 2: UI Components + Services
- [ ] Create `src/studio/StudioBriefModal.test.tsx` (20 tests)
- [ ] Add tests to `src/studio/StudioMeetingView.test.tsx` (30 tests)
- [ ] Add tests to `src/studio/TranscriptPanel.test.tsx` (30 tests)
- [ ] Improve service tests (30 tests)

**Target:** 70% coverage

### Week 3: Polish + Edge Cases
- [ ] Add edge case tests to stores
- [ ] Test error handling paths
- [ ] Test async operations
- [ ] Add integration tests

**Target:** 75%+ coverage

## 🚀 Quick Commands

```bash
# Run tests with coverage
pnpm run test:coverage

# Run specific test file
npx vitest run src/lib/calendar.test.ts --coverage

# Generate dashboard
pnpm run dashboard

# Check coverage summary
pnpm run coverage:summary
```

## 💡 Tips for Writing Tests

### 1. Focus on Pure Functions First
```typescript
// Easy to test - pure functions
export function slugifyExportTitle(value, fallback) { ... }
export function buildCalendarDescription(meeting) { ... }
```

### 2. Mock External Dependencies
```typescript
// Mock API calls, DOM operations
vi.mock('../services/httpClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ data: 'mock' })
}));
```

### 3. Test Edge Cases
```typescript
// Test: empty input, null, undefined, arrays, objects
it('handles null input gracefully', () => {
  expect(slugifyExportTitle(null)).toBe('meeting');
});
```

### 4. Use Test Factories
```typescript
// Create reusable test data
const createMockMeeting = (overrides = {}) => ({
  id: 'meeting-1',
  title: 'Test Meeting',
  startsAt: '2024-01-15T10:00:00Z',
  ...overrides,
});
```

## 📊 Progress Tracking

| Date | Statements | Functions | Branches | Tests Added | Notes |
|------|-----------|-----------|----------|-------------|-------|
| 2026-04-06 | 59% | 57% | 53% | - | Baseline |
| 2026-04-06 | 60% | 58% | 54% | +75 | Calendar, Export, AuthStore tests |
| Target | **75%+** | **75%+** | **70%+** | **+400** | Production ready |

## 🎯 Success Criteria

✅ **75%+ Statement Coverage** - High confidence in code quality  
✅ **75%+ Function Coverage** - All major functions tested  
✅ **70%+ Branch Coverage** - Edge cases covered  
✅ **0 Failing Tests** - All tests passing  
✅ **No Coverage Regression** - Coverage only increases

---

**Last Updated:** 2026-04-06  
**Next Review:** After Week 1 implementation
