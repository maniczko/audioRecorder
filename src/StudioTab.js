import StudioMeetingView from "./studio/StudioMeetingView";
import StudioSidebar from "./studio/StudioSidebar";

export default function StudioTab(props) {
  const {
    currentWorkspacePermissions,
    meetingDraft,
    setMeetingDraft,
    activeStoredMeetingDraft,
    clearMeetingDraft,
    saveMeeting,
    startNewMeetingDraft,
    workspaceMessage,
    selectedMeeting,
    isDetachedMeetingDraft,
  } = props;

  return (
    <div className="workspace-layout">
      <StudioSidebar
        currentWorkspacePermissions={currentWorkspacePermissions}
        meetingDraft={meetingDraft}
        setMeetingDraft={setMeetingDraft}
        activeStoredMeetingDraft={activeStoredMeetingDraft}
        clearMeetingDraft={clearMeetingDraft}
        saveMeeting={saveMeeting}
        startNewMeetingDraft={startNewMeetingDraft}
        workspaceMessage={workspaceMessage}
        selectedMeeting={selectedMeeting}
        isDetachedMeetingDraft={isDetachedMeetingDraft}
      />

      <main className="workspace-main">
        <StudioMeetingView {...props} />
      </main>
    </div>
  );
}
