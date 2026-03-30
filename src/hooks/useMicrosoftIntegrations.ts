import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MICROSOFT_CLIENT_ID,
  initializeMsal,
  signInMicrosoft,
  signOutMicrosoft,
  fetchOutlookCalendarEvents,
  createOutlookCalendarEvent,
  updateOutlookCalendarEvent,
  fetchMicrosoftTaskLists,
  fetchMicrosoftTasks,
  createMicrosoftTask,
  renderMicrosoftSignInButton,
} from '../lib/microsoft';

export default function useMicrosoftIntegrations({
  currentUser,
  currentWorkspaceId,
  calendarMonth,
  taskColumns,
  meetingTasks,
  manualTasks,
  setManualTasks,
  onMicrosoftProfile,
  onMicrosoftError,
}) {
  const [microsoftCalendarStatus, setMicrosoftCalendarStatus] = useState('idle');
  const [outlookCalendarEvents, setOutlookCalendarEvents] = useState([]);
  const [microsoftCalendarMessage, setMicrosoftCalendarMessage] = useState('');
  const [microsoftTasksStatus, setMicrosoftTasksStatus] = useState('idle');
  const [microsoftTaskLists, setMicrosoftTaskLists] = useState([]);
  const [selectedMicrosoftTaskListId, setSelectedMicrosoftTaskListId] = useState('');
  const [microsoftTasksMessage, setMicrosoftTasksMessage] = useState('');
  const [microsoftCalendarLastSyncedAt, setMicrosoftCalendarLastSyncedAt] = useState('');
  const [microsoftTasksLastSyncedAt, setMicrosoftTasksLastSyncedAt] = useState('');

  const microsoftButtonRef = useRef(null);
  const msalInstanceRef = useRef(null);
  const microsoftCalendarTokenRef = useRef('');
  const microsoftTasksTokenRef = useRef('');
  const manualTasksRef = useRef(manualTasks);
  const hasMicrosoftCalendarToken = Boolean(microsoftCalendarTokenRef.current);
  const hasMicrosoftTasksToken = Boolean(microsoftTasksTokenRef.current);

  useEffect(() => {
    manualTasksRef.current = manualTasks;
  }, [manualTasks]);

  const microsoftEnabled = Boolean(MICROSOFT_CLIENT_ID);
  const openTaskColumnId =
    taskColumns.find((column) => !column.isDone)?.id || taskColumns[0]?.id || 'todo';

  function buildMicrosoftTaskPayloadFromSnapshot(snapshot) {
    return {
      title: String(snapshot?.title || '').trim() || 'VoiceLog task',
      notes: String(snapshot?.notes || '').trim(),
      dueDateTime: snapshot?.dueDate
        ? { dateTime: new Date(snapshot.dueDate).toISOString(), timeZone: 'UTC' }
        : undefined,
      isCompleted: snapshot?.completed || false,
    };
  }

  useEffect(() => {
    if (!currentWorkspaceId) {
      setMicrosoftCalendarStatus('idle');
      setOutlookCalendarEvents([]);
      setMicrosoftCalendarMessage('');
      setMicrosoftTasksStatus('idle');
      setMicrosoftTaskLists([]);
      setSelectedMicrosoftTaskListId('');
      setMicrosoftTasksMessage('');
      setMicrosoftCalendarLastSyncedAt('');
      setMicrosoftTasksLastSyncedAt('');
      microsoftCalendarTokenRef.current = '';
      microsoftTasksTokenRef.current = '';
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    const microsoftButtonNode = microsoftButtonRef.current;

    if (!microsoftEnabled || !microsoftButtonNode) {
      return undefined;
    }

    let active = true;

    renderMicrosoftSignInButton(microsoftButtonNode, (profile) => {
      if (!active) {
        return;
      }

      onMicrosoftProfile?.(profile);
    }).catch((error) => {
      console.error('Microsoft sign-in render failed.', error);
      if (active) {
        onMicrosoftError?.('Nie udalo sie zaladowac logowania Microsoft.');
      }
    });

    return () => {
      active = false;
      if (microsoftButtonNode) {
        microsoftButtonNode.innerHTML = '';
      }
    };
  }, [microsoftEnabled, onMicrosoftError, onMicrosoftProfile]);

  const loadOutlookMonthEvents = useCallback(async (accessToken, monthDate) => {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();
    const payload = await fetchOutlookCalendarEvents(accessToken, {
      timeMin: monthStart,
      timeMax: monthEnd,
    });
    setOutlookCalendarEvents(payload || []);
    setMicrosoftCalendarLastSyncedAt(new Date().toISOString());
    setMicrosoftCalendarStatus('connected');
    setMicrosoftCalendarMessage('Pobrano wydarzenia z kalendarza Outlook.');
  }, []);

  useEffect(() => {
    if (!microsoftCalendarTokenRef.current) {
      return;
    }

    loadOutlookMonthEvents(microsoftCalendarTokenRef.current, calendarMonth).catch((error) => {
      console.error('Outlook Calendar refresh failed.', error);
      setMicrosoftCalendarStatus('error');
      setMicrosoftCalendarMessage(
        'Nie udalo sie odswiezyc wydarzen Outlook. Polacz kalendarz ponownie.'
      );
    });
  }, [calendarMonth, loadOutlookMonthEvents]);

  useEffect(() => {
    if (!microsoftTasksTokenRef.current || !selectedMicrosoftTaskListId) {
      return;
    }

    const loadTasks = async () => {
      const tasks = await fetchMicrosoftTasks(
        microsoftTasksTokenRef.current,
        selectedMicrosoftTaskListId
      );
      setMicrosoftTasksMessage(`Pobrano ${tasks.length} zadan.`);
      setMicrosoftTasksLastSyncedAt(new Date().toISOString());
      setMicrosoftTasksStatus('connected');
    };

    loadTasks().catch((error) => {
      console.error('Microsoft Tasks refresh failed.', error);
      setMicrosoftTasksStatus('error');
      setMicrosoftTasksMessage('Nie udalo sie odswiezyc zadan Microsoft. Polacz ponownie.');
    });
  }, [selectedMicrosoftTaskListId]);

  const connectMicrosoftCalendar = useCallback(async () => {
    if (!microsoftEnabled) {
      setMicrosoftCalendarMessage('Integracja z Microsoft nie jest skonfigurowana.');
      return;
    }

    try {
      setMicrosoftCalendarStatus('connecting');

      if (!msalInstanceRef.current) {
        msalInstanceRef.current = await initializeMsal();
      }

      const accessToken = await signInMicrosoft(msalInstanceRef.current, [
        'User.Read',
        ...CALENDAR_SCOPES,
      ]);
      microsoftCalendarTokenRef.current = accessToken;

      await loadOutlookMonthEvents(accessToken, calendarMonth);
      setMicrosoftCalendarMessage('Polaczono z kalendarzem Outlook.');
    } catch (error) {
      console.error('Microsoft Calendar connect failed.', error);
      setMicrosoftCalendarStatus('error');
      setMicrosoftCalendarMessage('Nie udalo sie polaczyc z kalendarzem Outlook.');
    }
  }, [microsoftEnabled, calendarMonth, loadOutlookMonthEvents]);

  const disconnectMicrosoftCalendar = useCallback(async () => {
    if (msalInstanceRef.current && microsoftCalendarTokenRef.current) {
      try {
        await signOutMicrosoft(msalInstanceRef.current);
      } catch (error) {
        console.error('Microsoft sign-out failed.', error);
      }
    }

    microsoftCalendarTokenRef.current = '';
    setMicrosoftCalendarStatus('idle');
    setOutlookCalendarEvents([]);
    setMicrosoftCalendarMessage('Rozlaczono z kalendarzem Outlook.');
    setMicrosoftCalendarLastSyncedAt('');
  }, []);

  const createCalendarEvent = useCallback(
    async (meeting) => {
      if (!hasMicrosoftCalendarToken) {
        throw new Error('Brak polaczenia z kalendarzem Outlook');
      }

      const event = {
        subject: meeting.title || 'Spotkanie',
        start: {
          dateTime: new Date(meeting.startsAt).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(meeting.endsAt || Date.now() + 3600000).toISOString(),
          timeZone: 'UTC',
        },
        body: {
          contentType: 'text',
          content: meeting.description || '',
        },
        isOnlineMeeting: true,
      };

      return await createOutlookCalendarEvent(microsoftCalendarTokenRef.current, event);
    },
    [hasMicrosoftCalendarToken]
  );

  const updateCalendarEvent = useCallback(
    async (eventId, updates) => {
      if (!hasMicrosoftCalendarToken) {
        throw new Error('Brak polaczenia z kalendarzem Outlook');
      }

      return await updateOutlookCalendarEvent(microsoftCalendarTokenRef.current, eventId, updates);
    },
    [hasMicrosoftCalendarToken]
  );

  const connectMicrosoftTasks = useCallback(async () => {
    if (!microsoftEnabled) {
      setMicrosoftTasksMessage('Integracja z Microsoft nie jest skonfigurowana.');
      return;
    }

    try {
      setMicrosoftTasksStatus('connecting');

      if (!msalInstanceRef.current) {
        msalInstanceRef.current = await initializeMsal();
      }

      const accessToken = await signInMicrosoft(msalInstanceRef.current, [
        'User.Read',
        ...TASKS_SCOPES,
      ]);
      microsoftTasksTokenRef.current = accessToken;

      const taskLists = await fetchMicrosoftTaskLists(accessToken);
      setMicrosoftTaskLists(taskLists);

      if (taskLists.length > 0) {
        setSelectedMicrosoftTaskListId(taskLists[0].id);
      }

      setMicrosoftTasksMessage('Polaczono z Microsoft To Do.');
      setMicrosoftTasksStatus('connected');
    } catch (error) {
      console.error('Microsoft Tasks connect failed.', error);
      setMicrosoftTasksStatus('error');
      setMicrosoftTasksMessage('Nie udalo sie polaczyc z Microsoft To Do.');
    }
  }, [microsoftEnabled]);

  const disconnectMicrosoftTasks = useCallback(async () => {
    if (msalInstanceRef.current && microsoftTasksTokenRef.current) {
      try {
        await signOutMicrosoft(msalInstanceRef.current);
      } catch (error) {
        console.error('Microsoft sign-out failed.', error);
      }
    }

    microsoftTasksTokenRef.current = '';
    setMicrosoftTasksStatus('idle');
    setMicrosoftTaskLists([]);
    setSelectedMicrosoftTaskListId('');
    setMicrosoftTasksMessage('Rozlaczono z Microsoft To Do.');
    setMicrosoftTasksLastSyncedAt('');
  }, []);

  const syncTaskToMicrosoft = useCallback(
    async (task) => {
      if (!hasMicrosoftTasksToken || !selectedMicrosoftTaskListId) {
        return null;
      }

      try {
        const taskPayload = buildMicrosoftTaskPayloadFromSnapshot(task);
        const createdTask = await createMicrosoftTask(
          microsoftTasksTokenRef.current,
          selectedMicrosoftTaskListId,
          taskPayload
        );

        // TODO: Add history entry when task history is implemented
        // const historyEntry = createTaskHistoryEntry(
        //   task.id,
        //   'synced_to_microsoft',
        //   'Zsynchronizowano z Microsoft To Do'
        // );
        // await upsertGoogleImportedTasks(existingTasks, [historyEntry], userId);

        return createdTask;
      } catch (error) {
        console.error('Sync task to Microsoft failed.', error);
        return null;
      }
    },
    [hasMicrosoftTasksToken, selectedMicrosoftTaskListId]
  );

  const importTaskFromMicrosoft = useCallback(
    async (microsoftTask) => {
      if (!manualTasksRef.current || !openTaskColumnId) {
        return null;
      }

      try {
        // TODO: Implement proper task creation from Microsoft Task
        // const newTask = createTaskFromGoogle(microsoftTask, taskList, openTaskColumnId);
        const newTask = null; // Placeholder - needs proper implementation
        // const updatedTasks = [...manualTasksRef.current, newTask];
        // await setManualTasks(updatedTasks);

        // TODO: Add history entry when task history is implemented
        // const historyEntry = createTaskHistoryEntry(
        //   newTask.id,
        //   'imported_from_microsoft',
        //   'Zaimportowano z Microsoft To Do'
        // );
        // await upsertGoogleImportedTasks(existingTasks, [historyEntry], userId);

        return newTask;
      } catch (error) {
        console.error('Import task from Microsoft failed.', error);
        return null;
      }
    },
    [setManualTasks, openTaskColumnId]
  );

  return {
    microsoftEnabled,
    microsoftCalendarStatus,
    outlookCalendarEvents,
    microsoftCalendarMessage,
    microsoftCalendarLastSyncedAt,
    microsoftTasksStatus,
    microsoftTaskLists,
    selectedMicrosoftTaskListId,
    microsoftTasksMessage,
    microsoftTasksLastSyncedAt,
    microsoftButtonRef,
    connectMicrosoftCalendar,
    disconnectMicrosoftCalendar,
    createCalendarEvent,
    updateCalendarEvent,
    connectMicrosoftTasks,
    disconnectMicrosoftTasks,
    syncTaskToMicrosoft,
    importTaskFromMicrosoft,
    setSelectedMicrosoftTaskListId,
  };
}

const CALENDAR_SCOPES = ['Calendars.ReadWrite', 'Calendars.Read'];
const TASKS_SCOPES = ['Tasks.ReadWrite', 'Tasks.Read'];
