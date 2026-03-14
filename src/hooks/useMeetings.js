import { useEffect, useMemo, useRef, useState } from "react";
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
import { createId, STORAGE_KEYS } from "../lib/storage";
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
import { createStateService } from "../services/stateService";

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
  const stateService = useMemo(() => createStateService(), []);
  const syncTimerRef = useRef(null);
  const hydratedWorkspaceIdRef = useRef("");
  const [isHydratingRemoteState, setIsHydratingRemoteState] = useState(
    stateService.mode === "remote" && Boolean(session?.token)
  );

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

  function buildTranscriptReviewSummary(transcript) {
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    return {
      needsReview: safeTranscript.filter((segment) => segment.verificationStatus === "review").length,
      approved: safeTranscript.filter((segment) => segment.verificationStatus === "verified").length,
    };
  }

  function finalizeRecordingTranscript(recording, transcript, overrides = {}) {
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const speakerNames = {
      ...(recording.speakerNames || {}),
      ...(overrides.speakerNames || {}),
    };
    const uniqueSpeakerIds = [...new Set(safeTranscript.map((segment) => String(segment.speakerId)).filter(Boolean))];
    uniqueSpeakerIds.forEach((speakerId) => {
      if (!speakerNames[speakerId]) {
        speakerNames[speakerId] = `Speaker ${Number(speakerId) + 1}`;
      }
    });

    return {
      ...recording,
      ...overrides,
      transcript: safeTranscript,
      speakerNames,
      speakerCount: uniqueSpeakerIds.length,
      reviewSummary: buildTranscriptReviewSummary(safeTranscript),
    };
  }

  function updateSelectedRecording(mutator) {
    if (!selectedMeeting || !selectedRecording) {
      return;
    }

    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== selectedMeeting.id) {
          return meeting;
        }

        let nextSelectedRecording = null;
        const nextRecordings = (meeting.recordings || []).map((recording) => {
          if (recording.id !== selectedRecording.id) {
            return recording;
          }

          nextSelectedRecording = mutator(recording);
          return nextSelectedRecording;
        });

        if (!nextSelectedRecording) {
          return meeting;
        }

        const isLatestRecording = meeting.latestRecordingId === nextSelectedRecording.id;
        return {
          ...meeting,
          recordings: nextRecordings,
          speakerNames: isLatestRecording ? nextSelectedRecording.speakerNames : meeting.speakerNames,
          speakerCount: isLatestRecording ? nextSelectedRecording.speakerCount : meeting.speakerCount,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }

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
    if (stateService.mode !== "remote") {
      hydratedWorkspaceIdRef.current = currentWorkspaceId || "";
      setIsHydratingRemoteState(false);
      return;
    }

    if (!session?.token || !session?.userId) {
      hydratedWorkspaceIdRef.current = "";
      setIsHydratingRemoteState(false);
      return;
    }

    let cancelled = false;
    setIsHydratingRemoteState(true);

    stateService
      .bootstrap(session.workspaceId)
      .then((result) => {
        if (cancelled || !result) {
          return;
        }

        if (Array.isArray(result.users)) {
          setUsers(result.users);
        }
        if (Array.isArray(result.workspaces)) {
          setWorkspaces(result.workspaces);
        }

        const nextState = result.state || {};
        setMeetings(Array.isArray(nextState.meetings) ? nextState.meetings : []);
        setManualTasks(Array.isArray(nextState.manualTasks) ? nextState.manualTasks : []);
        setTaskState(nextState.taskState && typeof nextState.taskState === "object" ? nextState.taskState : {});
        setTaskBoards(nextState.taskBoards && typeof nextState.taskBoards === "object" ? nextState.taskBoards : {});
        setCalendarMeta(
          nextState.calendarMeta && typeof nextState.calendarMeta === "object" ? nextState.calendarMeta : {}
        );

        hydratedWorkspaceIdRef.current = result.workspaceId || session.workspaceId || "";
        if (result.workspaceId && result.workspaceId !== session.workspaceId) {
          setSession((previous) =>
            previous
              ? {
                  ...previous,
                  workspaceId: result.workspaceId,
                }
              : previous
          );
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Remote workspace bootstrap failed.", error);
        setWorkspaceMessage(error.message || "Nie udalo sie pobrac danych workspace z backendu.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingRemoteState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspaceId,
    session?.token,
    session?.userId,
    session?.workspaceId,
    setCalendarMeta,
    setManualTasks,
    setMeetings,
    setSession,
    setTaskBoards,
    setTaskState,
    setUsers,
    setWorkspaces,
    stateService,
  ]);

  useEffect(() => {
    if (stateService.mode !== "remote") {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    if (hydratedWorkspaceIdRef.current !== currentWorkspaceId) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      stateService
        .syncWorkspaceState(currentWorkspaceId, {
          meetings,
          manualTasks,
          taskState,
          taskBoards,
          calendarMeta,
        })
        .catch((error) => {
          console.error("Remote workspace sync failed.", error);
          setWorkspaceMessage(error.message || "Nie udalo sie zapisac workspace na backendzie.");
        });
    }, 350);

    syncTimerRef.current = timeout;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    calendarMeta,
    currentWorkspaceId,
    isHydratingRemoteState,
    manualTasks,
    meetings,
    session?.token,
    stateService,
    taskBoards,
    taskState,
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
    updateSelectedRecording((recording) => {
      const transcript = (recording.transcript || []).map((segment) =>
        segment.id !== segmentId
          ? segment
          : {
              ...segment,
              ...updates,
              verificationStatus:
                updates.verificationStatus ||
                (updates.text ? "verified" : segment.verificationStatus),
              verificationReasons: updates.verificationReasons || (updates.text ? [] : segment.verificationReasons),
            }
      );

      return finalizeRecordingTranscript(recording, transcript);
    });
  }

  function assignSpeakerToTranscriptSegments(segmentIds, nextSpeakerId) {
    const selectedSegmentIds = new Set((Array.isArray(segmentIds) ? segmentIds : []).map(String));
    if (!selectedSegmentIds.size) {
      return;
    }

    updateSelectedRecording((recording) => {
      const transcript = (recording.transcript || []).map((segment) =>
        selectedSegmentIds.has(segment.id)
          ? {
              ...segment,
              speakerId: Number(nextSpeakerId),
              verificationReasons: [
                ...new Set([...(segment.verificationReasons || []), "speaker zmieniony recznie dla zakresu"]),
              ],
            }
          : segment
      );

      return finalizeRecordingTranscript(recording, transcript);
    });
  }

  function mergeTranscriptSegments(segmentIds) {
    const selectedIds = new Set((Array.isArray(segmentIds) ? segmentIds : []).map(String));
    if (selectedIds.size < 2) {
      return;
    }

    updateSelectedRecording((recording) => {
      const transcript = Array.isArray(recording.transcript) ? [...recording.transcript] : [];
      const indexedSegments = transcript
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment }) => selectedIds.has(segment.id));

      if (indexedSegments.length < 2) {
        return recording;
      }

      const sorted = [...indexedSegments].sort((left, right) => left.index - right.index);
      const firstIndex = sorted[0].index;
      const lastIndex = sorted[sorted.length - 1].index;
      const contiguous = sorted.every((item, index) => item.index === firstIndex + index);
      if (!contiguous) {
        return recording;
      }

      const firstSegment = sorted[0].segment;
      const lastSegment = sorted[sorted.length - 1].segment;
      const merged = {
        ...firstSegment,
        text: sorted
          .map(({ segment }) => String(segment.text || "").trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        timestamp: firstSegment.timestamp,
        endTimestamp: lastSegment.endTimestamp || lastSegment.timestamp || firstSegment.endTimestamp || firstSegment.timestamp,
        speakerId: firstSegment.speakerId,
        rawConfidence:
          sorted.reduce((sum, { segment }) => sum + Number(segment.rawConfidence || 0), 0) / sorted.length,
        verificationScore:
          sorted.reduce((sum, { segment }) => sum + Number(segment.verificationScore || 0), 0) / sorted.length,
        verificationStatus: sorted.some(({ segment }) => segment.verificationStatus === "review")
          ? "review"
          : "verified",
        verificationReasons: [
          ...new Set(
            sorted.flatMap(({ segment }) => segment.verificationReasons || []).concat("polaczono recznie z kilku segmentow")
          ),
        ],
        verificationEvidence: {
          comparisonText: sorted
            .map(({ segment }) => segment.verificationEvidence?.comparisonText || "")
            .filter(Boolean)
            .join(" "),
        },
      };

      const nextTranscript = [
        ...transcript.slice(0, firstIndex),
        merged,
        ...transcript.slice(lastIndex + 1),
      ];

      return finalizeRecordingTranscript(recording, nextTranscript);
    });
  }

  function splitTranscriptSegment(segmentId, splitIndex) {
    updateSelectedRecording((recording) => {
      const transcript = Array.isArray(recording.transcript) ? [...recording.transcript] : [];
      const segmentIndex = transcript.findIndex((segment) => segment.id === segmentId);
      if (segmentIndex === -1) {
        return recording;
      }

      const segment = transcript[segmentIndex];
      const text = String(segment.text || "");
      const normalizedSplitIndex = Math.max(1, Math.min(text.length - 1, Number(splitIndex) || Math.floor(text.length / 2)));
      const leftText = text.slice(0, normalizedSplitIndex).trim();
      const rightText = text.slice(normalizedSplitIndex).trim();
      if (!leftText || !rightText) {
        return recording;
      }

      const startTimestamp = Number(segment.timestamp || 0);
      const endTimestamp = Number(segment.endTimestamp || segment.timestamp || startTimestamp + 2) || startTimestamp + 2;
      const splitRatio = normalizedSplitIndex / Math.max(text.length, 1);
      const middleTimestamp = startTimestamp + (endTimestamp - startTimestamp) * splitRatio;
      const baseReasons = [...new Set([...(segment.verificationReasons || []), "podzielono recznie - sprawdz ponownie"])];
      const leftSegment = {
        ...segment,
        text: leftText,
        endTimestamp: middleTimestamp,
        verificationStatus: "review",
        verificationReasons: baseReasons,
      };
      const rightSegment = {
        ...segment,
        id: createId("segment"),
        text: rightText,
        timestamp: middleTimestamp,
        endTimestamp,
        verificationStatus: "review",
        verificationReasons: baseReasons,
      };

      const nextTranscript = [
        ...transcript.slice(0, segmentIndex),
        leftSegment,
        rightSegment,
        ...transcript.slice(segmentIndex + 1),
      ];

      return finalizeRecordingTranscript(recording, nextTranscript);
    });
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
    assignSpeakerToTranscriptSegments,
    mergeTranscriptSegments,
    splitTranscriptSegment,
    resetSelectionState,
  };
}
