import { useState } from "react";
import StudioMeetingView from "./studio/StudioMeetingView";
import StudioSidebar from "./studio/StudioSidebar";
import { PageShell, SplitPane } from "./ui/LayoutPrimitives";

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

  const [briefOpen, setBriefOpen] = useState(false);

  const peopleOptions = [...new Set(peopleProfiles.map((p) => p.name).filter(Boolean))];
  const tagOptions = [...new Set(userMeetings.flatMap((m) => m.tags || []).filter(Boolean))];

  return (
    <PageShell className="studio-page-shell">
      <SplitPane
        className={briefOpen ? "workspace-layout" : "studio-layout"}
        sidebarWidth="wide"
        sidebar={briefOpen ? (
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
            userMeetings={userMeetings}
            selectMeeting={props.selectMeeting}
            selectedRecordingId={props.selectedRecordingId}
            setSelectedRecordingId={props.setSelectedRecordingId}
            onClose={() => setBriefOpen(false)}
          />
        ) : undefined}
        main={
          <main className={briefOpen ? "workspace-main" : ""} style={{ width: "100%" }}>
            <StudioMeetingView {...props} briefOpen={briefOpen} setBriefOpen={setBriefOpen} />
          </main>
        }
      />
    </PageShell>
  );
}
