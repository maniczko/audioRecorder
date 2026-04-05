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
const mockIDBRequest = () => ({
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
});
const mockIDBTransaction = () => ({
  objectStore: vi.fn(() => ({
    get: vi.fn(() => mockIDBRequest()),
    put: vi.fn(() => mockIDBRequest()),
    delete: vi.fn(() => mockIDBRequest()),
    clear: vi.fn(() => mockIDBRequest()),
  })),
  oncomplete: null,
  onerror: null,
});
const mockIDBDatabase = () => ({
  transaction: vi.fn(() => mockIDBTransaction()),
  close: vi.fn(),
  objectStoreNames: { contains: vi.fn(() => true) },
});
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
vi.mock('react-virtuoso', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    Virtuoso: ({ data, itemContent, style }: any) => {
      return React.createElement(
        'div',
        { style },
        (data as any[]).map((item, index) =>
          React.createElement('div', { key: index }, itemContent(index, item))
        )
      );
    },
  };
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

// ── React Context mocks ──────────────────────────────────────────────
// Global mocks for context hooks so tests don't crash when providers
// are absent. Uses the @ alias which matches how modules are imported
// throughout the codebase. Individual test files can override with
// their own vi.mock calls if they need specific behavior.

// RecorderContext mock
const mockRecorderCtx = {
  isRecording: false,
  recordingMeetingId: null,
  currentSegments: [],
  audioUrls: {},
  audioHydrationErrors: {},
  audioHydrationStatusByRecordingId: {},
  hydrateRecordingAudio: vi.fn(),
  clearAudioHydrationError: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  pauseRecording: vi.fn(),
  resumeRecording: vi.fn(),
  retryRecording: vi.fn(),
  liveText: '',
  liveTranscriptEnabled: false,
  setLiveTranscriptEnabled: vi.fn(),
  recordPermission: 'prompt',
  speechRecognitionSupported: true,
  elapsed: 0,
  visualBars: new Array(20).fill(4),
  voiceActivityStatus: 'idle',
  silenceCountdown: null,
  resetSilenceTimer: vi.fn(),
  isPaused: false,
  analysisStatus: 'idle',
  activeQueueItem: null,
  selectedMeetingQueue: [],
  recordingMessage: '',
  pipelineProgressPercent: 0,
  pipelineStageLabel: '',
  setRecordingMessage: vi.fn(),
  retryRecordingQueueItem: vi.fn(),
  retryStoredRecording: vi.fn(),
  normalizeRecording: vi.fn(),
};

vi.mock('@/context/RecorderContext', () => ({
  RecorderProvider: ({ children }: any) => children,
  useRecorderCtx: () => mockRecorderCtx,
}));

// GoogleContext mock
const mockGoogleCtx = {
  googleEnabled: false,
  calendarEvents: [],
  upcomingReminders: [],
  googleCalendarEvents: [],
  resetGoogleSession: vi.fn(),
};

vi.mock('@/context/GoogleContext', () => ({
  GoogleProvider: ({ children }: any) => children,
  useGoogleCtx: () => mockGoogleCtx,
}));

// WorkspaceContext mock
const mockWorkspaceCtx = {
  currentUser: { id: 'test-user', name: 'Test User', email: 'test@test.com' },
  currentWorkspaceId: 'test-workspace',
  currentWorkspaceMembers: [],
  currentWorkspaceRole: 'admin',
  currentWorkspacePermissions: { canEditWorkspace: true, canRecordAudio: true },
  availableWorkspaces: [],
  switchWorkspace: vi.fn(),
  logout: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
};

vi.mock('@/context/WorkspaceContext', () => ({
  WorkspaceProvider: ({ children }: any) => children,
  useWorkspaceCtx: () => mockWorkspaceCtx,
}));

// MeetingsContext mock
const mockMeetingsCtx = {
  userMeetings: [],
  meetingTasks: [],
  peopleProfiles: [],
  selectedMeeting: null,
  selectedRecording: null,
  selectedRecordingId: '',
  setSelectedRecordingId: vi.fn(),
  taskNotifications: [],
  calendarMeta: {},
  selectMeeting: vi.fn(),
  startNewMeetingDraft: vi.fn(),
  syncLinkedGoogleCalendarEvents: vi.fn(),
  createTaskFromComposer: vi.fn(),
  resetSelectionState: vi.fn(),
  taskColumns: [],
  taskTags: [],
};

vi.mock('@/context/MeetingsContext', () => ({
  MeetingsProvider: ({ children }: any) => children,
  useMeetingsCtx: () => mockMeetingsCtx,
}));

// Store mocks
vi.mock('@/store/uiStore', () => ({
  useUIStore: vi.fn(() => ({
    activeTab: 'studio',
    setActiveTab: vi.fn(),
    commandPaletteOpen: false,
    setCommandPaletteOpen: vi.fn(),
    notificationState: { items: [], unreadCount: 0, dismissedIds: [] },
    notificationPermission: 'default',
    setNotificationCenterOpen: vi.fn(),
    dismissNotification: vi.fn(),
    deliverBrowserNotifications: vi.fn(),
    studioHomeSignal: false,
    triggerStudioHome: vi.fn(),
    setPendingTaskId: vi.fn(),
    setPendingPersonId: vi.fn(),
    tabHistory: [],
  })),
}));

vi.mock('@/store/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => mockWorkspaceCtx),
  useWorkspaceSelectors: vi.fn(() => mockWorkspaceCtx),
}));
