import { useMemo, useState } from "react";
import ErrorBoundary from "./lib/ErrorBoundary";
import CalendarTab from "./CalendarTab";
import NotesTab from "./NotesTab";
import PeopleTab from "./PeopleTab";
import ProfileTab from "./ProfileTab";
import StudioTab from "./StudioTab";
import TasksTab from "./TasksTab";
import RecordingsTab from "./RecordingsTab";
import { useWorkspaceCtx } from "./context/WorkspaceContext";
import { useMeetingsCtx } from "./context/MeetingsContext";
import { useGoogleCtx } from "./context/GoogleContext";
import { useRecorderCtx } from "./context/RecorderContext";
import { useUICtx } from "./context/UIContext";

export default function TabRouter({ calendarMonth, setCalendarMonth }) {
  const { workspace, auth } = useWorkspaceCtx();
  const { meetings } = useMeetingsCtx();
  const google = useGoogleCtx();
  const recorder = useRecorderCtx();
  const ui = useUICtx();

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

  const allTags = useMemo(() => {
    const tagMap = new Map();
    (meetings.userMeetings || []).forEach((m) =>
      (m.tags || []).forEach((t) => {
        const e = tagMap.get(t) || { tag: t, taskCount: 0, meetingCount: 0 };
        e.meetingCount += 1;
        tagMap.set(t, e);
      })
    );
    (meetings.meetingTasks || []).forEach((task) =>
      (task.tags || []).forEach((t) => {
        const e = tagMap.get(t) || { tag: t, taskCount: 0, meetingCount: 0 };
        e.taskCount += 1;
        tagMap.set(t, e);
      })
    );
    return [...tagMap.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  }, [meetings.userMeetings, meetings.meetingTasks]);

  return (
    <ErrorBoundary key={ui.activeTab} label={
      ui.activeTab === "calendar" ? "Kalendarz"
      : ui.activeTab === "tasks" ? "Zadania"
      : ui.activeTab === "notes" ? "Notatki"
      : ui.activeTab === "people" ? "Osoby"
      : ui.activeTab === "profile" ? "Profil"
      : "Studio"
    }>
    {ui.activeTab === "calendar" ? (
      <CalendarTab
        activeMonth={calendarMonth}
        setActiveMonth={setCalendarMonth}
        selectedDate={selectedCalendarDate}
        setSelectedDate={setSelectedCalendarDate}
        userMeetings={meetings.userMeetings}
        calendarTasks={ui.calendarTasks}
        googleCalendarEvents={google.googleCalendarEvents}
        googleCalendarStatus={google.googleCalendarStatus}
        googleCalendarMessage={google.googleCalendarMessage}
        connectGoogleCalendar={google.connectGoogleCalendar}
        disconnectGoogleCalendar={google.disconnectGoogleCalendar}
        syncCalendarEntryToGoogle={google.syncCalendarEntryToGoogle}
        rescheduleGoogleCalendarEntry={google.rescheduleGoogleCalendarEntry}
        openMeetingFromCalendar={ui.openMeetingFromCalendar}
        openGoogleCalendarForMeeting={ui.openGoogleCalendarForMeeting}
        openTaskFromCalendar={ui.openTaskFromCalendar}
        googleCalendarEnabled={google.googleEnabled}
        googleCalendarWritable={google.googleCalendarWritable}
        onRescheduleMeeting={meetings.rescheduleMeeting}
        onRescheduleTask={meetings.rescheduleTask}
        calendarMeta={meetings.calendarMeta}
        onUpdateCalendarEntryMeta={meetings.updateCalendarEntryMeta}
        onApplyCalendarSyncSnapshot={meetings.applyCalendarSyncSnapshot}
        workspaceMembers={workspace.currentWorkspaceMembers}
        peopleProfiles={meetings.peopleProfiles}
        currentUserTimezone={workspace.currentUser?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
        startNewMeetingDraft={meetings.startNewMeetingDraft}
        onNavigateToStudio={() => ui.setActiveTab("studio")}
        onCreateMeeting={meetings.createMeetingDirect}
      />
    ) : ui.activeTab === "tasks" ? (
      <TasksTab
        tasks={meetings.meetingTasks}
        peopleOptions={meetings.taskPeople}
        tagOptions={meetings.taskTags}
        boardColumns={meetings.taskColumns}
        onCreateTask={meetings.createTaskFromComposer}
        onUpdateTask={meetings.updateTask}
        onBulkUpdateTasks={meetings.bulkUpdateTasks}
        onDeleteTask={meetings.deleteTask}
        onBulkDeleteTasks={meetings.bulkDeleteTasks}
        onMoveTaskToColumn={meetings.moveTaskToColumn}
        onReorderTask={meetings.reorderTask}
        onCreateColumn={meetings.addTaskColumn}
        onUpdateColumn={meetings.changeTaskColumn}
        onDeleteColumn={meetings.removeTaskColumn}
        onOpenMeeting={ui.openMeetingFromCalendar}
        defaultView={workspace.currentUser.preferredTaskView || "list"}
        googleTasksEnabled={google.googleEnabled}
        googleTasksStatus={google.googleTasksStatus}
        googleTasksMessage={google.googleTasksMessage}
        googleTasksLastSyncedAt={google.googleTasksLastSyncedAt}
        googleTaskLists={google.googleTaskLists}
        selectedGoogleTaskListId={google.selectedGoogleTaskListId}
        onSelectGoogleTaskList={google.setSelectedGoogleTaskListId}
        onConnectGoogleTasks={google.connectGoogleTasks}
        onImportGoogleTasks={google.importGoogleTasksFromList}
        onExportGoogleTasks={google.exportTasksToGoogle}
        onRefreshGoogleTasks={google.refreshGoogleTasks}
        onResolveGoogleTaskConflict={google.resolveGoogleTaskConflict}
        workspaceName={workspace.currentWorkspace?.name || ""}
        workspaceInviteCode={workspace.currentWorkspace?.inviteCode || ""}
        externalSelectedTaskId={ui.pendingTaskId}
        onTaskSelectionHandled={() => ui.setPendingTaskId("")}
        currentUserName={workspace.currentUser?.name || workspace.currentUser?.email || "Ty"}
        taskNotifications={meetings.taskNotifications}
        workspaceActivity={meetings.workspaceActivity}
      />
    ) : ui.activeTab === "notes" ? (
      <NotesTab
        userMeetings={meetings.userMeetings}
        onOpenMeeting={ui.openMeetingFromCalendar}
        onCreateNote={meetings.createManualNote}
      />
    ) : ui.activeTab === "people" ? (
      <PeopleTab
        profiles={meetings.peopleProfiles}
        onOpenMeeting={ui.openMeetingFromCalendar}
        onOpenTask={ui.openTaskFromCalendar}
        onCreateTask={ui.createTaskForPerson}
        onCreateMeeting={ui.createMeetingForPerson}
        onUpdatePersonNotes={meetings.updatePersonNotes}
        onAnalyzePersonProfile={meetings.analyzePersonPsychProfile}
        externalSelectedPersonId={ui.pendingPersonId}
        onPersonSelectionHandled={() => ui.setPendingPersonId("")}
      />
    ) : ui.activeTab === "profile" ? (
      <ProfileTab
        currentUser={workspace.currentUser}
        profileDraft={auth.profileDraft}
        setProfileDraft={auth.setProfileDraft}
        saveProfile={auth.saveProfile}
        profileMessage={auth.profileMessage}
        googleEnabled={google.googleEnabled}
        googleCalendarStatus={google.googleCalendarStatus}
        googleCalendarMessage={google.googleCalendarMessage}
        googleCalendarEventsCount={google.googleCalendarEvents.length}
        googleCalendarLastSyncedAt={google.googleCalendarLastSyncedAt}
        connectGoogleCalendar={google.connectGoogleCalendar}
        disconnectGoogleCalendar={google.disconnectGoogleCalendar}
        refreshGoogleCalendar={google.refreshGoogleCalendar}
        passwordDraft={auth.passwordDraft}
        setPasswordDraft={auth.setPasswordDraft}
        updatePassword={auth.updatePassword}
        securityMessage={auth.securityMessage}
        onLogout={ui.logout}
        googleTasksEnabled={google.googleEnabled}
        googleTasksStatus={google.googleTasksStatus}
        googleTasksMessage={google.googleTasksMessage}
        googleTasksLastSyncedAt={google.googleTasksLastSyncedAt}
        googleTaskLists={google.googleTaskLists}
        selectedGoogleTaskListId={google.selectedGoogleTaskListId}
        onSelectGoogleTaskList={google.setSelectedGoogleTaskListId}
        onConnectGoogleTasks={google.connectGoogleTasks}
        onImportGoogleTasks={google.importGoogleTasksFromList}
        onExportGoogleTasks={google.exportTasksToGoogle}
        onRefreshGoogleTasks={google.refreshGoogleTasks}
        workspaceRole={workspace.currentWorkspaceRole}
        theme={ui.theme}
        onToggleTheme={() => ui.setTheme((t) => (t === "dark" ? "light" : "dark"))}
        sessionToken={workspace.session?.token || ""}
        apiBaseUrl={process.env.REACT_APP_API_BASE_URL || ""}
        allTags={allTags}
        onRenameTag={meetings.renameTag}
        onDeleteTag={meetings.deleteTag}
        vocabulary={meetings.vocabulary}
        onUpdateVocabulary={meetings.setVocabulary}
      />
    ) : ui.activeTab === "recordings" ? (
      <RecordingsTab
        userMeetings={meetings.userMeetings}
        selectedMeeting={meetings.selectedMeeting}
        selectMeeting={meetings.selectMeeting}
        startNewMeetingDraft={meetings.startNewMeetingDraft}
        selectedRecordingId={meetings.selectedRecordingId}
        setSelectedRecordingId={meetings.setSelectedRecordingId}
        setActiveTab={ui.setActiveTab}
      />
    ) : (
      <StudioTab
        currentUser={workspace.currentUser}
        currentWorkspace={workspace.currentWorkspace}
        currentWorkspaceMembers={workspace.currentWorkspaceMembers}
        currentWorkspaceRole={workspace.currentWorkspaceRole}
        currentWorkspacePermissions={workspace.currentWorkspacePermissions}
        updateWorkspaceMemberRole={workspace.updateWorkspaceMemberRole}
        setActiveTab={ui.setActiveTab}
        meetingDraft={meetings.meetingDraft}
        setMeetingDraft={meetings.setMeetingDraft}
        activeStoredMeetingDraft={meetings.activeStoredMeetingDraft}
        clearMeetingDraft={meetings.clearMeetingDraft}
        saveMeeting={meetings.saveMeeting}
        startNewMeetingDraft={meetings.startNewMeetingDraft}
        workspaceMessage={meetings.workspaceMessage}
        workspaceActivity={meetings.workspaceActivity}
        userMeetings={meetings.userMeetings}
        selectedMeetingId={meetings.selectedMeetingId}
        selectMeeting={meetings.selectMeeting}
        selectedMeeting={meetings.selectedMeeting}
        displayRecording={ui.displayRecording}
        studioAnalysis={ui.studioAnalysis}
        isRecording={recorder.isRecording}
        analysisStatus={recorder.analysisStatus}
        activeQueueItem={recorder.activeQueueItem}
        selectedMeetingQueue={recorder.selectedMeetingQueue}
        elapsed={recorder.elapsed}
        visualBars={recorder.visualBars}
        stopRecording={recorder.stopRecording}
        startRecording={recorder.startRecording}
        retryRecordingQueueItem={recorder.retryRecordingQueueItem}
        normalizeRecording={recorder.normalizeRecording}
        recordPermission={recorder.recordPermission}
        speechRecognitionSupported={recorder.speechRecognitionSupported}
        liveText={recorder.liveText}
        liveTranscriptEnabled={recorder.liveTranscriptEnabled}
        setLiveTranscriptEnabled={recorder.setLiveTranscriptEnabled}
        recordingMessage={recorder.recordingMessage}
        selectedRecording={meetings.selectedRecording}
        displaySpeakerNames={ui.displaySpeakerNames}
        selectedRecordingAudioUrl={ui.selectedRecordingAudioUrl}
        selectedRecordingAudioError={ui.selectedRecordingAudioError}
        updateTranscriptSegment={meetings.updateTranscriptSegment}
        assignSpeakerToTranscriptSegments={meetings.assignSpeakerToTranscriptSegments}
        mergeTranscriptSegments={meetings.mergeTranscriptSegments}
        splitTranscriptSegment={meetings.splitTranscriptSegment}
        addRecordingMarker={meetings.addRecordingMarker}
        updateRecordingMarker={meetings.updateRecordingMarker}
        deleteRecordingMarker={meetings.deleteRecordingMarker}
        renameSpeaker={meetings.renameSpeaker}
        selectedRecordingId={meetings.selectedRecordingId}
        setSelectedRecordingId={meetings.setSelectedRecordingId}
        exportTranscript={ui.exportTranscript}
        exportMeetingNotes={ui.exportMeetingNotes}
        exportMeetingPdfFile={ui.exportMeetingPdfFile}
        meetingTasks={meetings.meetingTasks}
        onCreateTask={meetings.createTaskFromComposer}
        peopleProfiles={meetings.peopleProfiles}
        setSelectedMeetingId={meetings.setSelectedMeetingId}
        isDetachedMeetingDraft={meetings.isDetachedMeetingDraft}
        addMeetingComment={meetings.addMeetingComment}
        currentUserName={workspace.currentUser?.name || workspace.currentUser?.email || "Ty"}
      />
    )}
    </ErrorBoundary>
  );
}
