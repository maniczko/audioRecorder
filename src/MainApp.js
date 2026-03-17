import { useEffect, useMemo, useState } from "react";
import "./App.css";
import AuthScreen from "./AuthScreen";
import ErrorBoundary from "./lib/ErrorBoundary";
import CalendarTab from "./CalendarTab";
import CommandPalette from "./CommandPalette";
import NotesTab from "./NotesTab";
import NotificationCenter from "./NotificationCenter";
import PeopleTab from "./PeopleTab";
import ProfileTab from "./ProfileTab";
import StudioTab from "./StudioTab";
import TasksTab from "./TasksTab";
import useAuth from "./hooks/useAuth";
import useGoogleIntegrations from "./hooks/useGoogleIntegrations";
import useMeetings from "./hooks/useMeetings";
import useRecorder from "./hooks/useRecorder";
import useStoredState from "./hooks/useStoredState";
import useWorkspace from "./hooks/useWorkspace";
import { buildGoogleCalendarUrl } from "./lib/calendar";
import { buildCalendarEntries, buildUpcomingReminders } from "./lib/calendarView";
import { buildCommandPaletteItems } from "./lib/commandPalette";
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from "./lib/export";
import { buildWorkspaceNotifications, getBrowserNotificationCandidates } from "./lib/notifications";
import { downloadTextFile, formatDateTime, formatDuration, STORAGE_KEYS } from "./lib/storage";

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

  const [activeTab, setActiveTabRaw] = useState("studio");
  const [tabHistory, setTabHistory] = useState(["studio"]);
  const [theme, setTheme] = useState(() => localStorage.getItem("voicelog_theme") || "dark");

  function setActiveTab(tab) {
    setActiveTabRaw((prev) => {
      if (prev === tab) return prev;
      setTabHistory((h) => [...h.slice(-19), prev]);
      return tab;
    });
  }

  function navigateBack() {
    setTabHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      const next = h.slice(0, -1);
      setActiveTabRaw(prev);
      return next;
    });
  }

  const canGoBack = tabHistory.length > 0;
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [pendingTaskId, setPendingTaskId] = useState("");
  const [pendingPersonId, setPendingPersonId] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationState, setNotificationState] = useStoredState(STORAGE_KEYS.notificationState, {
    dismissedIds: [],
    deliveredIds: [],
  });
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== "undefined" && typeof window.Notification?.permission === "string"
      ? window.Notification.permission
      : "unsupported"
  );

  const google = useGoogleIntegrations({
    currentUser: workspace.currentUser,
    currentWorkspaceId: workspace.currentWorkspaceId,
    calendarMonth,
    taskColumns: meetings.taskColumns,
    meetingTasks: meetings.meetingTasks,
    manualTasks: meetings.manualTasks,
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
  const selectedRecordingAudioError = meetings.selectedRecording
    ? recorder.audioHydrationErrors[meetings.selectedRecording.id]
    : "";
  const calendarTasks = useMemo(
    () => meetings.meetingTasks.filter((task) => Boolean(task.dueDate)),
    [meetings.meetingTasks]
  );
  const calendarEntries = useMemo(
    () =>
      buildCalendarEntries(
        meetings.userMeetings,
        google.googleCalendarEvents,
        calendarTasks,
        meetings.calendarMeta
      ),
    [calendarTasks, google.googleCalendarEvents, meetings.calendarMeta, meetings.userMeetings]
  );
  const upcomingReminders = useMemo(() => buildUpcomingReminders(calendarEntries), [calendarEntries]);
  const notificationItems = useMemo(
    () =>
      buildWorkspaceNotifications({
        reminders: upcomingReminders,
        taskNotifications: meetings.taskNotifications,
      }).filter((item) => !(notificationState.dismissedIds || []).includes(item.id)),
    [meetings.taskNotifications, notificationState.dismissedIds, upcomingReminders]
  );
  const unreadNotificationCount = notificationItems.length;
  const browserNotificationsSupported =
    typeof window !== "undefined" &&
    typeof window.Notification === "function" &&
    typeof window.Notification.requestPermission === "function";
  const syncLinkedGoogleCalendarEvents = meetings.syncLinkedGoogleCalendarEvents;
  const commandPaletteItems = useMemo(
    () =>
      buildCommandPaletteItems({
        meetings: meetings.userMeetings,
        tasks: meetings.meetingTasks,
        people: meetings.peopleProfiles,
      }),
    [meetings.meetingTasks, meetings.peopleProfiles, meetings.userMeetings]
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("voicelog_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!google.googleCalendarEvents.length) {
      return;
    }

    syncLinkedGoogleCalendarEvents(google.googleCalendarEvents);
  }, [google.googleCalendarEvents, syncLinkedGoogleCalendarEvents]);

  useEffect(() => {
    function handlePaletteShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", handlePaletteShortcut);
    return () => {
      window.removeEventListener("keydown", handlePaletteShortcut);
    };
  }, []);

  useEffect(() => {
    if (!browserNotificationsSupported) {
      return;
    }

    setNotificationPermission(window.Notification.permission || "default");
  }, [browserNotificationsSupported]);

  useEffect(() => {
    if (!browserNotificationsSupported || notificationPermission !== "granted") {
      return;
    }

    const candidates = getBrowserNotificationCandidates(notificationItems, notificationState.deliveredIds);
    if (!candidates.length) {
      return;
    }

    candidates.forEach((item) => {
      try {
        new window.Notification(item.title, {
          body: item.body,
          tag: item.id,
        });
      } catch (error) {
        console.error("Browser notification failed.", error);
      }
    });

    setNotificationState((previous) => ({
      ...previous,
      deliveredIds: [...new Set([...(previous.deliveredIds || []), ...candidates.map((item) => item.id)])],
    }));
  }, [
    browserNotificationsSupported,
    notificationItems,
    notificationPermission,
    notificationState.deliveredIds,
    setNotificationState,
  ]);

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

  function createTaskForPerson(prefill = {}) {
    const created = meetings.createTaskFromComposer({ title: "", ...prefill });
    const createdId = created?.id || created;
    if (createdId) {
      setPendingTaskId(createdId);
    }
    setActiveTab("tasks");
  }

  function createMeetingForPerson(personName) {
    meetings.startNewMeetingDraft({ attendees: personName });
    setActiveTab("studio");
  }

  function openPersonFromPalette(personId) {
    setPendingPersonId(personId);
    setActiveTab("people");
  }

  function handleCommandPaletteSelect(item) {
    if (!item) {
      return;
    }

    if (item.type === "tab") {
      setActiveTab(item.payload.tabId);
    } else if (item.type === "meeting") {
      openMeetingFromCalendar(item.payload.meetingId);
    } else if (item.type === "task") {
      openTaskFromCalendar(item.payload.taskId);
    } else if (item.type === "person") {
      openPersonFromPalette(item.payload.personId);
    }

    setCommandPaletteOpen(false);
  }

  async function requestBrowserNotificationPermission() {
    if (!browserNotificationsSupported || notificationPermission === "granted") {
      return;
    }

    try {
      const nextPermission = await window.Notification.requestPermission();
      setNotificationPermission(nextPermission);
    } catch (error) {
      console.error("Unable to request notification permission.", error);
    }
  }

  function dismissNotification(notificationId) {
    setNotificationState((previous) => ({
      ...previous,
      dismissedIds: [...new Set([...(previous.dismissedIds || []), notificationId])],
    }));
  }

  function activateNotification(item) {
    if (!item?.action) {
      dismissNotification(item?.id);
      setNotificationCenterOpen(false);
      return;
    }

    if (item.action.type === "meeting") {
      openMeetingFromCalendar(item.action.id);
    } else if (item.action.type === "task") {
      openTaskFromCalendar(item.action.id);
    } else {
      setActiveTab("calendar");
    }

    dismissNotification(item.id);
    setNotificationCenterOpen(false);
  }

  function switchWorkspace(workspaceId) {
    workspace.switchWorkspace(workspaceId);
    meetings.resetSelectionState();
    google.resetGoogleSession();
    setPendingTaskId("");
    setPendingPersonId("");
    setCommandPaletteOpen(false);
    setNotificationCenterOpen(false);
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
    setPendingPersonId("");
    setCommandPaletteOpen(false);
    setNotificationCenterOpen(false);
  }

  if (workspace.isHydratingSession) {
    return (
      <div className="app-shell app-shell-loading">
        <div className="topbar">
          <div className="topbar-title">
            <div>
              <div className="eyebrow">VoiceLog OS</div>
              <h1>Przywracamy sesje i workspace...</h1>
            </div>
          </div>
        </div>
      </div>
    );
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
            {canGoBack && (
              <button
                type="button"
                className="tab-back-btn"
                onClick={navigateBack}
                title="Cofnij"
                aria-label="Wróć do poprzedniej zakładki"
              >
                ←
              </button>
            )}
            <button type="button" className={activeTab === "studio" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("studio")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              <span>Studio</span>
            </button>
            <button type="button" className={activeTab === "calendar" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("calendar")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <span>Kalendarz</span>
            </button>
            <button type="button" className={activeTab === "tasks" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("tasks")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span>Zadania</span>
            </button>
            <button type="button" className={activeTab === "people" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("people")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Osoby</span>
            </button>
            <button type="button" className={activeTab === "notes" ? "tab-pill active" : "tab-pill"} onClick={() => setActiveTab("notes")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
              <span>Notatki</span>
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="status-chip">{google.googleEnabled ? "Google ready" : "Google env missing"}</div>
          <NotificationCenter
            open={notificationCenterOpen}
            unreadCount={unreadNotificationCount}
            items={notificationItems}
            permissionState={notificationPermission}
            browserNotificationsSupported={browserNotificationsSupported}
            onToggle={() => setNotificationCenterOpen((previous) => !previous)}
            onClose={() => setNotificationCenterOpen(false)}
            onRequestPermission={requestBrowserNotificationPermission}
            onDismiss={dismissNotification}
            onActivate={activateNotification}
          />
          <button type="button" className="ghost-button command-palette-launcher" onClick={() => setCommandPaletteOpen(true)}>
            Szukaj
            <span>Ctrl+K</span>
          </button>
          <button
            type="button"
            className={recorder.isRecording ? "topbar-record-btn recording" : "topbar-record-btn"}
            onClick={() => {
              if (recorder.isRecording) {
                recorder.stopRecording();
              } else {
                recorder.startRecording({ adHoc: true });
              }
              setActiveTab("studio");
            }}
            disabled={!workspace.currentWorkspacePermissions?.canRecordAudio}
            title={recorder.isRecording ? "Zatrzymaj nagranie" : "Nagranie ad hoc"}
          >
            <span className="topbar-record-dot" />
            {recorder.isRecording ? "Nagrywam..." : "Nagraj"}
          </button>
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
              {(workspace.currentUser.role && workspace.currentUser.role !== "No role") || workspace.currentUser.provider === "google" ? (
                <span>
                  {workspace.currentUser.role || ""}
                  {workspace.currentUser.provider === "google" ? " - Google sign-in" : ""}
                </span>
              ) : null}
            </div>
            <button type="button" className="settings-button" aria-label="Otworz ustawienia" onClick={() => setActiveTab("profile")}>
              {"\u2699"}
            </button>
          </div>
        </div>
      </header>

      <ErrorBoundary key={activeTab} label={
        activeTab === "calendar" ? "Kalendarz"
        : activeTab === "tasks" ? "Zadania"
        : activeTab === "notes" ? "Notatki"
        : activeTab === "people" ? "Osoby"
        : activeTab === "profile" ? "Profil"
        : "Studio"
      }>
      {activeTab === "calendar" ? (
        <CalendarTab
          activeMonth={calendarMonth}
          setActiveMonth={setCalendarMonth}
          selectedDate={selectedCalendarDate}
          setSelectedDate={setSelectedCalendarDate}
          userMeetings={meetings.userMeetings}
          calendarTasks={calendarTasks}
          googleCalendarEvents={google.googleCalendarEvents}
          googleCalendarStatus={google.googleCalendarStatus}
          googleCalendarMessage={google.googleCalendarMessage}
          connectGoogleCalendar={google.connectGoogleCalendar}
          disconnectGoogleCalendar={google.disconnectGoogleCalendar}
          syncCalendarEntryToGoogle={google.syncCalendarEntryToGoogle}
          rescheduleGoogleCalendarEntry={google.rescheduleGoogleCalendarEntry}
          openMeetingFromCalendar={openMeetingFromCalendar}
          openGoogleCalendarForMeeting={openGoogleCalendarForMeeting}
          openTaskFromCalendar={openTaskFromCalendar}
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
          onNavigateToStudio={() => setActiveTab("studio")}
          onCreateMeeting={meetings.createMeetingDirect}
        />
      ) : activeTab === "tasks" ? (
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
          onOpenMeeting={openMeetingFromCalendar}
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
          externalSelectedTaskId={pendingTaskId}
          onTaskSelectionHandled={() => setPendingTaskId("")}
          currentUserName={workspace.currentUser?.name || workspace.currentUser?.email || "Ty"}
          taskNotifications={meetings.taskNotifications}
          workspaceActivity={meetings.workspaceActivity}
        />
      ) : activeTab === "notes" ? (
        <NotesTab
          userMeetings={meetings.userMeetings}
          onOpenMeeting={openMeetingFromCalendar}
          onCreateNote={meetings.createManualNote}
        />
      ) : activeTab === "people" ? (
        <PeopleTab
          profiles={meetings.peopleProfiles}
          onOpenMeeting={openMeetingFromCalendar}
          onOpenTask={openTaskFromCalendar}
          onCreateTask={createTaskForPerson}
          onCreateMeeting={createMeetingForPerson}
          onUpdatePersonNotes={meetings.updatePersonNotes}
          onAnalyzePersonProfile={meetings.analyzePersonPsychProfile}
          externalSelectedPersonId={pendingPersonId}
          onPersonSelectionHandled={() => setPendingPersonId("")}
        />
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
          googleCalendarLastSyncedAt={google.googleCalendarLastSyncedAt}
          connectGoogleCalendar={google.connectGoogleCalendar}
          disconnectGoogleCalendar={google.disconnectGoogleCalendar}
          refreshGoogleCalendar={google.refreshGoogleCalendar}
          passwordDraft={auth.passwordDraft}
          setPasswordDraft={auth.setPasswordDraft}
          updatePassword={auth.updatePassword}
          securityMessage={auth.securityMessage}
          onLogout={logout}
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
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          sessionToken={workspace.session?.token || ""}
          apiBaseUrl={process.env.REACT_APP_API_BASE_URL || ""}
          allTags={(() => {
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
          })()}
          onRenameTag={meetings.renameTag}
          onDeleteTag={meetings.deleteTag}
        />
      ) : (
        <StudioTab
          currentUser={workspace.currentUser}
          currentWorkspace={workspace.currentWorkspace}
          currentWorkspaceMembers={workspace.currentWorkspaceMembers}
          currentWorkspaceRole={workspace.currentWorkspaceRole}
          currentWorkspacePermissions={workspace.currentWorkspacePermissions}
          updateWorkspaceMemberRole={workspace.updateWorkspaceMemberRole}
          setActiveTab={setActiveTab}
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
          displayRecording={displayRecording}
          studioAnalysis={studioAnalysis}
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
          displaySpeakerNames={displaySpeakerNames}
          selectedRecordingAudioUrl={selectedRecordingAudioUrl}
          selectedRecordingAudioError={selectedRecordingAudioError}
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
          exportTranscript={exportTranscript}
          exportMeetingNotes={exportMeetingNotes}
          exportMeetingPdfFile={exportMeetingPdfFile}
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

      <CommandPalette
        open={commandPaletteOpen}
        items={commandPaletteItems}
        onClose={() => setCommandPaletteOpen(false)}
        onSelect={handleCommandPaletteSelect}
      />
    </div>
  );
}
