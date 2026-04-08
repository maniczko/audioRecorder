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
    updateMeeting: async () => {},
    createManualNote: async () => {},
    updateCalendarEntryMeta: async () => {},
    getCalendarEntryMeta: () => null,
    deleteRecordingAndMeeting: async () => {},
    normalizeRecording: async () => {},
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
    setWorkspaceMessage: () => {},
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
};

const MeetingsContext = createContext(defaultMeetingsCtx);

export function MeetingsProvider({ children }) {
  const meetings = useMeetings();

  return <MeetingsContext.Provider value={{ meetings }}>{children}</MeetingsContext.Provider>;
}

export function useMeetingsCtx() {
  return useContext(MeetingsContext);
}
