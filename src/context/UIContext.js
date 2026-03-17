import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import useStoredState from "../hooks/useStoredState";
import { buildCalendarEntries, buildUpcomingReminders } from "../lib/calendarView";
import { buildCommandPaletteItems } from "../lib/commandPalette";
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from "../lib/export";
import { buildWorkspaceNotifications, getBrowserNotificationCandidates } from "../lib/notifications";
import { downloadTextFile, formatDateTime, formatDuration, STORAGE_KEYS } from "../lib/storage";
import { buildGoogleCalendarUrl } from "../lib/calendar";
import { useWorkspaceCtx } from "./WorkspaceContext";
import { useMeetingsCtx } from "./MeetingsContext";
import { useRecorderCtx } from "./RecorderContext";
import { useGoogleCtx } from "./GoogleContext";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const { workspace, auth } = useWorkspaceCtx();
  const { meetings } = useMeetingsCtx();
  const recorder = useRecorderCtx();
  const google = useGoogleCtx();

  // ── Tab navigation ──────────────────────────────────────
  const [activeTab, setActiveTabRaw] = useState("studio");
  const [tabHistory, setTabHistory] = useState(["studio"]);

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

  // ── Theme ───────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem("voicelog_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("voicelog_theme", theme);
  }, [theme]);

  // ── Calendar state ──────────────────────────────────────
  const [pendingTaskId, setPendingTaskId] = useState("");
  const [pendingPersonId, setPendingPersonId] = useState("");

  // ── Command palette ─────────────────────────────────────
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

  const commandPaletteItems = useMemo(
    () =>
      buildCommandPaletteItems({
        meetings: meetings.userMeetings,
        tasks: meetings.meetingTasks,
        people: meetings.peopleProfiles,
      }),
    [meetings.meetingTasks, meetings.peopleProfiles, meetings.userMeetings]
  );

  // ── Notification center ─────────────────────────────────
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

  const browserNotificationsSupported =
    typeof window !== "undefined" &&
    typeof window.Notification === "function" &&
    typeof window.Notification.requestPermission === "function";

  useEffect(() => {
    if (!browserNotificationsSupported) {
      return;
    }
    setNotificationPermission(window.Notification.permission || "default");
  }, [browserNotificationsSupported]);

  // ── Derived values ──────────────────────────────────────
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

  // ── Browser notifications delivery ─────────────────────
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

  // ── Google calendar sync effect ─────────────────────────
  const syncLinkedGoogleCalendarEvents = meetings.syncLinkedGoogleCalendarEvents;

  useEffect(() => {
    if (!google.googleCalendarEvents.length) {
      return;
    }
    syncLinkedGoogleCalendarEvents(google.googleCalendarEvents);
  }, [google.googleCalendarEvents, syncLinkedGoogleCalendarEvents]);

  // ── Cross-cutting actions ───────────────────────────────
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

  const switchWorkspace = useCallback(
    (workspaceId) => {
      workspace.switchWorkspace(workspaceId);
      meetings.resetSelectionState();
      google.resetGoogleSession();
      setPendingTaskId("");
      setPendingPersonId("");
      setCommandPaletteOpen(false);
      setNotificationCenterOpen(false);
    },
    [workspace, meetings, google]
  );

  const logout = useCallback(() => {
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
  }, [workspace, meetings, google, recorder]);

  const value = {
    // Tab navigation
    activeTab,
    setActiveTab,
    navigateBack,
    canGoBack,
    // Theme
    theme,
    setTheme,
    // Pending selections
    pendingTaskId,
    setPendingTaskId,
    pendingPersonId,
    setPendingPersonId,
    // Command palette
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandPaletteItems,
    handleCommandPaletteSelect,
    // Notifications
    notificationCenterOpen,
    setNotificationCenterOpen,
    notificationItems,
    unreadNotificationCount,
    notificationPermission,
    browserNotificationsSupported,
    requestBrowserNotificationPermission,
    dismissNotification,
    activateNotification,
    // Derived recording values
    liveRecording,
    displayRecording,
    displaySpeakerNames,
    studioAnalysis,
    selectedRecordingAudioUrl,
    selectedRecordingAudioError,
    // Calendar
    calendarTasks,
    calendarEntries,
    upcomingReminders,
    // Cross-cutting actions
    exportTranscript,
    exportMeetingNotes,
    exportMeetingPdfFile,
    openMeetingFromCalendar,
    openGoogleCalendarForMeeting,
    openTaskFromCalendar,
    createTaskForPerson,
    createMeetingForPerson,
    openPersonFromPalette,
    switchWorkspace,
    logout,
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

export function useUICtx() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUICtx must be used within UIProvider");
  }
  return ctx;
}
