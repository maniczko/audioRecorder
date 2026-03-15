import StudioMeetingView from "./studio/StudioMeetingView";
import StudioSidebar from "./studio/StudioSidebar";

export default function StudioTab(props) {
  const {
    currentWorkspaceMembers,
    currentWorkspacePermissions,
    meetingDraft,
    setMeetingDraft,
    activeStoredMeetingDraft,
    clearMeetingDraft,
    saveMeeting,
    startNewMeetingDraft,
    workspaceMessage,
    workspaceActivity,
    userMeetings,
    selectedMeetingId,
    selectMeeting,
    selectedMeeting,
    setSelectedMeetingId,
    setSelectedRecordingId,
  } = props;

  return (
    <div className="workspace-layout">
      <StudioSidebar
        currentWorkspaceMembers={currentWorkspaceMembers}
        currentWorkspacePermissions={currentWorkspacePermissions}
        meetingDraft={meetingDraft}
        setMeetingDraft={setMeetingDraft}
        activeStoredMeetingDraft={activeStoredMeetingDraft}
        clearMeetingDraft={clearMeetingDraft}
        saveMeeting={saveMeeting}
        startNewMeetingDraft={startNewMeetingDraft}
        workspaceMessage={workspaceMessage}
        workspaceActivity={workspaceActivity}
        userMeetings={userMeetings}
        selectedMeetingId={selectedMeetingId}
        selectMeeting={selectMeeting}
        selectedMeeting={selectedMeeting}
        setSelectedMeetingId={setSelectedMeetingId}
        setSelectedRecordingId={setSelectedRecordingId}
      />

      <main className="workspace-main">
        <StudioMeetingView {...props} />
      </main>
    </div>
  );
}
