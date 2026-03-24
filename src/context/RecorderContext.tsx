import { createContext, useContext } from "react";
import useRecorder from "../hooks/useRecorder";
import useMeetings from "../hooks/useMeetings";

const RecorderContext = createContext(null);

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

  return (
    <RecorderContext.Provider value={recorder}>
      {children}
    </RecorderContext.Provider>
  );
}

export function useRecorderCtx() {
  const ctx = useContext(RecorderContext);
  if (!ctx) {
    throw new Error("useRecorderCtx must be used within RecorderProvider");
  }
  return ctx;
}
