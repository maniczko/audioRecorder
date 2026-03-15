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
    peopleProfiles = [],
    userMeetings = [],
  } = props;

  const peopleOptions = [...new Set(peopleProfiles.map((p) => p.name).filter(Boolean))];
  const tagOptions = [...new Set(userMeetings.flatMap((m) => m.tags || []).filter(Boolean))];

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
        peopleOptions={peopleOptions}
        tagOptions={tagOptions}
      />

      <main className="workspace-main">
        <StudioMeetingView {...props} />
      </main>
    </div>
  );
}
