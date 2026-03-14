import StudioMeetingView from "./studio/StudioMeetingView";
import StudioSidebar from "./studio/StudioSidebar";

export default function StudioTab(props) {
  const {
    currentUser,
    currentWorkspace,
    currentWorkspaceMembers,
    setActiveTab,
    meetingDraft,
    setMeetingDraft,
    saveMeeting,
    workspaceMessage,
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
        currentUser={currentUser}
        currentWorkspace={currentWorkspace}
        currentWorkspaceMembers={currentWorkspaceMembers}
        setActiveTab={setActiveTab}
        meetingDraft={meetingDraft}
        setMeetingDraft={setMeetingDraft}
        saveMeeting={saveMeeting}
        workspaceMessage={workspaceMessage}
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
