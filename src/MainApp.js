import { useMemo, useState } from "react";
import "./App.css";
import AuthScreen from "./AuthScreen";
import CalendarTab from "./CalendarTab";
import PeopleTab from "./PeopleTab";
import ProfileTab from "./ProfileTab";
import StudioTab from "./StudioTab";
import TasksTab from "./TasksTab";
import useAuth from "./hooks/useAuth";
import useGoogleIntegrations from "./hooks/useGoogleIntegrations";
import useMeetings from "./hooks/useMeetings";
import useRecorder from "./hooks/useRecorder";
import useWorkspace from "./hooks/useWorkspace";
import { buildGoogleCalendarUrl } from "./lib/calendar";
import { buildMonthMatrix, groupMeetingsByDay } from "./lib/calendarView";
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from "./lib/export";
import { downloadTextFile, formatDateTime, formatDuration } from "./lib/storage";

export default function MainApp() {
  const workspace = useWorkspace();
  const auth = useAuth({
    currentUser: workspace.currentUser,
    users: workspace.users,
    setUsers: workspace.setUsers,
    workspaces: workspace.workspaces,
    setWorkspaces: workspace.setWorkspaces,
    setSession: workspace.setSession,
  });
  const meetings = useMeetings({
    users: workspace.users,
    setUsers: workspace.setUsers,
    workspaces: workspace.workspaces,
    setWorkspaces: workspace.setWorkspaces,
    session: workspace.session,
    setSession: workspace.setSession,
    currentUser: workspace.currentUser,
    currentUserId: workspace.currentUserId,
    currentWorkspaceId: workspace.currentWorkspaceId,
    currentWorkspaceMembers: workspace.currentWorkspaceMembers,
  });
  const recorder = useRecorder({
    selectedMeeting: meetings.selectedMeeting,
    userMeetings: meetings.userMeetings,
    createAdHocMeeting: meetings.createAdHocMeeting,
    attachCompletedRecording: meetings.attachCompletedRecording,
  });

  const [activeTab, setActiveTab] = useState("studio");
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [pendingTaskId, setPendingTaskId] = useState("");

  const google = useGoogleIntegrations({
    currentUser: workspace.currentUser,
    currentWorkspaceId: workspace.currentWorkspaceId,
    calendarMonth,
    taskColumns: meetings.taskColumns,
    meetingTasks: meetings.meetingTasks,
    setManualTasks: meetings.setManualTasks,
    onGoogleProfile: auth.handleGoogleProfile,
    onGoogleError: auth.setGoogleAuthMessage,
  });

  const liveRecording =
    recorder.isRecording && recorder.recordingMeetingId === meetings.selectedMeeting?.id
      ? {
          transcript: recorder.currentSegments,
          speakerNames: {},
          speakerCount: new Set(recorder.currentSegments.map((segment) => segment.speakerId || 0)).size,
          analysis: null,
        }
      : null;
  const displayRecording = liveRecording || meetings.selectedRecording;
  const displaySpeakerNames = displayRecording?.speakerNames || meetings.selectedMeeting?.speakerNames || {};
  const studioAnalysis = meetings.selectedRecording?.analysis || meetings.selectedMeeting?.analysis || null;
  const selectedRecordingAudioUrl = meetings.selectedRecording
    ? recorder.audioUrls[meetings.selectedRecording.id]
    : "";
  const calendarTasks = useMemo(
    () => meetings.meetingTasks.filter((task) => Boolean(task.dueDate)),
    [meetings.meetingTasks]
  );

  const bucket = useMemo(
    () => groupMeetingsByDay(meetings.userMeetings, google.googleCalendarEvents, calendarTasks),
    [calendarTasks, google.googleCalendarEvents, meetings.userMeetings]
  );
  const monthMatrix = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth]);
  const miniMatrix = useMemo(() => buildMonthMatrix(calendarMonth), [calendarMonth]);

  function exportTranscript() {
    if (!displayRecording) {
      return;
    }

    downloadTextFile(
      `${slugifyExportTitle(meetings.selectedMeeting?.title)}-transcript.txt`,
      displayRecording.transcript
        .map(
          (segment) =>
            `[${formatDuration(segment.timestamp)}] ${displaySpeakerNames[String(segment.speakerId)] || `Speaker ${
              Number(segment.speakerId) + 1
            }`}: ${segment.text}`
        )
        .join("\n")
    );
  }

  function exportMeetingNotes() {
    if (!meetings.selectedMeeting) {
      return;
    }

    downloadTextFile(
      `${slugifyExportTitle(meetings.selectedMeeting.title)}-notes.txt`,
      buildMeetingNotesText(meetings.selectedMeeting, studioAnalysis, formatDateTime)
    );
  }

  function exportMeetingPdfFile() {
    if (!meetings.selectedMeeting) {
      return;
    }

    printMeetingPdf(meetings.selectedMeeting, displayRecording, displaySpeakerNames, formatDateTime, formatDuration);
  }

  function openMeetingFromCalendar(meetingId) {
    const meeting = meetings.userMeetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return;
    }

    meetings.selectMeeting(meeting);
    setActiveTab("studio");
  }

  function openGoogleCalendarForMeeting(meetingId) {
    const meeting = meetings.userMeetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return;
    }

    window.open(buildGoogleCalendarUrl(meeting), "_blank", "noopener,noreferrer");
  }

  function openTaskFromCalendar(taskId) {
    setPendingTaskId(taskId);
    setActiveTab("tasks");
  }

  function switchWorkspace(workspaceId) {
    workspace.switchWorkspace(workspaceId);
    meetings.resetSelectionState();
    google.resetGoogleSession();
    setPendingTaskId("");
  }

  function logout() {
    if (recorder.isRecording) {
      recorder.stopRecording();
    }

    workspace.setSession(null);
    meetings.resetSelectionState();
    google.resetGoogleSession();
    recorder.resetRecorderState();
    setActiveTab("studio");
    setPendingTaskId("");
  }

  if (!workspace.currentUser) {
    return (
      <AuthScreen
        authMode={auth.authMode}
        authDraft={auth.authDraft}
        authError={auth.authError}
        setAuthMode={auth.setAuthMode}
        setAuthDraft={auth.setAuthDraft}
        submitAuth={auth.submitAuth}
        googleEnabled={google.googleEnabled}
        googleButtonRef={google.googleButtonRef}
        googleAuthMessage={auth.googleAuthMessage}
        resetDraft={auth.resetDraft}
        setResetDraft={auth.setResetDraft}
        resetMessage={auth.resetMessage}
        resetPreviewCode={auth.resetPreviewCode}
        resetExpiresAt={auth.resetExpiresAt}
        requestResetCode={auth.requestResetCode}
        completeReset={auth.completeReset}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <header className="topbar">
        <div className="topbar-title">
          <div>
            <div className="eyebrow">VoiceLog OS</div>
            <h1>Meeting intelligence studio</h1>
          </div>
          <div className="tab-switcher">
            <button type="button" className={activeTab === "studio" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("studio")}>
              Studio
            </button>
            <button type="button" className={activeTab === "calendar" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("calendar")}>
              Kalendarz
            </button>
            <button type="button" className={activeTab === "tasks" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("tasks")}>
              Zadania
            </button>
            <button type="button" className={activeTab === "people" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("people")}>
              Osoby
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="status-chip">
            {recorder.speechRecognitionSupported ? "Live transcript ready" : "Remote transcript required"}
          </div>
          <div className="status-chip">{google.googleEnabled ? "Google ready" : "Google env missing"}</div>
          {workspace.availableWorkspaces.length > 1 ? (
            <label className="workspace-switch">
              <span>Workspace</span>
              <select value={workspace.currentWorkspaceId || ""} onChange={(event) => switchWorkspace(event.target.value)}>
                {workspace.availableWorkspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : workspace.currentWorkspace ? (
            <div className="status-chip">{workspace.currentWorkspace.name}</div>
          ) : null}
          <div className="user-card">
            {workspace.currentUser.avatarUrl ? (
              <img src={workspace.currentUser.avatarUrl} alt={workspace.currentUser.name} className="avatar" />
            ) : null}
            <div>
              <strong>{workspace.currentUser.name}</strong>
              <span>
                {workspace.currentUser.role || "No role"}
                {workspace.currentUser.provider === "google" ? " - Google sign-in" : ""}
              </span>
            </div>
            <button type="button" className="settings-button" aria-label="Otworz ustawienia" onClick={() => setActiveTab("profile")}>
              {"\u2699"}
            </button>
            <button type="button" className="ghost-button" onClick={logout}>
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      {activeTab === "calendar" ? (
        <CalendarTab
          activeMonth={calendarMonth}
          setActiveMonth={setCalendarMonth}
          selectedDate={selectedCalendarDate}
          setSelectedDate={setSelectedCalendarDate}
          monthMatrix={monthMatrix}
          miniMatrix={miniMatrix}
          bucket={bucket}
          userMeetings={meetings.userMeetings}
          calendarTasks={calendarTasks}
          googleCalendarEvents={google.googleCalendarEvents}
          googleCalendarStatus={google.googleCalendarStatus}
          googleCalendarMessage={google.googleCalendarMessage}
          connectGoogleCalendar={google.connectGoogleCalendar}
          disconnectGoogleCalendar={google.disconnectGoogleCalendar}
          openMeetingFromCalendar={openMeetingFromCalendar}
          openGoogleCalendarForMeeting={openGoogleCalendarForMeeting}
          openTaskFromCalendar={openTaskFromCalendar}
          googleCalendarEnabled={google.googleEnabled}
        />
      ) : activeTab === "tasks" ? (
        <TasksTab
          tasks={meetings.meetingTasks}
          peopleOptions={meetings.taskPeople}
          tagOptions={meetings.taskTags}
          boardColumns={meetings.taskColumns}
          onCreateTask={meetings.createTaskFromComposer}
          onUpdateTask={meetings.updateTask}
          onDeleteTask={meetings.deleteTask}
          onMoveTaskToColumn={meetings.moveTaskToColumn}
          onCreateColumn={meetings.addTaskColumn}
          onUpdateColumn={meetings.changeTaskColumn}
          onDeleteColumn={meetings.removeTaskColumn}
          onOpenMeeting={openMeetingFromCalendar}
          defaultView={workspace.currentUser.preferredTaskView || "list"}
          googleTasksEnabled={google.googleEnabled}
          googleTasksStatus={google.googleTasksStatus}
          googleTasksMessage={google.googleTasksMessage}
          googleTaskLists={google.googleTaskLists}
          selectedGoogleTaskListId={google.selectedGoogleTaskListId}
          onSelectGoogleTaskList={google.setSelectedGoogleTaskListId}
          onConnectGoogleTasks={google.connectGoogleTasks}
          onImportGoogleTasks={google.importGoogleTasksFromList}
          onExportGoogleTasks={google.exportTasksToGoogle}
          workspaceName={workspace.currentWorkspace?.name || ""}
          workspaceInviteCode={workspace.currentWorkspace?.inviteCode || ""}
          externalSelectedTaskId={pendingTaskId}
          onTaskSelectionHandled={() => setPendingTaskId("")}
        />
      ) : activeTab === "people" ? (
        <PeopleTab profiles={meetings.peopleProfiles} onOpenMeeting={openMeetingFromCalendar} />
      ) : activeTab === "profile" ? (
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
          connectGoogleCalendar={google.connectGoogleCalendar}
          disconnectGoogleCalendar={google.disconnectGoogleCalendar}
          passwordDraft={auth.passwordDraft}
          setPasswordDraft={auth.setPasswordDraft}
          updatePassword={auth.updatePassword}
          securityMessage={auth.securityMessage}
        />
      ) : (
        <StudioTab
          currentUser={workspace.currentUser}
          currentWorkspace={workspace.currentWorkspace}
          currentWorkspaceMembers={workspace.currentWorkspaceMembers}
          setActiveTab={setActiveTab}
          meetingDraft={meetings.meetingDraft}
          setMeetingDraft={meetings.setMeetingDraft}
          saveMeeting={meetings.saveMeeting}
          workspaceMessage={meetings.workspaceMessage}
          userMeetings={meetings.userMeetings}
          selectedMeetingId={meetings.selectedMeetingId}
          selectMeeting={meetings.selectMeeting}
          selectedMeeting={meetings.selectedMeeting}
          displayRecording={displayRecording}
          studioAnalysis={studioAnalysis}
          isRecording={recorder.isRecording}
          analysisStatus={recorder.analysisStatus}
          elapsed={recorder.elapsed}
          visualBars={recorder.visualBars}
          stopRecording={recorder.stopRecording}
          startRecording={recorder.startRecording}
          recordPermission={recorder.recordPermission}
          speechRecognitionSupported={recorder.speechRecognitionSupported}
          liveText={recorder.liveText}
          recordingMessage={recorder.recordingMessage}
          selectedRecording={meetings.selectedRecording}
          displaySpeakerNames={displaySpeakerNames}
          selectedRecordingAudioUrl={selectedRecordingAudioUrl}
          updateTranscriptSegment={meetings.updateTranscriptSegment}
          renameSpeaker={meetings.renameSpeaker}
          selectedRecordingId={meetings.selectedRecordingId}
          setSelectedRecordingId={meetings.setSelectedRecordingId}
          exportTranscript={exportTranscript}
          exportMeetingNotes={exportMeetingNotes}
          exportMeetingPdfFile={exportMeetingPdfFile}
          setSelectedMeetingId={meetings.setSelectedMeetingId}
        />
      )}
    </div>
  );
}
