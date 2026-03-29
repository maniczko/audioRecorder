```typescript
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
import {
  createTaskFromGoogle,
  createTaskHistoryEntry,
  upsertGoogleImportedTasks,
} from '../lib/tasks';

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
    // Additional logic can be added here
  }, [currentUser, microsoftEnabled]);

  return {
    microsoftCalendarStatus,
    outlookCalendarEvents,
    microsoftCalendarMessage,
    microsoftTasksStatus,
    microsoftTaskLists,
    selectedMicrosoftTaskListId,
    microsoftTasksMessage,
    microsoftCalendarLastSyncedAt,
    microsoftTasksLastSyncedAt,
  };
}
```