import { useMemo, useState, lazy, Suspense } from "react";
import ErrorBoundary from "./lib/ErrorBoundary";

import { useWorkspaceSelectors } from "./store/workspaceStore";
import { useAuthStore } from "./store/authStore";
import useMeetings from "./hooks/useMeetings";
import { useGoogleCtx } from "./context/GoogleContext";
import { useRecorderCtx } from "./context/RecorderContext";
import useUI from "./hooks/useUI";

const CalendarTab = lazy(() => import("./CalendarTab"));
const NotesTab = lazy(() => import("./NotesTab"));
const PeopleTab = lazy(() => import("./PeopleTab"));
const ProfileTab = lazy(() => import("./ProfileTab"));
const StudioTab = lazy(() => import("./StudioTab"));
const TasksTab = lazy(() => import("./TasksTab"));
const RecordingsTab = lazy(() => import("./RecordingsTab"));
const RagSearchTab = lazy(() => import("./RagSearchTab"));

function getActiveTabLabel(activeTab: string) {
  switch (activeTab) {
    case "calendar":
      return "Kalendarz";
    case "tasks":
      return "Zadania";
    case "notes":
      return "Notatki";
    case "people":
      return "Osoby";
    case "profile":
      return "Profil";
    case "recordings":
      return "Nagrania";
    case "ask-ai":
      return "Zapytaj AI";
    default:
      return "Studio";
  }
}

function buildAllTags(userMeetings: any[] = [], meetingTasks: any[] = []) {
  const tagMap = new Map<string, { tag: string; taskCount: number; meetingCount: number }>();

  (userMeetings || []).forEach((meeting) =>
    (meeting.tags || []).forEach((tag) => {
      const entry = tagMap.get(tag) || { tag, taskCount: 0, meetingCount: 0 };
      entry.meetingCount += 1;
      tagMap.set(tag, entry);
    })
  );

  (meetingTasks || []).forEach((task) =>
    (task.tags || []).forEach((tag) => {
      const entry = tagMap.get(tag) || { tag, taskCount: 0, meetingCount: 0 };
      entry.taskCount += 1;
      tagMap.set(tag, entry);
    })
  );

  return [...tagMap.values()].sort((left, right) => left.tag.localeCompare(right.tag));
}

export default function TabRouter({ calendarMonth, setCalendarMonth }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const meetings = useMeetings();
  const google = useGoogleCtx();
  const recorder = useRecorderCtx();
  const ui = useUI();

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

  const allTags = useMemo(
    () => buildAllTags(meetings.userMeetings, meetings.meetingTasks),
    [meetings.meetingTasks, meetings.userMeetings]
  );

  function renderActiveTab() {
    switch (ui.activeTab) {
      case "calendar":
        return (
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
            openTask={ui.openTask}
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
        );
      case "tasks":
        return (
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
        );
      case "notes":
        return (
          <NotesTab
            userMeetings={meetings.userMeetings}
            onOpenMeeting={ui.openMeetingFromCalendar}
            onCreateNote={meetings.createManualNote}
          />
        );
      case "people":
        return (
          <PeopleTab
            profiles={meetings.peopleProfiles}
            onOpenMeeting={ui.openMeetingFromCalendar}
            onOpenTask={ui.openTask}
            onCreateTask={ui.createTaskForPerson}
            onCreateMeeting={ui.createMeetingForPerson}
            onUpdatePersonNotes={meetings.updatePersonNotes}
            onAnalyzePersonProfile={meetings.analyzePersonPsychProfile}
            externalSelectedPersonId={ui.pendingPersonId}
            onPersonSelectionHandled={() => ui.setPendingPersonId("")}
          />
        );
      case "profile":
        return (
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
            onSetTheme={ui.setTheme}
            layoutPreset={ui.layoutPreset}
            onSetLayoutPreset={ui.setLayoutPreset}
            sessionToken={workspace.session?.token || ""}
            apiBaseUrl={import.meta.env.VITE_API_BASE_URL || ""}
            allTags={allTags}
            onRenameTag={meetings.renameTag}
            onDeleteTag={meetings.deleteTag}
            vocabulary={meetings.vocabulary}
            onUpdateVocabulary={meetings.setVocabulary}
            peopleProfiles={meetings.peopleProfiles}
            audioStorageState={recorder.audioStorageState}
            onRefreshAudioStorageState={recorder.refreshAudioStorageState}
            onDeleteStoredRecordingAudio={recorder.deleteStoredRecordingAudio}
          />
        );
      case "recordings":
        return (
          <RecordingsTab
            userMeetings={meetings.userMeetings}
            selectedMeetingId={meetings.selectedMeetingId}
            selectMeeting={meetings.selectMeeting}
            selectedMeeting={meetings.selectedMeeting}
            retryStoredRecording={meetings.retryStoredRecording}
            startNewMeetingDraft={meetings.startNewMeetingDraft}
            deleteRecordingAndMeeting={meetings.deleteRecordingAndMeeting}
            retryRecordingQueueItem={recorder.retryRecordingQueueItem}
            activeQueueItem={recorder.activeQueueItem}
            getRecordingStatus={recorder.getRecordingStatus}
            analysisStatus={recorder.analysisStatus}
            pipelineProgressPercent={recorder.pipelineProgressPercent}
            pipelineStageLabel={recorder.pipelineStageLabel}
            progressMessage={recorder.progressMessage}
            errorMessage={recorder.errorMessage}
            currentWorkspace={workspace.currentWorkspace}
            setActiveTab={ui.setActiveTab}
          />
        );

      case 'ask-ai':
        return <RagSearchTab currentWorkspace={workspace.currentWorkspace} />;
      default:
        return (
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
            onOpenTask={ui.openTask}
            onOpenPerson={ui.openPersonFromPalette}
            isRecording={recorder.isRecording}
            analysisStatus={recorder.analysisStatus}
            activeQueueItem={recorder.activeQueueItem}
            selectedMeetingQueue={recorder.selectedMeetingQueue}
            elapsed={recorder.elapsed}
            visualBars={recorder.visualBars}
            voiceActivityStatus={recorder.voiceActivityStatus}
            silenceCountdown={recorder.silenceCountdown}
            resetSilenceTimer={recorder.resetSilenceTimer}
            isPaused={recorder.isPaused}
            pauseRecording={recorder.pauseRecording}
            resumeRecording={recorder.resumeRecording}
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
            pipelineProgressPercent={recorder.pipelineProgressPercent}
            pipelineStageLabel={recorder.pipelineStageLabel}
            setRecordingMessage={recorder.setRecordingMessage}
            retryStoredRecording={recorder.retryStoredRecording}
            selectedRecording={meetings.selectedRecording}
            displaySpeakerNames={ui.displaySpeakerNames}
            selectedRecordingAudioUrl={ui.selectedRecordingAudioUrl}
            selectedRecordingAudioError={ui.selectedRecordingAudioError}
            selectedRecordingAudioStatus={ui.selectedRecordingAudioStatus}
            hydrateRecordingAudio={ui.hydrateRecordingAudio}
            clearAudioHydrationError={ui.clearAudioHydrationError}
            updateTranscriptSegment={meetings.updateTranscriptSegment}
            assignSpeakerToTranscriptSegments={meetings.assignSpeakerToTranscriptSegments}
            mergeTranscriptSegments={meetings.mergeTranscriptSegments}
            splitTranscriptSegment={meetings.splitTranscriptSegment}
            addRecordingMarker={meetings.addRecordingMarker}
            updateRecordingMarker={meetings.updateRecordingMarker}
            deleteRecordingMarker={meetings.deleteRecordingMarker}
            renameSpeaker={meetings.renameSpeaker}
            autoCreateVoiceProfile={meetings.autoCreateVoiceProfile}
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
            defaultToNewStudio={ui.tabHistory.length === 1}
            tagOptions={meetings.taskTags}
          />
        );
    }
  }

  return (
    <ErrorBoundary key={ui.activeTab} label={getActiveTabLabel(ui.activeTab)}>
      <Suspense fallback={<div className="tab-router-loading">Ładowanie ekranu...</div>}>
        {renderActiveTab()}
      </Suspense>
    </ErrorBoundary>
  );
}
