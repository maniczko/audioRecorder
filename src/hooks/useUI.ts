import { useCallback, useEffect, useMemo } from 'react';
import { useUIStore } from '../store/uiStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useRecorderCtx } from '../context/RecorderContext';
import { useGoogleCtx } from '../context/GoogleContext';
import useMeetings from './useMeetings';

import { buildCalendarEntries, buildUpcomingReminders } from '../lib/calendarView';
import { buildCommandPaletteItems } from '../lib/commandPalette';
import { buildWorkspaceNotifications } from '../lib/notifications';
import { downloadTextFile, formatDateTime, formatDuration } from '../lib/storage';
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from '../lib/export';
import { buildGoogleCalendarUrl } from '../lib/calendar';

export default function useUI() {
  const uiState = useUIStore();
  const workspace = useWorkspaceStore();
  // We use the useMeetings hook to get derived task columns and helper methods
  const meetings = useMeetings();
  const recorder = useRecorderCtx();
  const google = useGoogleCtx();
  const {
    notificationState,
    notificationPermission,
    deliverBrowserNotifications,
    setCommandPaletteOpen,
    setActiveTab,
    setPendingTaskId,
    setPendingPersonId,
    dismissNotification,
    setNotificationCenterOpen,
    studioHomeSignal,
    triggerStudioHome,
  } = uiState;

  // ── Command palette ─────────────────────────────────────
  useEffect(() => {
    function handlePaletteShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handlePaletteShortcut);
    return () => window.removeEventListener('keydown', handlePaletteShortcut);
  }, [setCommandPaletteOpen]);

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
          speakerCount: new Set(
            recorder.currentSegments.map((segment: any) => segment.speakerId || 0)
          ).size,
          analysis: null,
        }
      : null;

  const displayRecording = liveRecording || meetings.selectedRecording;
  const displaySpeakerNames = useMemo(
    () => displayRecording?.speakerNames || meetings.selectedMeeting?.speakerNames || {},
    [displayRecording?.speakerNames, meetings.selectedMeeting?.speakerNames]
  );
  const studioAnalysis =
    meetings.selectedRecording?.analysis || meetings.selectedMeeting?.analysis || null;

  const selectedRecordingAudioUrl = meetings.selectedRecording
    ? recorder.audioUrls[meetings.selectedRecording.id]
    : '';
  const selectedRecordingAudioError = meetings.selectedRecording
    ? recorder.audioHydrationErrors[meetings.selectedRecording.id]
    : '';
  const selectedRecordingAudioStatus = meetings.selectedRecording
    ? recorder.audioHydrationStatusByRecordingId?.[meetings.selectedRecording.id] || 'idle'
    : 'idle';

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

  const upcomingReminders = useMemo(
    () => buildUpcomingReminders(calendarEntries),
    [calendarEntries]
  );

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
    deliverBrowserNotifications(notificationItems);
  }, [deliverBrowserNotifications, notificationItems, notificationPermission]);

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
        .join('\n')
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
    printMeetingPdf(
      meetings.selectedMeeting,
      displayRecording,
      displaySpeakerNames,
      formatDateTime,
      formatDuration
    );
  }, [meetings.selectedMeeting, displayRecording, displaySpeakerNames]);

  const openMeetingFromCalendar = useCallback(
    (meetingId: string) => {
      const meeting = meetings.userMeetings.find((item: any) => item.id === meetingId);
      if (!meeting) return;
      meetings.selectMeeting(meeting);
      setActiveTab('studio');
    },
    [meetings, setActiveTab]
  );

  const openStudio = useCallback(() => {
    triggerStudioHome();
    setActiveTab('studio');
  }, [triggerStudioHome, setActiveTab]);

  // React to studioHomeSignal — calls startNewMeetingDraft() on this hook's
  // meetings instance (the one actually used by TabRouter to render state).
  // Skip the initial mount (signal === 0).
  useEffect(() => {
    if (!studioHomeSignal) return;
    meetings.startNewMeetingDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studioHomeSignal]);

  const openGoogleCalendarForMeeting = useCallback(
    (meetingId: string) => {
      const meeting = meetings.userMeetings.find((item: any) => item.id === meetingId);
      if (!meeting) return;
      window.open(buildGoogleCalendarUrl(meeting), '_blank', 'noopener,noreferrer');
    },
    [meetings]
  );

  const openTask = useCallback(
    (input: string | { taskId?: string; mode?: 'tab' | 'detail' } | undefined = {}) => {
      const taskId = typeof input === 'string' ? input : input?.taskId;
      const mode = typeof input === 'string' ? 'detail' : input?.mode || 'detail';
      const normalizedTaskId = String(taskId || '').trim();
      if (!normalizedTaskId) {
        return;
      }

      if (mode === 'tab') {
        setPendingTaskId('');
        setActiveTab('tasks');
        return;
      }

      setPendingTaskId(normalizedTaskId);
      setActiveTab('tasks');
    },
    [setActiveTab, setPendingTaskId]
  );

  const openTaskFromCalendar = useCallback(
    (taskId: string) => {
      openTask({ taskId, mode: 'detail' });
    },
    [openTask]
  );

  const createTaskForPerson = useCallback(
    (prefill: any = {}) => {
      const created = meetings.createTaskFromComposer({ title: '', ...prefill });
      const createdId = created?.id || created;
      if (createdId) setPendingTaskId(createdId);
      setActiveTab('tasks');
    },
    [meetings, setActiveTab, setPendingTaskId]
  );

  const createMeetingForPerson = useCallback(
    (personName: string) => {
      meetings.startNewMeetingDraft({ attendees: personName });
      setActiveTab('studio');
    },
    [meetings, setActiveTab]
  );

  const openPersonFromPalette = useCallback(
    (personId: string) => {
      setPendingPersonId(personId);
      setActiveTab('people');
    },
    [setActiveTab, setPendingPersonId]
  );

  const handleCommandPaletteSelect = useCallback(
    (item: any) => {
      if (!item) return;
      if (item.type === 'tab') setActiveTab(item.payload.tabId);
      else if (item.type === 'meeting') openMeetingFromCalendar(item.payload.meetingId);
      else if (item.type === 'task') openTask({ taskId: item.payload.taskId, mode: 'detail' });
      else if (item.type === 'person') openPersonFromPalette(item.payload.personId);
      setCommandPaletteOpen(false);
    },
    [openMeetingFromCalendar, openPersonFromPalette, openTask, setActiveTab, setCommandPaletteOpen]
  );

  const activateNotification = useCallback(
    (item: any) => {
      if (!item?.action) {
        dismissNotification(item?.id);
        setNotificationCenterOpen(false);
        return;
      }
      if (item.action.type === 'meeting') openMeetingFromCalendar(item.action.id);
      else if (item.action.type === 'task') openTask({ taskId: item.action.id, mode: 'detail' });
      else setActiveTab('calendar');

      dismissNotification(item.id);
      setNotificationCenterOpen(false);
    },
    [
      dismissNotification,
      openMeetingFromCalendar,
      openTask,
      setActiveTab,
      setNotificationCenterOpen,
    ]
  );

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      workspace.switchWorkspace(workspaceId);
      meetings.resetSelectionState();
      google.resetGoogleSession();
      setPendingTaskId('');
      setPendingPersonId('');
      setCommandPaletteOpen(false);
      setNotificationCenterOpen(false);
    },
    [
      workspace,
      meetings,
      google,
      setCommandPaletteOpen,
      setNotificationCenterOpen,
      setPendingPersonId,
      setPendingTaskId,
    ]
  );

  const logout = useCallback(() => {
    if (recorder.isRecording) recorder.stopRecording();
    workspace.logout();
    meetings.resetSelectionState();
    google.resetGoogleSession();
    recorder.resetRecorderState();
    setActiveTab('studio');
    setPendingTaskId('');
    setPendingPersonId('');
    setCommandPaletteOpen(false);
    setNotificationCenterOpen(false);
  }, [
    workspace,
    meetings,
    google,
    recorder,
    setActiveTab,
    setCommandPaletteOpen,
    setNotificationCenterOpen,
    setPendingPersonId,
    setPendingTaskId,
  ]);

  return {
    ...uiState,
    canGoBack: (uiState.tabHistory || []).length > 0,
    commandPaletteItems,
    notificationItems,
    unreadNotificationCount,
    browserNotificationsSupported:
      typeof window !== 'undefined' && typeof window.Notification !== 'undefined',
    liveRecording,
    displayRecording,
    displaySpeakerNames,
    studioAnalysis,
    selectedRecordingAudioUrl,
    selectedRecordingAudioError,
    selectedRecordingAudioStatus,
    calendarTasks,
    calendarEntries,
    upcomingReminders,
    exportTranscript,
    exportMeetingNotes,
    exportMeetingPdfFile,
    openMeetingFromCalendar,
    openStudio,
    openGoogleCalendarForMeeting,
    openTask,
    openTaskFromCalendar,
    createTaskForPerson,
    createMeetingForPerson,
    openPersonFromPalette,
    handleCommandPaletteSelect,
    activateNotification,
    switchWorkspace,
    logout,
    hydrateRecordingAudio: recorder.hydrateRecordingAudio,
    clearAudioHydrationError: recorder.clearAudioHydrationError,
  };
}
