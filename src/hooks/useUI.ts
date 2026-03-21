import { useCallback, useEffect, useMemo } from "react";
import { useUIStore } from "../store/uiStore";
import { useWorkspaceStore, useWorkspaceSelectors } from "../store/workspaceStore";
import { useMeetingsStore } from "../store/meetingsStore";
import { useRecorderCtx } from "../context/RecorderContext";
import { useGoogleCtx } from "../context/GoogleContext";
import useMeetings from "./useMeetings";

import { buildCalendarEntries, buildUpcomingReminders } from "../lib/calendarView";
import { buildCommandPaletteItems } from "../lib/commandPalette";
import { buildWorkspaceNotifications } from "../lib/notifications";
import { downloadTextFile, formatDateTime, formatDuration } from "../lib/storage";
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from "../lib/export";
import { buildGoogleCalendarUrl } from "../lib/calendar";

export default function useUI() {
  const uiState = useUIStore();
  const workspace = useWorkspaceStore();
  const { currentWorkspaceId } = useWorkspaceSelectors();
  // We use the useMeetings hook to get derived task columns and helper methods
  const meetings = useMeetings(); 
  const recorder = useRecorderCtx();
  const google = useGoogleCtx();

  // ── Command palette ─────────────────────────────────────
  useEffect(() => {
    function handlePaletteShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        uiState.setCommandPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handlePaletteShortcut);
    return () => window.removeEventListener("keydown", handlePaletteShortcut);
  }, [uiState.setCommandPaletteOpen]);

  const commandPaletteItems = useMemo(
    () =>
      buildCommandPaletteItems({
        meetings: meetings.userMeetings,
        tasks: meetings.meetingTasks,
        people: meetings.peopleProfiles,
      }),
    [meetings.meetingTasks, meetings.peopleProfiles, meetings.userMeetings]
  );

  // ── Derived values ──────────────────────────────────────
  const liveRecording =
    recorder.isRecording && recorder.recordingMeetingId === meetings.selectedMeeting?.id
      ? {
          transcript: recorder.currentSegments,
          speakerNames: {},
          speakerCount: new Set(recorder.currentSegments.map((segment: any) => segment.speakerId || 0)).size,
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
    () => meetings.meetingTasks.filter((task: any) => Boolean(task.dueDate)),
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
      }).filter((item) => !(uiState.notificationState.dismissedIds || []).includes(item.id)),
    [meetings.taskNotifications, uiState.notificationState.dismissedIds, upcomingReminders]
  );

  const unreadNotificationCount = notificationItems.length;

  // ── Browser notifications delivery ─────────────────────
  useEffect(() => {
    uiState.deliverBrowserNotifications(notificationItems);
  }, [notificationItems, uiState.notificationPermission, uiState.deliverBrowserNotifications]);

  // ── Google calendar sync effect ─────────────────────────
  const syncLinkedGoogleCalendarEvents = meetings.syncLinkedGoogleCalendarEvents;

  useEffect(() => {
    if (!google.googleCalendarEvents.length) return;
    if (syncLinkedGoogleCalendarEvents) syncLinkedGoogleCalendarEvents(google.googleCalendarEvents);
  }, [google.googleCalendarEvents, syncLinkedGoogleCalendarEvents]);

  // ── Cross-cutting actions ───────────────────────────────
  const exportTranscript = useCallback(() => {
    if (!displayRecording) return;
    downloadTextFile(
      `${slugifyExportTitle(meetings.selectedMeeting?.title)}-transcript.txt`,
      displayRecording.transcript
        .map(
          (segment: any) =>
            `[${formatDuration(segment.timestamp)}] ${displaySpeakerNames[String(segment.speakerId)] || `Speaker ${Number(segment.speakerId) + 1}`}: ${segment.text}`
        )
        .join("\n")
    );
  }, [displayRecording, displaySpeakerNames, meetings.selectedMeeting?.title]);

  const exportMeetingNotes = useCallback(() => {
    if (!meetings.selectedMeeting) return;
    downloadTextFile(
      `${slugifyExportTitle(meetings.selectedMeeting.title)}-notes.txt`,
      buildMeetingNotesText(meetings.selectedMeeting, studioAnalysis, formatDateTime)
    );
  }, [meetings.selectedMeeting, studioAnalysis]);

  const exportMeetingPdfFile = useCallback(() => {
    if (!meetings.selectedMeeting) return;
    printMeetingPdf(meetings.selectedMeeting, displayRecording, displaySpeakerNames, formatDateTime, formatDuration);
  }, [meetings.selectedMeeting, displayRecording, displaySpeakerNames]);

  const openMeetingFromCalendar = useCallback((meetingId: string) => {
    const meeting = meetings.userMeetings.find((item: any) => item.id === meetingId);
    if (!meeting) return;
    meetings.selectMeeting(meeting);
    uiState.setActiveTab("studio");
  }, [meetings, uiState]);

  const openGoogleCalendarForMeeting = useCallback((meetingId: string) => {
    const meeting = meetings.userMeetings.find((item: any) => item.id === meetingId);
    if (!meeting) return;
    window.open(buildGoogleCalendarUrl(meeting), "_blank", "noopener,noreferrer");
  }, [meetings]);

  const openTaskFromCalendar = useCallback((taskId: string) => {
    uiState.setPendingTaskId(taskId);
    uiState.setActiveTab("tasks");
  }, [uiState]);

  const createTaskForPerson = useCallback((prefill: any = {}) => {
    const created = meetings.createTaskFromComposer({ title: "", ...prefill });
    const createdId = created?.id || created;
    if (createdId) uiState.setPendingTaskId(createdId);
    uiState.setActiveTab("tasks");
  }, [meetings, uiState]);

  const createMeetingForPerson = useCallback((personName: string) => {
    meetings.startNewMeetingDraft({ attendees: personName });
    uiState.setActiveTab("studio");
  }, [meetings, uiState]);

  const openPersonFromPalette = useCallback((personId: string) => {
    uiState.setPendingPersonId(personId);
    uiState.setActiveTab("people");
  }, [uiState]);

  const handleCommandPaletteSelect = useCallback((item: any) => {
    if (!item) return;
    if (item.type === "tab") uiState.setActiveTab(item.payload.tabId);
    else if (item.type === "meeting") openMeetingFromCalendar(item.payload.meetingId);
    else if (item.type === "task") openTaskFromCalendar(item.payload.taskId);
    else if (item.type === "person") openPersonFromPalette(item.payload.personId);
    uiState.setCommandPaletteOpen(false);
  }, [uiState, openMeetingFromCalendar, openTaskFromCalendar, openPersonFromPalette]);

  const activateNotification = useCallback((item: any) => {
    if (!item?.action) {
      uiState.dismissNotification(item?.id);
      uiState.setNotificationCenterOpen(false);
      return;
    }
    if (item.action.type === "meeting") openMeetingFromCalendar(item.action.id);
    else if (item.action.type === "task") openTaskFromCalendar(item.action.id);
    else uiState.setActiveTab("calendar");

    uiState.dismissNotification(item.id);
    uiState.setNotificationCenterOpen(false);
  }, [uiState, openMeetingFromCalendar, openTaskFromCalendar]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    workspace.switchWorkspace(workspaceId);
    meetings.resetSelectionState();
    google.resetGoogleSession();
    uiState.setPendingTaskId("");
    uiState.setPendingPersonId("");
    uiState.setCommandPaletteOpen(false);
    uiState.setNotificationCenterOpen(false);
  }, [workspace, meetings, google, uiState]);

  const logout = useCallback(() => {
    if (recorder.isRecording) recorder.stopRecording();
    workspace.logout();
    meetings.resetSelectionState();
    google.resetGoogleSession();
    recorder.resetRecorderState();
    uiState.setActiveTab("studio");
    uiState.setPendingTaskId("");
    uiState.setPendingPersonId("");
    uiState.setCommandPaletteOpen(false);
    uiState.setNotificationCenterOpen(false);
  }, [workspace, meetings, google, recorder, uiState]);

  return {
    ...uiState,
    commandPaletteItems,
    notificationItems,
    unreadNotificationCount,
    browserNotificationsSupported: typeof window !== "undefined" && typeof window.Notification !== "undefined",
    liveRecording,
    displayRecording,
    displaySpeakerNames,
    studioAnalysis,
    selectedRecordingAudioUrl,
    selectedRecordingAudioError,
    calendarTasks,
    calendarEntries,
    upcomingReminders,
    exportTranscript,
    exportMeetingNotes,
    exportMeetingPdfFile,
    openMeetingFromCalendar,
    openGoogleCalendarForMeeting,
    openTaskFromCalendar,
    createTaskForPerson,
    createMeetingForPerson,
    openPersonFromPalette,
    handleCommandPaletteSelect,
    activateNotification,
    switchWorkspace,
    logout,
  };
}
