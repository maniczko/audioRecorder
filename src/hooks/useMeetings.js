import { useEffect, useMemo, useState } from "react";
import useStoredState from "./useStoredState";
import { normalizeTaskUpdatePayload } from "../lib/appState";
import {
  attachRecording,
  createEmptyMeetingDraft,
  createMeeting,
  meetingToDraft,
  updateMeeting,
  upsertMeeting,
} from "../lib/meeting";
import { buildPeopleProfiles } from "../lib/people";
import { STORAGE_KEYS } from "../lib/storage";
import {
  buildTaskChangeHistory,
  buildTaskColumns,
  buildTaskPeople,
  buildTaskReorderUpdate,
  buildTaskTags,
  buildTasksFromMeetings,
  createManualTask,
  createRecurringTaskFromTask,
  createTaskColumn,
  getNextTaskOrderTop,
  updateTaskColumns,
} from "../lib/tasks";
import { migrateWorkspaceData } from "../lib/workspace";

export default function useMeetings({
  users,
  setUsers,
  workspaces,
  setWorkspaces,
  session,
  setSession,
  currentUser,
  currentUserId,
  currentWorkspaceId,
  currentWorkspaceMembers,
}) {
  const [meetings, setMeetings] = useStoredState(STORAGE_KEYS.meetings, []);
  const [manualTasks, setManualTasks] = useStoredState(STORAGE_KEYS.manualTasks, []);
  const [taskState, setTaskState] = useStoredState(STORAGE_KEYS.taskState, {});
  const [taskBoards, setTaskBoards] = useStoredState(STORAGE_KEYS.taskBoards, {});
  const [calendarMeta, setCalendarMeta] = useStoredState(STORAGE_KEYS.calendarMeta, {});
  const [meetingDraft, setMeetingDraft] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");

  const userMeetings = useMemo(
    () =>
      currentWorkspaceId
        ? [...meetings]
            .filter((meeting) => meeting.workspaceId === currentWorkspaceId)
            .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        : [],
    [currentWorkspaceId, meetings]
  );
  const selectedMeeting = userMeetings.find((meeting) => meeting.id === selectedMeetingId) || null;
  const selectedRecording =
    selectedMeeting?.recordings.find((recording) => recording.id === selectedRecordingId) ||
    selectedMeeting?.recordings[0] ||
    null;
  const taskColumns = buildTaskColumns(taskBoards, currentWorkspaceId);
  const meetingTasks = buildTasksFromMeetings(
    userMeetings,
    manualTasks,
    taskState,
    currentUser,
    taskColumns,
    currentWorkspaceId
  );
  const taskPeople = buildTaskPeople(userMeetings, currentUser, currentWorkspaceMembers, meetingTasks);
  const taskTags = buildTaskTags(meetingTasks, userMeetings);
  const peopleProfiles = buildPeopleProfiles(userMeetings, meetingTasks, currentUser, currentWorkspaceMembers);

  useEffect(() => {
    const migration = migrateWorkspaceData({
      users,
      workspaces,
      meetings,
      manualTasks,
      taskBoards,
      session,
    });

    if (!migration.changed) {
      return;
    }

    setUsers(migration.users);
    setWorkspaces(migration.workspaces);
    setMeetings(migration.meetings);
    setManualTasks(migration.manualTasks);
    setTaskBoards(migration.taskBoards);
    setSession(migration.session);
  }, [
    manualTasks,
    meetings,
    session,
    setManualTasks,
    setMeetings,
    setSession,
    setTaskBoards,
    setUsers,
    setWorkspaces,
    taskBoards,
    users,
    workspaces,
  ]);

  useEffect(() => {
    if (!currentUserId || !currentWorkspaceId) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      setMeetingDraft(createEmptyMeetingDraft());
      return;
    }

    if (!userMeetings.length) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      return;
    }

    const nextSelectedMeeting =
      userMeetings.find((meeting) => meeting.id === selectedMeetingId) || userMeetings[0];
    if (nextSelectedMeeting.id !== selectedMeetingId) {
      setSelectedMeetingId(nextSelectedMeeting.id);
      setSelectedRecordingId(nextSelectedMeeting.latestRecordingId || nextSelectedMeeting.recordings[0]?.id || null);
      setMeetingDraft(meetingToDraft(nextSelectedMeeting));
    }
  }, [currentUserId, currentWorkspaceId, selectedMeetingId, userMeetings]);

  useEffect(() => {
    if (!selectedMeeting) {
      return;
    }

    setMeetingDraft(meetingToDraft(selectedMeeting));
  }, [selectedMeeting]);

  function selectMeeting(meeting) {
    setSelectedMeetingId(meeting.id);
    setSelectedRecordingId(meeting.latestRecordingId || meeting.recordings[0]?.id || null);
    setMeetingDraft(meetingToDraft(meeting));
    setWorkspaceMessage("");
  }

  function createAdHocMeeting() {
    if (!currentUser || !currentWorkspaceId) {
      return null;
    }

    const timestamp = new Date();
    const adHocMeeting = createMeeting(
      currentUser.id,
      {
        title: `Ad hoc ${new Intl.DateTimeFormat("pl-PL", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(timestamp)}`,
        context: "Szybkie nagranie bez wczesniejszego briefu.",
        startsAt: new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .slice(0, 16),
        durationMinutes: 30,
        attendees: currentWorkspaceMembers.map((member) => member.name).filter(Boolean).join("\n"),
        tags: "ad-hoc",
        needs: "",
        desiredOutputs: "",
        location: "",
      },
      {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
      }
    );

    setMeetings((previous) => upsertMeeting(previous, adHocMeeting));
    selectMeeting(adHocMeeting);
    setWorkspaceMessage("Utworzono spotkanie ad hoc.");
    return adHocMeeting;
  }

  function saveMeeting() {
    if (!currentUser || !currentWorkspaceId) {
      return;
    }

    if (!selectedMeeting) {
      const meeting = createMeeting(currentUser.id, meetingDraft, {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
      });
      setMeetings((previous) => upsertMeeting(previous, meeting));
      selectMeeting(meeting);
      setWorkspaceMessage("Spotkanie utworzone.");
      return;
    }

    const nextMeeting = updateMeeting(selectedMeeting, meetingDraft);
    setMeetings((previous) => upsertMeeting(previous, nextMeeting));
    selectMeeting(nextMeeting);
    setWorkspaceMessage("Spotkanie zapisane.");
  }

  function attachCompletedRecording(recordingMeetingId, recording) {
    setMeetings((previous) =>
      previous.map((meeting) => (meeting.id === recordingMeetingId ? attachRecording(meeting, recording) : meeting))
    );
    setSelectedMeetingId(recordingMeetingId);
    setSelectedRecordingId(recording.id);
  }

  function createTaskFromComposer(draft) {
    if (!currentUser || !currentWorkspaceId) {
      return null;
    }

    const task = createManualTask(
      currentUser.id,
      {
        ...draft,
        order: getNextTaskOrderTop(meetingTasks),
      },
      taskColumns,
      currentWorkspaceId
    );
    setManualTasks((previous) => [task, ...previous]);
    return task;
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);
    const updatedAt = new Date().toISOString();
    const actor = currentUser?.name || currentUser?.email || "Ty";
    const nextTask = {
      ...task,
      ...normalizedUpdates,
      updatedAt,
    };
    const nextHistory = [
      ...(normalizedUpdates.history || task.history || []),
      ...buildTaskChangeHistory(task, nextTask, actor, taskColumns),
    ];
    const nextPayload = {
      ...normalizedUpdates,
      history: nextHistory,
      updatedAt,
    };
    const shouldCreateRecurringFollowUp =
      !task.completed && nextPayload.completed && currentUser && currentWorkspaceId && nextTask.recurrence;
    const recurringTask = shouldCreateRecurringFollowUp
      ? createRecurringTaskFromTask(nextTask, currentUser.id, currentWorkspaceId, taskColumns, meetingTasks)
      : null;

    if (task.sourceType === "manual" || task.sourceType === "google") {
      setManualTasks((previous) =>
        [
          ...(recurringTask ? [recurringTask] : []),
          ...previous.map((item) =>
            item.id !== taskId
              ? item
              : {
                  ...item,
                  ...nextPayload,
                }
          ),
        ]
      );
      return;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        ...nextPayload,
      },
    }));

    if (recurringTask) {
      setManualTasks((previous) => [recurringTask, ...previous]);
    }
  }

  function moveTaskToColumn(taskId, columnId) {
    const columnTasks = meetingTasks.filter((task) => task.id !== taskId && task.status === columnId);
    updateTask(taskId, {
      status: columnId,
      order: getNextTaskOrderTop(columnTasks),
    });
  }

  function rescheduleTask(taskId, dueDate) {
    updateTask(taskId, { dueDate });
  }

  function rescheduleMeeting(meetingId, startsAt) {
    setMeetings((previous) =>
      previous.map((meeting) =>
        meeting.id !== meetingId
          ? meeting
          : {
              ...meeting,
              startsAt,
              updatedAt: new Date().toISOString(),
            }
      )
    );
  }

  function updateCalendarEntryMeta(entryType, entryId, updates) {
    const key = `${entryType}:${entryId}`;
    setCalendarMeta((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] || {}),
        ...updates,
      },
    }));
  }

  function reorderTask(taskId, placement) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    updateTask(taskId, buildTaskReorderUpdate(meetingTasks, placement));
  }

  function addTaskColumn(draft) {
    if (!currentWorkspaceId) {
      return;
    }

    setTaskBoards((previous) => createTaskColumn(previous, currentWorkspaceId, draft));
  }

  function changeTaskColumn(columnId, updates) {
    if (!currentWorkspaceId) {
      return;
    }

    const nextColumns = taskColumns.map((column) =>
      column.id === columnId ? { ...column, ...updates } : column
    );
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
  }

  function removeTaskColumn(columnId) {
    if (!currentWorkspaceId) {
      return;
    }

    const column = taskColumns.find((item) => item.id === columnId);
    if (!column) {
      return;
    }

    const fallbackColumnId =
      taskColumns.find((item) => item.id !== columnId && !item.isDone)?.id ||
      taskColumns.find((item) => item.id !== columnId)?.id ||
      columnId;

    meetingTasks
      .filter((task) => task.status === columnId)
      .forEach((task) => {
        updateTask(task.id, { status: fallbackColumnId });
      });

    const nextColumns = taskColumns.filter((item) => item.id !== columnId);
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
  }

  function deleteTask(taskId) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    if (task.sourceType === "manual") {
      setManualTasks((previous) => previous.filter((item) => item.id !== taskId));
      return;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        archived: true,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function renameSpeaker(speakerId, nextValue) {
    if (!selectedMeeting || !selectedRecording) {
      return;
    }

    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== selectedMeeting.id) {
          return meeting;
        }

        return {
          ...meeting,
          speakerNames:
            meeting.latestRecordingId === selectedRecording.id
              ? { ...meeting.speakerNames, [String(speakerId)]: nextValue }
              : meeting.speakerNames,
          recordings: meeting.recordings.map((recording) =>
            recording.id !== selectedRecording.id
              ? recording
              : {
                  ...recording,
                  speakerNames: {
                    ...recording.speakerNames,
                    [String(speakerId)]: nextValue,
                  },
                  analysis: recording.analysis
                    ? {
                        ...recording.analysis,
                        speakerLabels: {
                          ...(recording.analysis.speakerLabels || recording.speakerNames),
                          [String(speakerId)]: nextValue,
                        },
                      }
                    : recording.analysis,
                }
          ),
        };
      })
    );
  }

  function updateTranscriptSegment(segmentId, updates) {
    if (!selectedMeeting || !selectedRecording) {
      return;
    }

    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== selectedMeeting.id) {
          return meeting;
        }

        return {
          ...meeting,
          recordings: meeting.recordings.map((recording) =>
            recording.id !== selectedRecording.id
              ? recording
              : (() => {
                  const transcript = (recording.transcript || []).map((segment) =>
                    segment.id !== segmentId
                      ? segment
                      : {
                          ...segment,
                          ...updates,
                          verificationStatus:
                            updates.verificationStatus ||
                            (updates.text ? "verified" : segment.verificationStatus),
                          verificationReasons:
                            updates.verificationReasons || (updates.text ? [] : segment.verificationReasons),
                        }
                  );
                  return {
                    ...recording,
                    transcript,
                    reviewSummary: {
                      needsReview: transcript.filter(
                        (segment) => segment.verificationStatus === "review"
                      ).length,
                      approved: transcript.filter(
                        (segment) => segment.verificationStatus === "verified"
                      ).length,
                    },
                  };
                })()
          ),
        };
      })
    );
  }

  function resetSelectionState() {
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setMeetingDraft(createEmptyMeetingDraft());
    setWorkspaceMessage("");
  }

  return {
    meetings,
    setMeetings,
    manualTasks,
    setManualTasks,
    taskState,
    setTaskState,
    taskBoards,
    setTaskBoards,
    calendarMeta,
    setCalendarMeta,
    meetingDraft,
    setMeetingDraft,
    selectedMeetingId,
    setSelectedMeetingId,
    selectedRecordingId,
    setSelectedRecordingId,
    selectedMeeting,
    selectedRecording,
    workspaceMessage,
    setWorkspaceMessage,
    userMeetings,
    taskColumns,
    meetingTasks,
    taskPeople,
    taskTags,
    peopleProfiles,
    selectMeeting,
    createAdHocMeeting,
    saveMeeting,
    attachCompletedRecording,
    createTaskFromComposer,
    updateTask,
    moveTaskToColumn,
    rescheduleTask,
    rescheduleMeeting,
    updateCalendarEntryMeta,
    reorderTask,
    addTaskColumn,
    changeTaskColumn,
    removeTaskColumn,
    deleteTask,
    renameSpeaker,
    updateTranscriptSegment,
    resetSelectionState,
  };
}
