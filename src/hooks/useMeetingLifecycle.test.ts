import { vi, describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMeetingLifecycle from './useMeetingLifecycle';
import { createEmptyMeetingDraft } from '../lib/meeting';
import { STORAGE_KEYS } from '../lib/storage';

const { apiRequestMock, remoteApiEnabledMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  remoteApiEnabledMock: vi.fn(() => false),
}));

vi.mock('../services/httpClient', () => ({
  apiRequest: apiRequestMock,
}));

vi.mock('../services/config', () => ({
  remoteApiEnabled: () => remoteApiEnabledMock(),
}));

describe('useMeetingLifecycle', () => {
  const mockSetMeetings = vi.fn();
  const mockSetWorkspaceMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    remoteApiEnabledMock.mockReturnValue(false);
    localStorage.clear();
  });

  const baseProps = {
    currentUser: { id: 'u1', name: 'User' },
    currentUserId: 'u1',
    currentWorkspaceId: 'w1',
    currentWorkspaceMembers: [{ id: 'u1', name: 'User' }],
    userMeetings: [
      { id: 'm1', title: 'M1', recordings: [{ id: 'r1' }], latestRecordingId: 'r1' },
      { id: 'm2', title: 'M2', recordings: [] },
    ],
    setMeetings: mockSetMeetings,
    setWorkspaceMessage: mockSetWorkspaceMessage,
  };

  test('initialization and selecting meeting via derived state', () => {
    const { result } = renderHook((props) => useMeetingLifecycle(props), {
      initialProps: baseProps as any,
    });

    // Automatically selects the first meeting or handles detached drafts
    // In our implementation, it defaults to userMeetings[0] if none is selected
    expect(result.current.selectedMeetingId).toBe('m1');

    act(() => {
      result.current.selectMeeting(baseProps.userMeetings[1] as any);
    });

    expect(result.current.selectedMeetingId).toBe('m2');
    expect(result.current.selectedMeeting).toBeDefined();

    act(() => {
      result.current.setMeetingDraft({ title: 'Updated title' });
    });
    expect(result.current.meetingDraft.title).toBe('Updated title');
  });

  // -----------------------------------------------------------------
  // Issue #0 - Completed transcript hidden by a newer empty shell
  // Date: 2026-06-07
  // Bug: Studio could keep selecting latestRecordingId even when that
  //      recording was an empty processing shell and an older recording
  //      in the same meeting still had the completed transcript.
  // Fix: selected recording falls back to the richest readable recording
  //      only when the preferred recording has no transcript.
  // -----------------------------------------------------------------
  test('Regression: selects readable transcript recording over empty latest shell', () => {
    const props = {
      ...baseProps,
      userMeetings: [
        {
          id: 'meeting-allegro',
          title: 'Import: Allegro-rozmowa_2026-05-14',
          latestRecordingId: 'recording-empty-shell',
          recordings: [
            {
              id: 'recording-empty-shell',
              pipelineStatus: 'processing',
              transcript: [],
              duration: 3,
            },
            {
              id: 'recording-full-transcript',
              pipelineStatus: 'done',
              transcriptionStatus: 'done',
              audioAvailable: false,
              audioUnavailable: true,
              transcript: [{ id: 'seg-1', text: 'Transkrypt nie znika po aktualizacji.' }],
              duration: 5400,
            },
          ],
        },
      ],
    };

    const { result } = renderHook(() => useMeetingLifecycle(props as any));

    expect(result.current.selectedRecording?.id).toBe('recording-full-transcript');
    expect(result.current.selectedRecording?.transcript).toHaveLength(1);
  });

  // -----------------------------------------------------------------
  // Issue #0 - Completed remote transcript disappeared on second entry
  // Date: 2026-06-29
  // Bug: A reloaded recording with transcriptionStatus=completed but no
  //      local transcript skipped server hydration, so Studio showed an
  //      empty transcript panel even though the media asset had segments.
  // Fix: Empty completed recordings hydrate transcript segments from the
  //      server using either pipelineStatus or transcriptionStatus.
  // -----------------------------------------------------------------
  test('Regression: hydrates empty completed recording from server transcript status', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    apiRequestMock.mockResolvedValueOnce({
      recordingId: 'recording-reloaded',
      pipelineStatus: 'done',
      segments: [
        {
          id: 'seg-remote-1',
          speakerId: 'speaker-1',
          text: 'Transkrypcja wraca po ponownym wejsciu w nagranie.',
        },
      ],
      speakerNames: { 'speaker-1': 'Anna' },
      speakerCount: 1,
      confidence: 0.92,
    });

    const props = {
      ...baseProps,
      userMeetings: [
        {
          id: 'meeting-reloaded',
          title: 'Import: Nowe nagranie',
          latestRecordingId: 'recording-reloaded',
          recordings: [
            {
              id: 'recording-reloaded',
              transcriptionStatus: 'completed',
              transcript: [],
              duration: 120,
            },
          ],
        },
      ],
    };

    renderHook(() => useMeetingLifecycle(props as any));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/media/recordings/recording-reloaded/transcribe',
        {
          method: 'GET',
          retries: 2,
        }
      );
    });

    const transcriptUpdater = mockSetMeetings.mock.calls.find(
      ([candidate]) => typeof candidate === 'function'
    )?.[0] as ((meetings: any[]) => any[]) | undefined;

    expect(transcriptUpdater).toBeDefined();
    const nextMeetings = transcriptUpdater?.(props.userMeetings as any[]);
    const hydratedRecording = nextMeetings?.[0]?.recordings?.[0];
    expect(hydratedRecording?.transcript).toEqual([
      {
        id: 'seg-remote-1',
        speakerId: 'speaker-1',
        text: 'Transkrypcja wraca po ponownym wejsciu w nagranie.',
      },
    ]);
    expect(hydratedRecording?.speakerNames).toEqual({ 'speaker-1': 'Anna' });
  });

  test('startNewMeetingDraft & saveMeeting', () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));

    act(() => {
      result.current.startNewMeetingDraft({ title: 'Pre-filled' });
    });

    expect(result.current.isDetachedMeetingDraft).toBe(true);
    expect(result.current.meetingDraft.title).toBe('Pre-filled');

    act(() => {
      result.current.saveMeeting();
    });

    expect(mockSetMeetings).toHaveBeenCalled();
  });

  test('clearMeetingDraft', () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));

    act(() => {
      result.current.startNewMeetingDraft();
    });

    act(() => {
      result.current.clearMeetingDraft();
    });

    expect(result.current.isDetachedMeetingDraft).toBe(true);
  });

  test('createAdHocMeeting and createMeetingDirect', () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));

    let m1;
    act(() => {
      m1 = result.current.createAdHocMeeting();
    });
    expect(m1.title).toMatch(/Ad hoc/);
    expect(mockSetMeetings).toHaveBeenCalled();

    let m2;
    act(() => {
      m2 = result.current.createMeetingDirect(createEmptyMeetingDraft());
    });
    expect(m2).toBeDefined();
    expect(m2.workspaceId).toBe('w1');
  });

  test('E2E import guard can simulate a meeting without workspace', () => {
    const previousFlag = (import.meta as any).env.VITE_E2E_TEST;
    (import.meta as any).env.VITE_E2E_TEST = 'true';
    localStorage.setItem('voicelog.e2e.forceMissingImportWorkspace', 'true');

    try {
      const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));

      let meeting;
      act(() => {
        meeting = result.current.createMeetingDirect(createEmptyMeetingDraft());
      });

      expect(meeting).toBeDefined();
      expect(meeting.workspaceId).toBe('');
    } finally {
      (import.meta as any).env.VITE_E2E_TEST = previousFlag;
    }
  });

  test('syncing selected meeting to draft', () => {
    const { result } = renderHook((props) => useMeetingLifecycle(props), {
      initialProps: baseProps as any,
    });

    expect(result.current.selectedMeetingId).toBe('m1');
    expect(result.current.meetingDraft.title).toBe('M1');

    // Select different meeting
    act(() => {
      result.current.selectMeeting(baseProps.userMeetings[1] as any);
    });
    expect(result.current.selectedMeetingId).toBe('m2');
    expect(result.current.meetingDraft.title).toBe('M2');
  });

  test('handling detached draft from storage', () => {
    // Mock local storage draft for current workspace
    const storedDraft = {
      w1: {
        draft: { title: 'Cached title', durationMinutes: 120 },
        baselineDraft: { title: 'M1' },
        selectedMeetingId: 'm1',
        updatedAt: new Date().toISOString(),
      },
    };
    localStorage.setItem(STORAGE_KEYS.meetingDrafts, JSON.stringify(storedDraft));

    const { result } = renderHook((props) => useMeetingLifecycle(props), {
      initialProps: baseProps as any,
    });

    // It should RESTORE the cached title instead of M1
    expect(result.current.meetingDraft.title).toBe('Cached title');
    expect(result.current.selectedMeetingId).toBe('m1');
    expect(mockSetWorkspaceMessage).toHaveBeenCalledWith(expect.stringContaining('Przywrocono'));
  });

  test('resetSelectionState', () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));
    act(() => {
      result.current.resetSelectionState();
    });
    // It auto-selects m1 if userMeetings is not empty
    expect(result.current.selectedMeetingId).toBe('m1');
    expect(result.current.isDetachedMeetingDraft).toBe(false);
  });
});
