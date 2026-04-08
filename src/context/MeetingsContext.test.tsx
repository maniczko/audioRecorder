import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MeetingsProvider, useMeetingsCtx } from './MeetingsContext';

const mocks = vi.hoisted(() => ({
  meetings: {
    userMeetings: [{ id: 'm1', title: 'Demo meeting' }],
    createAdHocMeeting: () => ({ id: 'm2' }),
    selectedMeetingId: 'm1',
    selectedMeeting: { id: 'm1', title: 'Demo meeting' },
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
    createMeetingDirect: () => {},
    saveMeeting: () => {},
    updateMeeting: () => {},
    deleteMeeting: () => {},
    selectMeeting: () => {},
    setSelectedMeetingId: () => {},
    setSelectedRecordingId: () => {},
    resetSelectionState: () => {},
    setMeetingDraft: () => {},
    setMeetings: () => {},
    setManualTasks: () => {},
    setTaskBoards: () => {},
    setTaskState: () => {},
    setCalendarMeta: () => {},
    setWorkspaceMessage: () => {},
    startNewMeetingDraft: () => {},
    clearMeetingDraft: () => {},
    applyCalendarSyncSnapshot: () => {},
    updateCalendarEntryMeta: () => {},
    createManualNote: () => {},
    addMeetingComment: () => {},
    updatePersonNotes: () => {},
    analyzePersonPsychProfile: () => {},
    syncLinkedGoogleCalendarEvents: () => {},
    attachCompletedRecording: () => {},
    deleteRecordingAndMeeting: () => {},
    addRecordingMarker: () => {},
    updateRecordingMarker: () => {},
    deleteRecordingMarker: () => {},
    assignSpeakerToTranscriptSegments: () => {},
    renameSpeaker: () => {},
    mergeTranscriptSegments: () => {},
    splitTranscriptSegment: () => {},
    updateTranscriptSegment: () => {},
    updateTask: () => {},
    deleteTask: () => {},
    bulkUpdateTasks: () => {},
    bulkDeleteTasks: () => {},
    moveTaskToColumn: () => {},
    reorderTask: () => {},
    rescheduleTask: () => {},
    createTaskFromComposer: () => {},
    addTaskColumn: () => {},
    removeTaskColumn: () => {},
    changeTaskColumn: () => {},
    rescheduleMeeting: () => {},
    autoCreateVoiceProfile: () => {},
    renameTag: () => {},
    deleteTag: () => {},
  },
}));

vi.mock('../hooks/useMeetings', () => ({
  default: () => mocks.meetings,
}));

describe('MeetingsContext', () => {
  test('provides meetings hook result to descendants', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MeetingsProvider>{children}</MeetingsProvider>
    );
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    expect(result.current.meetings.userMeetings).toEqual([{ id: 'm1', title: 'Demo meeting' }]);
    expect(result.current.meetings.selectedMeetingId).toBe('m1');
    expect(result.current.meetings.selectedMeeting).toEqual({ id: 'm1', title: 'Demo meeting' });
  });

  test('exposes create and mutation methods that delegate to hook', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MeetingsProvider>{children}</MeetingsProvider>
    );
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    const created = result.current.meetings.createAdHocMeeting();
    expect(created).toEqual({ id: 'm2' });
    expect(mockMeetings.createAdHocMeeting).toHaveBeenCalledTimes(1);

    result.current.meetings.deleteMeeting('m1');
    expect(mockMeetings.deleteMeeting).toHaveBeenCalledWith('m1');

    result.current.meetings.updateMeeting('m1', { title: 'Updated' });
    expect(mockMeetings.updateMeeting).toHaveBeenCalledWith('m1', { title: 'Updated' });
  });

  test('returns safe defaults when useMeetingsCtx is called outside provider', () => {
    const { result } = renderHook(() => useMeetingsCtx());
    expect(result.current.meetings).toBeDefined();
    expect(result.current.meetings.userMeetings).toEqual([]);
    expect(result.current.meetings.selectedMeeting).toBeNull();
  });
});
