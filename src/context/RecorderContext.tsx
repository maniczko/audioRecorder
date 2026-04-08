import { createContext, useContext } from 'react';
import useRecorder from '../hooks/useRecorder';
import useMeetings from '../hooks/useMeetings';

type RecorderContextValue = ReturnType<typeof useRecorder>;

const defaultRecorderCtx = {
  recordingState: null,
  startRecording: async () => {},
  stopRecording: () => {},
  pauseRecording: () => {},
  resumeRecording: () => {},
  deleteRecording: async () => {},
} as unknown as RecorderContextValue;

const RecorderContext = createContext<RecorderContextValue>(defaultRecorderCtx);

export function RecorderProvider({ children }) {
  const meetings = useMeetings();

  const recorder = useRecorder({
    selectedMeeting: meetings.selectedMeeting,
    userMeetings: meetings.userMeetings,
    createAdHocMeeting: meetings.createAdHocMeeting,
    attachCompletedRecording: meetings.attachCompletedRecording,
    isHydratingRemoteState: meetings.isHydratingRemoteState,
    selectMeeting: meetings.selectMeeting,
  });

  return <RecorderContext.Provider value={recorder}>{children}</RecorderContext.Provider>;
}

export function useRecorderCtx() {
  return useContext(RecorderContext);
}
