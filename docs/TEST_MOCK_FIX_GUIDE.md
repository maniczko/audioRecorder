# Test Mock Fix Guide

## Problem

~286 frontend tests were failing with errors like:
- `useRecorderCtx must be used within RecorderProvider`
- `Cannot read properties of undefined (reading 'xxx')`
- Store selectors returning undefined

## Root Cause

**Conflicting mock definitions** between `setupTests.ts` and individual test files.

### What Was Happening

1. `setupTests.ts` defined global mocks for React Contexts and Zustand stores
2. Individual test files ALSO defined their own mocks with different shapes
3. Vitest processes `vi.mock()` calls before imports, but when BOTH setupTests and test files define mocks for the same module, there's a conflict
4. Some tests would use the setupTests mock, others would use the test file's mock, causing inconsistent behavior
5. Additionally, `vi.clearAllMocks()` and `vi.restoreAllMocks()` in test `beforeEach`/`afterEach` hooks were interfering with mock state

## Solution

### Changes Made to `setupTests.ts`

**REMOVED** all React Context and Store mocks:
- `RecorderContext`
- `GoogleContext`
- `WorkspaceContext`
- `MeetingsContext`
- `uiStore`
- `workspaceStore`

**KEPT** only truly global mocks:
- Browser APIs (fetch, localStorage, mediaDevices, etc.)
- Global utilities (ResizeObserver, IntersectionObserver, etc.)
- Third-party modules (idb-keyval, react-virtuoso)

### What Developers Need to Do

**Every test file that uses React hooks or contexts MUST mock those dependencies.**

#### Example: Testing a Hook That Uses Contexts

```typescript
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import useMyHook from './useMyHook';

// 1. Create mock state with vi.hoisted()
const mockRecorderCtx = vi.hoisted(() => ({
  isRecording: false,
  recordingMeetingId: null,
  currentSegments: [],
  // ... add ALL fields your hook uses
}));

const mockUIStore = vi.hoisted(() => ({
  activeTab: 'studio',
  setActiveTab: vi.fn(),
  // ... add ALL fields
}));

// 2. Mock modules BEFORE imports (vi.mock is hoisted automatically)
vi.mock('../context/RecorderContext', () => ({
  useRecorderCtx: () => mockRecorderCtx,
}));

vi.mock('../store/uiStore', () => ({
  useUIStore: (selector?: (state: typeof mockUIStore) => unknown) =>
    selector ? selector(mockUIStore) : mockUIStore,
}));

// Mock other dependencies as needed
vi.mock('../context/GoogleContext', () => ({
  useGoogleCtx: () => ({ googleEnabled: false, calendarEvents: [] }),
}));

vi.mock('./useMeetings', () => ({
  default: () => ({
    userMeetings: [],
    meetingTasks: [],
    selectedMeeting: null,
    selectedRecording: null,
  }),
}));

// 3. Import AFTER mocks
import useMyHook from './useMyHook';

describe('useMyHook', () => {
  it('works correctly', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBeDefined();
  });
});
```

#### Key Rules

1. **Use `vi.hoisted()` for mock state** - Ensures variables are available when mock factories run
2. **Mock ALL dependencies** - Check what your hook/component imports and mock them all
3. **Include ALL required fields** - Missing fields cause "Cannot read properties of undefined" errors
4. **Match the actual module's export shape** - If the real module exports `{ useMyHook, MyProvider }`, your mock should too
5. **Don't call `vi.restoreAllMocks()`** - This can interfere with `vi.mock()` mocks. Use `vi.clearAllMocks()` only if needed

#### Common Mock Shapes

**Zustand Store** (supports selector pattern):
```typescript
const mockStore = vi.hoisted(() => ({
  field1: 'value',
  action: vi.fn(),
}));

vi.mock('../store/myStore', () => ({
  useMyStore: (selector?: (state: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));
```

**React Context**:
```typescript
const mockCtx = vi.hoisted(() => ({
  value1: 'default',
  method1: vi.fn(),
}));

vi.mock('../context/MyContext', () => ({
  MyProvider: ({ children }: any) => children,
  useMyCtx: () => mockCtx,
}));
```

**Custom Hook**:
```typescript
vi.mock('./useOtherHook', () => ({
  default: () => ({
    // Return what the actual hook would return
    data: [],
    loading: false,
    error: null,
  }),
}));
```

## Testing Your Changes

```bash
# Run single test file
npx vitest run src/hooks/myHook.test.ts --coverage.enabled=false

# Run with verbose output
npx vitest run src/hooks/myHook.test.ts --reporter=verbose --coverage.enabled=false

# Watch mode for TDD
npx vitest src/hooks/myHook.test.ts --coverage.enabled=false
```

## Checklist for Fixing Failing Tests

- [ ] Identify which contexts/stores the hook/component uses
- [ ] Create `vi.hoisted()` mock state for each dependency
- [ ] Add `vi.mock()` calls for ALL dependencies
- [ ] Ensure mock state includes ALL fields used by the hook
- [ ] Remove `vi.restoreAllMocks()` from `afterEach` (use `vi.clearAllMocks()` only)
- [ ] Run test and check for missing mock fields
- [ ] Add any missing fields to mock state
- [ ] Verify all tests in file pass

## Additional Resources

- [Vitest Mocking Docs](https://vitest.dev/guide/mocking.html)
- [Testing Library renderHook Docs](https://testing-library.com/docs/react-testing-library/api#renderhook)
- See existing working tests in: `src/hooks/useHotkeys.test.ts`, `src/components/ProgressBar.test.tsx`
