import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { MeetingsProvider, useMeetingsCtx } from './MeetingsContext';

const mockMeetings = {
  userMeetings: [{ id: 'm1', title: 'Demo meeting' }],
  createAdHocMeeting: vi.fn(() => ({ id: 'm2' })),
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
};

vi.mock('../hooks/useMeetings', () => ({
  default: () => mockMeetings,
}));

describe('MeetingsContext', () => {
  test('provides meetings hook result to descendants', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MeetingsProvider>{children}</MeetingsProvider>
    );
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    expect(result.current.meetings).toBeDefined();
    expect(result.current.meetings.userMeetings).toBeDefined();
    expect(Array.isArray(result.current.meetings.userMeetings)).toBe(true);
    expect(result.current.meetings.selectedMeetingId).toBeDefined();
  });
});
