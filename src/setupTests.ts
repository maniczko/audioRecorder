import React from 'react';
import '@testing-library/jest-dom';
import { vi, afterEach, type Mock } from 'vitest';
import { cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync(path.resolve(process.cwd(), 'coverage/frontend/.tmp'), { recursive: true });

// ── Global mocks BEFORE any imports ──────────────────────────────────

// ── fetch mock ───────────────────────────────────────────────────────
// Global fetch mock to prevent network errors during tests.
// Individual tests can override with vi.spyOn or vi.mocked.
const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
  })
) as Mock;
global.fetch = fetchMock;

// ── localStorage / sessionStorage mock ───────────────────────────────
const mockStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const k in store) delete store[k];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};
const mockLocalStorage = mockStorage();
const mockSessionStorage = mockStorage();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true });

// ── matchMedia mock ──────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── ResizeObserver mock ──────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── IntersectionObserver mock ────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── BroadcastChannel mock ────────────────────────────────────────────
global.BroadcastChannel = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// ── navigator.mediaDevices mock ──────────────────────────────────────
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn(() => [{ stop: vi.fn(), getSettings: vi.fn(() => ({})) }]),
    }),
    enumerateDevices: vi
      .fn()
      .mockResolvedValue([{ deviceId: 'default', kind: 'audioinput', label: 'Default Mic' }]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

// ── crypto mock (for uuid/random) ────────────────────────────────────
if (!crypto.getRandomValues) {
  Object.defineProperty(global, 'crypto', {
    value: { getRandomValues: vi.fn((arr: Uint8Array) => arr) },
    writable: true,
  });
}

// ── IndexedDB mock (for idb-keyval) ──────────────────────────────────
const mockIDBOpenDBRequest = () => ({
  result: null,
  error: null,
  onupgradeneeded: null,
  onsuccess: null,
  onerror: null,
});
global.indexedDB = {
  open: vi.fn(() => mockIDBOpenDBRequest()),
  deleteDatabase: vi.fn(() => mockIDBOpenDBRequest()),
} as any;

// ── window.print mock ────────────────────────────────────────────────
window.print = vi.fn();

// ── window.postMessage mock ──────────────────────────────────────────
window.postMessage = vi.fn();

// ── URL.createObjectURL / revokeObjectURL ────────────────────────────
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

// ── Global cleanup after each test ───────────────────────────────────
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.clearAllMocks();
  // Reset fetch mock to default resolved state
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
  });
  // Clear storage between tests
  mockLocalStorage.clear();
  mockSessionStorage.clear();
});

// ── Canvas mock ──────────────────────────────────────────────────────
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  stroke: vi.fn(),
})) as Mock;

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ── react-virtuoso mock ──────────────────────────────────────────────
vi.mock('react-virtuoso', () => {
  const Virtuoso = React.forwardRef<any, any>(
    ({ data = [], itemContent, style, className }, ref) => {
      React.useImperativeHandle(ref, () => ({
        scrollToIndex: vi.fn(),
        scrollTo: vi.fn(),
        scrollIntoView: vi.fn(),
      }));

      return React.createElement(
        'div',
        { style, className },
        (data as any[]).map((item, index) =>
          React.createElement('div', { key: item?.id ?? index }, itemContent(index, item))
        )
      );
    }
  );
  Virtuoso.displayName = 'MockVirtuoso';

  return { Virtuoso };
});

// ── Global useToast mock ─────────────────────────────────────────────
vi.mock('./shared/Toast', async (importOriginal) => {
  const actual = await importOriginal();
  const noopToast = {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
  return {
    ...(actual as object),
    useToast: () => noopToast,
  };
});

// ── Global hooks mock ────────────────────────────────────────────────
// Mock complex hooks that have many dependencies to simplify component testing
const hooksMocks = vi.hoisted(() => ({
  useMeetings: vi.fn(() => ({
    userMeetings: [],
    selectedMeeting: null,
    selectedMeetingId: null,
    selectedRecordingId: null,
    selectedRecording: null,
    isDetachedMeetingDraft: false,
    activeStoredMeetingDraft: null,
    meetingDraft: null,
    taskBoards: {},
    taskState: {},
    manualTasks: [],
    meetingTasks: [],
    calendarMeta: {},
    peopleProfiles: [],
    personNotes: {},
    taskColumns: [],
    taskPeople: [],
    taskTags: [],
    taskNotifications: [],
    workspaceActivity: [],
    workspaceMessage: '',
    isHydratingRemoteState: false,
    createMeetingDirect: vi.fn(),
    saveMeeting: vi.fn(),
    updateMeeting: vi.fn(),
    deleteMeeting: vi.fn(),
    selectMeeting: vi.fn(),
    setSelectedMeetingId: vi.fn(),
    setSelectedRecordingId: vi.fn(),
    resetSelectionState: vi.fn(),
    setMeetingDraft: vi.fn(),
    setMeetings: vi.fn(),
    setManualTasks: vi.fn(),
    setTaskBoards: vi.fn(),
    setTaskState: vi.fn(),
    setCalendarMeta: vi.fn(),
    setWorkspaceMessage: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    clearMeetingDraft: vi.fn(),
    applyCalendarSyncSnapshot: vi.fn(),
    updateCalendarEntryMeta: vi.fn(),
    createManualNote: vi.fn(),
    addMeetingComment: vi.fn(),
    updatePersonNotes: vi.fn(),
    analyzePersonPsychProfile: vi.fn(),
    syncLinkedGoogleCalendarEvents: vi.fn(),
    attachCompletedRecording: vi.fn(),
    deleteRecordingAndMeeting: vi.fn(),
    addRecordingMarker: vi.fn(),
    updateRecordingMarker: vi.fn(),
    deleteRecordingMarker: vi.fn(),
    assignSpeakerToTranscriptSegments: vi.fn(),
    renameSpeaker: vi.fn(),
    mergeTranscriptSegments: vi.fn(),
    splitTranscriptSegment: vi.fn(),
    updateTranscriptSegment: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    bulkUpdateTasks: vi.fn(),
    bulkDeleteTasks: vi.fn(),
    moveTaskToColumn: vi.fn(),
    reorderTask: vi.fn(),
    rescheduleTask: vi.fn(),
    createTaskFromComposer: vi.fn(),
    addTaskColumn: vi.fn(),
    removeTaskColumn: vi.fn(),
    changeTaskColumn: vi.fn(),
    rescheduleMeeting: vi.fn(),
    autoCreateVoiceProfile: vi.fn(),
    renameTag: vi.fn(),
    deleteTag: vi.fn(),
    createAdHocMeeting: vi.fn(() => ({ id: 'mock-meeting' })),
    pauseRemotePull: vi.fn(),
  })),
}));

vi.mock('@/hooks/useMeetings', () => ({
  default: hooksMocks.useMeetings,
}));

// Also mock with relative path for tests that use relative imports
vi.mock('./hooks/useMeetings', () => ({
  default: hooksMocks.useMeetings,
}));

// Mock workspaceStore to prevent store-related test failures
vi.mock('./store/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    users: [],
    workspaces: [],
    session: null,
    vocabulary: [],
    setUsers: vi.fn(),
    setWorkspaces: vi.fn(),
    setSession: vi.fn(),
    setVocabulary: vi.fn(),
    switchWorkspace: vi.fn(),
    updateWorkspaceMemberRole: vi.fn(),
    removeWorkspaceMember: vi.fn(),
    logout: vi.fn(),
  })),
  useWorkspaceSelectors: vi.fn(() => ({
    currentUser: null,
    currentUserId: '',
    currentWorkspace: null,
    currentWorkspaceId: '',
    currentWorkspaceMembers: [],
    currentWorkspaceRole: 'member',
    currentWorkspacePermissions: {
      role: 'member',
      canRecordAudio: true,
      canEditWorkspace: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: false,
      canDeleteWorkspaceItems: false,
    },
    isHydratingSession: false,
    availableWorkspaces: [],
  })),
}));

// Mock meetingsStore
vi.mock('./store/meetingsStore', () => ({
  useMeetingsStore: vi.fn(() => ({
    userMeetings: [],
    manualTasks: [],
    taskState: {},
    taskBoards: {},
    calendarMeta: {},
    vocabulary: [],
    workspaceMessage: '',
    setMeetings: vi.fn(),
    setManualTasks: vi.fn(),
    setTaskState: vi.fn(),
    setTaskBoards: vi.fn(),
    setCalendarMeta: vi.fn(),
    setWorkspaceMessage: vi.fn(),
  })),
}));

// Mock authStore
vi.mock('./store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    session: null,
    authError: null,
    googleAuthMessage: '',
    microsoftAuthMessage: '',
    setSession: vi.fn(),
    setAuthError: vi.fn(),
    setGoogleAuthMessage: vi.fn(),
    setMicrosoftAuthMessage: vi.fn(),
    submitAuth: vi.fn(),
    logout: vi.fn(),
    requestResetCode: vi.fn(),
    completeReset: vi.fn(),
    handleGoogleProfile: vi.fn(),
    handleMicrosoftProfile: vi.fn(),
    saveProfile: vi.fn(),
    updatePassword: vi.fn(),
  })),
}));

// Mock recorderStore
vi.mock('./store/recorderStore', () => ({
  useRecorderStore: vi.fn(() => ({
    recordingQueue: [],
    analysisStatus: 'idle',
    recordingMessage: '',
    pipelineProgressPercent: 0,
    pipelineStageLabel: '',
    isProcessingQueue: false,
    lastQueueErrorKey: '',
    retryRecordingQueueItem: vi.fn(),
    retryStoredRecording: vi.fn(),
    processQueue: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
    setAnalysisStatus: vi.fn(),
    setPipelineProgress: vi.fn(),
    setRecordingMessage: vi.fn(),
    setRecordingQueue: vi.fn(),
  })),
}));

// Mock uiStore
vi.mock('./store/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    isCommandPaletteOpen: false,
    isSettingsOpen: false,
    activeTab: 'calendar',
    calendarView: 'month',
    selectedDate: null,
    notifications: [],
    liveRecording: null,
    toggleCommandPalette: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    setActiveTab: vi.fn(),
    setCalendarView: vi.fn(),
    setSelectedDate: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    clearNotifications: vi.fn(),
  })),
}));

// ── Service Worker mock ──────────────────────────────────────────────
if (!navigator.serviceWorker) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistrations: vi.fn().mockResolvedValue([]),
      register: vi.fn().mockResolvedValue({}),
      ready: Promise.resolve({ active: null }),
    },
    writable: true,
  });
} else if (!navigator.serviceWorker.getRegistrations) {
  (navigator.serviceWorker as any).getRegistrations = vi.fn().mockResolvedValue([]);
}

// ── idb-keyval mock ──────────────────────────────────────────────────
// Many store tests use idb-keyval for persistence.
// Mock the entire module to use in-memory storage.
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  keys: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockResolvedValue(undefined),
}));

// ── Test Helper Utilities ────────────────────────────────────────────
// These utilities help prevent common test issues:
// - act() warnings from React 19
// - Timer deadlocks with fakeTimers
// - State update race conditions

/**
 * Waits for all pending promises and microtasks to settle.
 * Use this instead of manual waitFor when you just need to flush the queue.
 *
 * Example:
 * ```ts
 * await act(async () => {
 *   hook.result.current.someAction();
 * });
 * await flushMicrotasks();
 * expect(hook.result.current.state).toBe(expected);
 * ```
 */
export async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
}

/**
 * Safely enables fake timers with automatic cleanup.
 * Prevents the common issue where timers aren't restored after tests.
 *
 * Example:
 * ```ts
 * describe('my test', () => {
 *   const { advanceTime } = useFakeTimersSafely();
 *
 *   it('does something with timers', () => {
 *     advanceTime(5000);
 *     expect(something).toBe(expected);
 *   });
 * });
 * ```
 */
export function useFakeTimersSafely() {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    /** Advance timers by specified milliseconds */
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    /** Run all pending timers */
    runAllTimers: () => vi.runAllTimers(),
    /** Run only timers that were scheduled before this call */
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
  };
}

/**
 * Mock implementation helper that creates consistent store mocks.
 * Prevents issues where individual test mocks miss required fields.
 *
 * Example:
 * ```ts
 * const mockStore = createMockStore({
 *   someField: 'value',
 *   someAction: vi.fn(),
 * });
 * ```
 */
export function createMockStore<T extends Record<string, any>>(
  overrides: Partial<T>,
  defaults: T
): T {
  return {
    ...defaults,
    ...overrides,
  };
}
