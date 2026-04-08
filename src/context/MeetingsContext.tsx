import { createContext, useContext } from 'react';
import useMeetings from '../hooks/useMeetings';

// Default value matches what useMeetings() returns
const defaultMeetingsCtx = {
  userMeetings: [],
  selectedMeeting: null,
  setSelectedMeeting: () => { },
  isHydratingRemoteState: false,
  createMeetingDirect: async () => { },
  deleteMeeting: async () => { },
  updateMeeting: async () => { },
  createManualNote: async () => { },
  updateCalendarEntryMeta: async () => { },
  getCalendarEntryMeta: () => null,
  deleteRecordingAndMeeting: async () => { },
  normalizeRecording: async () => { },
} as unknown as ReturnType<typeof useMeetings>;

const MeetingsContext = createContext<ReturnType<typeof useMeetings>>(defaultMeetingsCtx);

export function MeetingsProvider({ children }) {
  const meetings = useMeetings();

  return <MeetingsContext.Provider value={meetings}>{children}</MeetingsContext.Provider>;
}

export function useMeetingsCtx() {
  return useContext(MeetingsContext);
}
