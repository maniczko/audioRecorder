import { useCallback, useMemo } from 'react';
import useWorkspaceData from './useWorkspaceData';
import useMeetingLifecycle from './useMeetingLifecycle';
import useTaskOperations from './useTaskOperations';
import usePeopleProfiles from './usePeopleProfiles';
import useRecordingActions from './useRecordingActions';
import { createMediaService } from '../services/mediaService';
import { createStateService } from '../services/stateService';

import {
  buildTaskColumns,
  buildTasksFromMeetings,
  buildTaskPeople,
  buildTaskTags,
  buildTaskNotifications,
} from '../lib/tasks';
import { buildWorkspaceActivityFeed } from '../lib/activityFeed';
import {
  areCalendarSyncSnapshotsEqual,
  buildCalendarSyncSnapshot,
  createGoogleCalendarConflictState,
} from '../lib/googleSync';

import { useWorkspaceStore, useWorkspaceSelectors } from '../store/workspaceStore';
import { useMeetingsStore } from '../store/meetingsStore';

export default function useMeetings() {
  const { users } = useWorkspaceStore();
  const { currentUser, currentUserId, currentWorkspaceId, currentWorkspaceMembers } =
    useWorkspaceSelectors();

  // 1. Core State & Sync
  const { userMeetings, isHydratingRemoteState, pauseRemotePull } = useWorkspaceData();

  const {
    setMeetings,
    manualTasks,
    setManualTasks,
    taskState,
    setTaskState,
    taskBoards,
    setTaskBoards,
    calendarMeta,
    setCalendarMeta,
    vocabulary,
    setWorkspaceMessage,
  } = useMeetingsStore();
  const stateService = useMemo(() => createStateService(), []);

  // 2. Lifecycle & Drafts
  const lifecycle = useMeetingLifecycle({
    currentUser,
    currentUserId,
    currentWorkspaceId,
    currentWorkspaceMembers,
    userMeetings,
    setMeetings,
    setWorkspaceMessage,
  });

  // 3. Derived Computations
  const taskColumns = useMemo(
    () => buildTaskColumns(taskBoards, currentWorkspaceId),
    [taskBoards, currentWorkspaceId]
  );

  const meetingTasks = useMemo(
    () =>
      buildTasksFromMeetings(
        userMeetings,
        manualTasks,
        taskState,
        currentUser,
        taskColumns,
        currentWorkspaceId
      ),
    [currentUser, currentWorkspaceId, manualTasks, taskColumns, taskState, userMeetings]
  );

  const taskPeople = useMemo(
    () => buildTaskPeople(userMeetings, currentUser, currentWorkspaceMembers, meetingTasks),
    [currentUser, currentWorkspaceMembers, meetingTasks, userMeetings]
  );

  const taskTags = useMemo(
    () => buildTaskTags(meetingTasks, userMeetings),
    [meetingTasks, userMeetings]
  );

  const taskNotifications = useMemo(() => buildTaskNotifications(meetingTasks), [meetingTasks]);

  const workspaceActivity = useMemo(
    () => buildWorkspaceActivityFeed(userMeetings, meetingTasks, currentWorkspaceMembers, users),
    [currentWorkspaceMembers, meetingTasks, userMeetings, users]
  );

  // 4. Specific Operations
  const taskOps = useTaskOperations({
    currentUser,
    currentWorkspaceId,
    taskColumns,
    meetingTasks,
    setManualTasks,
    setTaskState,
    setTaskBoards,
  });

  const peopleProfiles = usePeopleProfiles({
    userMeetings,
    meetingTasks,
    currentUser,
    currentWorkspaceMembers,
  });

  const recordingActions = useRecordingActions({
    currentUser,
    selectedMeeting: lifecycle.selectedMeeting,
    selectedRecording: lifecycle.selectedRecording,
    setMeetings,
    setManualTasks,
    setSelectedMeetingId: lifecycle.setSelectedMeetingId,
    setSelectedRecordingId: lifecycle.setSelectedRecordingId,
  });

  // 5. Google Sync Bridge (remains here as a cross-hook coordinator)
  function updateCalendarEntryMeta(entryType, entryId, updates) {
    const key = `${entryType}:${entryId}`;
    setCalendarMeta((previous) => ({
      ...previous,
      [key]: { ...(previous[key] || {}), ...updates },
    }));
  }

  function applyCalendarSyncSnapshot(entryType, entryId, snapshot, metaUpdates = {}) {
    if (!entryType || !entryId || !snapshot) return;

    const nextStartsAt = snapshot.startsAt || '';
    const nextDurationMinutes = Math.max(
      15,
      Number(snapshot.durationMinutes) ||
        Math.round(
          (new Date(snapshot.endsAt || snapshot.startsAt || 0).getTime() -
            new Date(snapshot.startsAt || 0).getTime()) /
            60000
        ) ||
        15
    );

    if (entryType === 'meeting') {
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id !== entryId
            ? meeting
            : {
                ...meeting,
                title: snapshot.title || meeting.title,
                startsAt: nextStartsAt || meeting.startsAt,
                durationMinutes: nextDurationMinutes || meeting.durationMinutes,
                location:
                  snapshot.location !== undefined
                    ? String(snapshot.location || '').trim()
                    : meeting.location,
                updatedAt: new Date().toISOString(),
              }
        )
      );
    } else if (entryType === 'task') {
      taskOps.updateTask(entryId, {
        title: snapshot.title,
        dueDate: nextStartsAt,
      });
    }

    if (Object.keys(metaUpdates).length) {
      updateCalendarEntryMeta(entryType, entryId, metaUpdates);
    }
  }

  const syncLinkedGoogleCalendarEvents = useCallback(
    (googleEvents) => {
      const eventMap = new Map(
        (Array.isArray(googleEvents) ? googleEvents : []).map((e) => [e.id, e])
      );
      const metaUpdates = {};
      const rememberMetaUpdate = (metaKey, patch) => {
        metaUpdates[metaKey] = { ...(metaUpdates[metaKey] || {}), ...patch };
      };

      setMeetings((prev) =>
        prev.map((m) => {
          const metaKey = `meeting:${m.id}`;
          const meta = calendarMeta?.[metaKey] || {};
          const linkedEventId = meta.googleEventId;
          if (!linkedEventId || m.workspaceId !== currentWorkspaceId) return m;

          const event = eventMap.get(linkedEventId);
          if (!event?.start?.dateTime || !event?.end?.dateTime) return m;

          const localSnapshot = buildCalendarSyncSnapshot(m, { type: 'meeting' });
          const remoteSnapshot = buildCalendarSyncSnapshot(event, { type: 'meeting' });
          const conflict = createGoogleCalendarConflictState({
            entryType: 'meeting',
            localSnapshot,
            remoteSnapshot,
            localUpdatedAt: m.updatedAt || m.createdAt,
            remoteUpdatedAt: event.updated || event.created || event.start.dateTime,
            lastSyncedAt: meta.googleSyncedAt || meta.googlePulledAt || m.createdAt,
          });

          if (conflict) {
            rememberMetaUpdate(metaKey, {
              googleSyncConflict: conflict,
              googleRemoteUpdatedAt: conflict.remoteUpdatedAt,
              googlePulledAt: new Date().toISOString(),
            });
            return m;
          }

          if (areCalendarSyncSnapshotsEqual(localSnapshot, remoteSnapshot)) {
            rememberMetaUpdate(metaKey, {
              googlePulledAt: new Date().toISOString(),
              googleRemoteUpdatedAt: event.updated || event.created || event.start.dateTime,
              googleSyncConflict: null,
            });
            return m;
          }

          rememberMetaUpdate(metaKey, {
            googlePulledAt: new Date().toISOString(),
            googleRemoteUpdatedAt: event.updated || event.created || event.start.dateTime,
            googleSyncConflict: null,
          });

          return {
            ...m,
            title: remoteSnapshot.title || m.title,
            startsAt: remoteSnapshot.startsAt || m.startsAt,
            durationMinutes: remoteSnapshot.durationMinutes || m.durationMinutes,
            location: remoteSnapshot.location || m.location,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      setManualTasks((prev) =>
        prev.map((t) => {
          const metaKey = `task:${t.id}`;
          const meta = calendarMeta?.[metaKey] || {};
          const linkedEventId = meta.googleEventId;
          if (!linkedEventId || t.workspaceId !== currentWorkspaceId) return t;

          const event = eventMap.get(linkedEventId);
          if (!event?.start?.dateTime) return t;

          const localSnapshot = buildCalendarSyncSnapshot(t, { type: 'task' });
          const remoteSnapshot = buildCalendarSyncSnapshot(
            {
              title: event.summary || t.title,
              dueDate: event.start.dateTime,
              startsAt: event.start.dateTime,
              endsAt: event.end?.dateTime || event.start.dateTime,
              durationMinutes: 15,
            },
            { type: 'task' }
          );

          const conflict = createGoogleCalendarConflictState({
            entryType: 'task',
            localSnapshot,
            remoteSnapshot,
            localUpdatedAt: t.updatedAt || t.createdAt,
            remoteUpdatedAt: event.updated || event.created || event.start.dateTime,
            lastSyncedAt: meta.googleSyncedAt || meta.googlePulledAt || t.createdAt,
          });

          if (conflict) {
            rememberMetaUpdate(metaKey, {
              googleSyncConflict: conflict,
              googleRemoteUpdatedAt: conflict.remoteUpdatedAt,
              googlePulledAt: new Date().toISOString(),
            });
            return t;
          }

          if (areCalendarSyncSnapshotsEqual(localSnapshot, remoteSnapshot)) {
            rememberMetaUpdate(metaKey, {
              googlePulledAt: new Date().toISOString(),
              googleRemoteUpdatedAt: event.updated || event.created || event.start.dateTime,
              googleSyncConflict: null,
            });
            return t;
          }

          rememberMetaUpdate(metaKey, {
            googlePulledAt: new Date().toISOString(),
            googleRemoteUpdatedAt: event.updated || event.created || event.start.dateTime,
            googleSyncConflict: null,
          });

          return {
            ...t,
            title: remoteSnapshot.title || t.title,
            dueDate: remoteSnapshot.startsAt || event.start.dateTime,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      if (Object.keys(metaUpdates).length) {
        setCalendarMeta((prev) => {
          const next = { ...prev };
          Object.entries(metaUpdates).forEach(([key, patch]) => {
            next[key] = { ...(prev[key] || {}), ...(patch as any) };
          });
          return next;
        });
      }
    },
    [calendarMeta, currentWorkspaceId, setCalendarMeta, setManualTasks, setMeetings]
  );

  // 6. Final Misc Bridge
  function createManualNote({ title, context, tags }) {
    lifecycle.createMeetingDirect({
      title,
      context: context || '',
      startsAt: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
      durationMinutes: 0,
      attendees: '',
      tags: Array.isArray(tags) && tags.length > 0 ? tags.join('\n') : 'notatka',
      needs: '',
      desiredOutputs: '',
      location: '',
    });
    setWorkspaceMessage('Notatka zapisana.');
  }

  function updateMeeting(meetingId, updates) {
    setMeetings((previous) =>
      previous.map((meeting) =>
        meeting.id !== meetingId
          ? meeting
          : { ...meeting, ...updates, updatedAt: new Date().toISOString() }
      )
    );
  }

  function deleteMeeting(meetingId) {
    setMeetings((previous) => previous.filter((meeting) => meeting.id !== meetingId));
    if (lifecycle.selectedMeetingId === meetingId) {
      lifecycle.resetSelectionState();
    }
  }

  return {
    userMeetings,
    isHydratingRemoteState,
    manualTasks,
    taskState,
    taskBoards,
    calendarMeta,
    setMeetings,
    setManualTasks,
    setTaskState,
    setTaskBoards,
    setCalendarMeta,
    setWorkspaceMessage,
    ...lifecycle,
    ...taskOps,
    ...peopleProfiles,
    ...recordingActions,
    taskColumns,
    meetingTasks,
    taskNotifications,
    workspaceActivity,
    taskPeople,
    taskTags,
    syncLinkedGoogleCalendarEvents,
    applyCalendarSyncSnapshot,
    updateCalendarEntryMeta,
    updateMeeting,
    deleteMeeting,
    createManualNote,
    deleteRecordingAndMeeting: async (meetingId: string) => {
      const meeting = userMeetings.find((m) => m.id === meetingId);
      if (!meeting) return;
      const nextMeetings = userMeetings.filter((m) => m.id !== meetingId);

      // 1. Pause remote polling to prevent race condition
      pauseRemotePull?.(10000);

      // 2. Remove from local state IMMEDIATELY so sync push happens fast
      deleteMeeting(meetingId);

      // 3. Persist meeting deletion immediately in remote mode instead of waiting
      // for the debounced workspace autosave cycle.
      if (stateService?.mode === 'remote' && currentWorkspaceId) {
        try {
          await stateService.syncWorkspaceState(currentWorkspaceId, {
            meetings: nextMeetings,
            manualTasks,
            taskState,
            taskBoards,
            calendarMeta,
            vocabulary,
          });
        } catch (error: any) {
          console.warn('Immediate workspace sync after delete failed:', error);
          setWorkspaceMessage(
            error?.message || 'Nie udalo sie zapisac usuniecia spotkania na backendzie.'
          );
        }
      }

      // 4. Fire-and-forget: clean up server-side recording data
      const recordings = Array.isArray(meeting.recordings) ? meeting.recordings : [];
      if (recordings.length > 0) {
        const media = createMediaService();
        Promise.allSettled(
          recordings.map((rec) =>
            media.deleteRecording
              ? media.deleteRecording(rec.id || rec.recordingId).catch((e) => {
                  if ((e as any)?.status !== 404) {
                    console.warn('Delete recording failed:', e);
                  }
                })
              : Promise.resolve()
          )
        ).catch(() => {});
      }
    },
  };
}
