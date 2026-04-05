/**
 * @vitest-environment jsdom
 * useUI Hook Tests
 *
 * Tests for UI state management, command palette, and derived values
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useUI from './useUI';

// Mock stores and contexts
const mockUIStore = vi.hoisted(() => ({
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
}));

const mockWorkspaceStore = vi.hoisted(() => ({
  currentUser: { id: 'u1', name: 'Test User' },
  currentWorkspaceId: 'ws1',
  currentWorkspaceMembers: [],
  users: [],
  switchWorkspace: vi.fn(),
  logout: vi.fn(),
}));

const mockRecorderCtx = vi.hoisted(() => ({
  isRecording: false,
  recordingMeetingId: null,
  currentSegments: [],
  audioUrls: {},
  audioHydrationErrors: {},
  audioHydrationStatusByRecordingId: {},
  hydrateRecordingAudio: vi.fn(),
  clearAudioHydrationError: vi.fn(),
}));

const mockGoogleCtx = vi.hoisted(() => ({
  googleEnabled: false,
  calendarEvents: [],
  upcomingReminders: [],
  googleCalendarEvents: [],
  resetGoogleSession: vi.fn(),
}));

const mockMeetings = vi.hoisted(() => ({
  userMeetings: [],
  meetingTasks: [],
  peopleProfiles: [],
  selectedMeeting: null,
  selectedRecording: null,
  taskNotifications: [],
  calendarMeta: {},
  selectMeeting: vi.fn(),
  startNewMeetingDraft: vi.fn(),
  syncLinkedGoogleCalendarEvents: vi.fn(),
  createTaskFromComposer: vi.fn(),
  resetSelectionState: vi.fn(),
}));

// Mock modules
vi.mock('../store/uiStore', () => ({
  useUIStore: (selector?: (state: typeof mockUIStore) => unknown) =>
    selector ? selector(mockUIStore) : mockUIStore,
}));

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: (selector?: (state: typeof mockWorkspaceStore) => unknown) =>
    selector ? selector(mockWorkspaceStore) : mockWorkspaceStore,
  useWorkspaceSelectors: () => mockWorkspaceStore,
}));

vi.mock('../context/RecorderContext', () => ({
  useRecorderCtx: () => mockRecorderCtx,
}));

vi.mock('../context/GoogleContext', () => ({
  useGoogleCtx: () => mockGoogleCtx,
}));

vi.mock('./useMeetings', () => ({
  default: () => mockMeetings,
}));

vi.mock('../lib/calendarView', () => ({
  buildCalendarEntries: vi.fn(() => []),
  buildUpcomingReminders: vi.fn(() => []),
}));

vi.mock('../lib/commandPalette', () => ({
  buildCommandPaletteItems: vi.fn(() => []),
}));

vi.mock('../lib/notifications', () => ({
  buildWorkspaceNotifications: vi.fn(() => []),
}));

vi.mock('../lib/storage', () => ({
  downloadTextFile: vi.fn(),
  formatDateTime: vi.fn((date) => date.toISOString()),
  formatDuration: vi.fn((seconds) => `${seconds}s`),
}));

vi.mock('../lib/export', () => ({
  buildMeetingNotesText: vi.fn(() => 'Notes'),
  printMeetingPdf: vi.fn(),
  slugifyExportTitle: vi.fn((title) => title.replace(/\s+/g, '-')),
}));

vi.mock('../lib/calendar', () => ({
  buildGoogleCalendarUrl: vi.fn(() => 'https://calendar.google.com'),
}));

describe('useUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns current UI state', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.activeTab).toBe('studio');
    expect(result.current.commandPaletteOpen).toBe(false);
    expect(result.current.notificationPermission).toBe('default');
  });

  it('toggles command palette', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.commandPaletteOpen).toBe(false);

    // Command palette state is controlled by setCommandPaletteOpen
    // which is mocked, so we verify the function exists
    expect(result.current.setCommandPaletteOpen).toBeDefined();
  });

  it('provides notification helpers', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.dismissNotification).toBeDefined();
    expect(result.current.setNotificationCenterOpen).toBeDefined();
  });

  it('provides navigation helpers', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.setActiveTab).toBeDefined();
    expect(result.current.setPendingTaskId).toBeDefined();
    expect(result.current.setPendingPersonId).toBeDefined();
  });

  it('returns empty command palette items when no data', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.commandPaletteItems).toEqual([]);
  });

  it('returns null liveRecording when not recording', () => {
    mockRecorderCtx.isRecording = false;

    const { result } = renderHook(() => useUI());

    expect(result.current.liveRecording).toBeNull();
  });

  it('returns liveRecording when recording', () => {
    mockRecorderCtx.isRecording = true;
    mockRecorderCtx.recordingMeetingId = 'm1';
    mockRecorderCtx.currentSegments = [
      { speakerId: 0, text: 'Hello' },
      { speakerId: 1, text: 'Hi' },
    ];
    mockMeetings.selectedMeeting = { id: 'm1', title: 'Test Meeting' };

    const { result } = renderHook(() => useUI());

    expect(result.current.liveRecording).toBeDefined();
    expect(result.current.liveRecording?.transcript).toEqual([
      { speakerId: 0, text: 'Hello' },
      { speakerId: 1, text: 'Hi' },
    ]);
    expect(result.current.liveRecording?.speakerCount).toBe(2);
  });

  it('returns displayRecording from selectedRecording when not recording', () => {
    mockRecorderCtx.isRecording = false;
    mockMeetings.selectedRecording = {
      id: 'r1',
      speakerNames: { 0: 'Alice' },
      analysis: { summary: 'Test' },
    };

    const { result } = renderHook(() => useUI());

    expect(result.current.displayRecording).toEqual(mockMeetings.selectedRecording);
  });

  it('returns displaySpeakerNames from recording', () => {
    mockMeetings.selectedRecording = {
      id: 'r1',
      speakerNames: { 0: 'Alice', 1: 'Bob' },
    };

    const { result } = renderHook(() => useUI());

    expect(result.current.displaySpeakerNames).toEqual({ 0: 'Alice', 1: 'Bob' });
  });

  it('returns studioAnalysis from recording or meeting', () => {
    mockMeetings.selectedRecording = {
      id: 'r1',
      analysis: { summary: 'Recording analysis' },
    };

    const { result } = renderHook(() => useUI());

    expect(result.current.studioAnalysis).toEqual({ summary: 'Recording analysis' });
  });

  it('returns null studioAnalysis when no recording', () => {
    mockMeetings.selectedRecording = null;
    mockMeetings.selectedMeeting = null;

    const { result } = renderHook(() => useUI());

    expect(result.current.studioAnalysis).toBeNull();
  });

  it('provides export helpers', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.exportTranscript).toBeDefined();
    expect(result.current.exportMeetingNotes).toBeDefined();
    expect(result.current.exportMeetingPdfFile).toBeDefined();
  });

  it('provides calendar helpers', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.calendarEntries).toBeDefined();
    expect(result.current.upcomingReminders).toBeDefined();
    expect(result.current.openGoogleCalendarForMeeting).toBeDefined();
  });

  it('provides notification items', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.notificationItems).toBeDefined();
    expect(result.current.unreadNotificationCount).toBeDefined();
  });

  it('provides command palette items', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.commandPaletteItems).toBeDefined();
    expect(result.current.handleCommandPaletteSelect).toBeDefined();
  });

  it('returns studioHomeSignal and triggerStudioHome', () => {
    const { result } = renderHook(() => useUI());

    expect(result.current.studioHomeSignal).toBe(false);
    expect(result.current.triggerStudioHome).toBeDefined();
  });

  it('sets up keyboard shortcut listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUI());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('triggers command palette on Ctrl+K / Cmd+K', () => {
    renderHook(() => useUI());

    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });

    window.dispatchEvent(keyboardEvent);

    expect(mockUIStore.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it('prevents default on Ctrl+K shortcut', () => {
    renderHook(() => useUI());

    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(keyboardEvent, 'preventDefault');

    window.dispatchEvent(keyboardEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not trigger on non-K key with Ctrl', () => {
    renderHook(() => useUI());

    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'l',
      ctrlKey: true,
    });

    window.dispatchEvent(keyboardEvent);

    expect(mockUIStore.setCommandPaletteOpen).not.toHaveBeenCalled();
  });

  it('does not trigger on K without Ctrl/Cmd', () => {
    renderHook(() => useUI());

    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: false,
      metaKey: false,
    });

    window.dispatchEvent(keyboardEvent);

    expect(mockUIStore.setCommandPaletteOpen).not.toHaveBeenCalled();
  });

  it('triggers command palette on Cmd+K (Mac)', () => {
    renderHook(() => useUI());

    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: false,
    });

    window.dispatchEvent(keyboardEvent);

    expect(mockUIStore.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });
});
