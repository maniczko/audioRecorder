import { createContext, useContext } from 'react';
import useMeetings from '../hooks/useMeetings';

const defaultMeetingsCtx = {
  meetings: {
    userMeetings: [],
    selectedMeeting: null,
    setSelectedMeeting: () => {},
    isHydratingRemoteState: false,
    createMeetingDirect: async () => {},
    deleteMeeting: async () => {},
    updateMeeting: async (..._args: any[]) => {},
    createManualNote: async () => {},
    updateCalendarEntryMeta: async (..._args: any[]) => {},
    getCalendarEntryMeta: () => null,
    deleteRecordingAndMeeting: async () => {},
    normalizeRecording: async (..._args: any[]) => {},
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
    setMeetings: () => {},
    setManualTasks: () => {},
    setTaskBoards: () => {},
    setTaskState: () => {},
    setCalendarMeta: () => {},
    setWorkspaceMessage: (..._args: any[]) => {},
    startNewMeetingDraft: () => {},
    clearMeetingDraft: () => {},
    selectMeeting: () => {},
    setSelectedMeetingId: () => {},
    setSelectedRecordingId: () => {},
    resetSelectionState: () => {},
    attachCompletedRecording: async () => {},
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
    syncLinkedGoogleCalendarEvents: async () => {},
    applyCalendarSyncSnapshot: () => {},
  },
} as unknown as { meetings: ReturnType<typeof useMeetings> };

const MeetingsContext = createContext(defaultMeetingsCtx);

export function MeetingsProvider({ children }) {
  const meetings = useMeetings();

  return <MeetingsContext.Provider value={{ meetings }}>{children}</MeetingsContext.Provider>;
}

export function useMeetingsCtx() {
  return useContext(MeetingsContext);
}
