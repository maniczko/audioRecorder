import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildWorkspaceActivityFeed } from "../lib/activityFeed";
import { buildPeopleProfiles } from "../lib/people";
import { createId, STORAGE_KEYS } from "../lib/storage";
import {
  areCalendarSyncSnapshotsEqual,
  buildCalendarSyncSnapshot,
  createGoogleCalendarConflictState,
} from "../lib/googleSync";
import {
  buildTaskChangeHistory,
  buildTaskColumns,
  buildTaskNotifications,
  buildTaskPeople,
  buildTaskReorderUpdate,
  buildTaskTags,
  buildTasksFromMeetings,
  createManualTask,
  createRecurringTaskFromTask,
  createTaskColumn,
  getNextTaskOrderTop,
  updateTaskColumns,
  validateTaskCompletion,
  validateTaskDependencies,
} from "../lib/tasks";
import { migrateWorkspaceData } from "../lib/workspace";
import { createStateService } from "../services/stateService";

function serializeWorkspaceState(payload) {
  return JSON.stringify(payload || {});
}

const MEETING_DRAFT_FIELDS = [
  "title",
  "context",
  "startsAt",
  "durationMinutes",
  "attendees",
  "tags",
  "needs",
  "concerns",
  "desiredOutputs",
  "location",
];

function normalizeMeetingDraftValue(draft) {
  const safeDraft = draft && typeof draft === "object" ? draft : createEmptyMeetingDraft();
  return MEETING_DRAFT_FIELDS.reduce((accumulator, field) => {
    accumulator[field] = field === "durationMinutes" ? Number(safeDraft[field]) || 45 : String(safeDraft[field] ?? "");
    return accumulator;
  }, {});
}

function areMeetingDraftsEqual(left, right) {
  return JSON.stringify(normalizeMeetingDraftValue(left)) === JSON.stringify(normalizeMeetingDraftValue(right));
}

function normalizeRecordingMarkers(markers = []) {
  return (Array.isArray(markers) ? markers : [])
    .map((marker, index) => {
      const timestamp = Number(marker?.timestamp);
      if (!Number.isFinite(timestamp) || timestamp < 0) {
        return null;
      }

      return {
        id: String(marker?.id || createId(`marker_${index}`)),
        timestamp,
        label: String(marker?.label || `Marker ${index + 1}`).trim() || `Marker ${index + 1}`,
        note: String(marker?.note || "").trim(),
        createdAt: marker?.createdAt || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp);
}

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
  const [storedMeetingDrafts, setStoredMeetingDrafts] = useStoredState(STORAGE_KEYS.meetingDrafts, {});
  const [personNotes, setPersonNotes] = useStoredState(STORAGE_KEYS.personNotes, {});
  const [meetingDraft, setMeetingDraftState] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [isDetachedMeetingDraft, setIsDetachedMeetingDraft] = useState(false);
  const [hasMeetingDraftChanges, setHasMeetingDraftChanges] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const stateService = useMemo(() => createStateService(), []);
  const syncTimerRef = useRef(null);
  const remotePollTimerRef = useRef(null);
  const hydratedWorkspaceIdRef = useRef("");
  const remoteSnapshotRef = useRef("");
  const restoredDraftWorkspaceRef = useRef("");
  const skipSelectedMeetingDraftSyncRef = useRef("");
  const draftBaselineRef = useRef(createEmptyMeetingDraft());
  const [isHydratingRemoteState, setIsHydratingRemoteState] = useState(
    stateService.mode === "remote" && Boolean(session?.token)
  );
  const setMeetingDraft = useCallback((value) => {
    setHasMeetingDraftChanges(true);
    setMeetingDraftState((previous) => (typeof value === "function" ? value(previous) : value));
  }, []);

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
  const peopleProfiles = useMemo(() => {
    const base = buildPeopleProfiles(userMeetings, meetingTasks, currentUser, currentWorkspaceMembers);
    return base.map((profile) => {
      const overrides = personNotes[profile.id];
      if (!overrides) return profile;
      return {
        ...profile,
        needs: overrides.needs !== undefined ? overrides.needs : profile.needs,
        outputs: overrides.outputs !== undefined ? overrides.outputs : profile.outputs,
      };
    });
  }, [currentUser, currentWorkspaceMembers, meetingTasks, personNotes, userMeetings]);
  const taskNotifications = buildTaskNotifications(meetingTasks);
  const workspaceActivity = useMemo(
    () => buildWorkspaceActivityFeed(userMeetings, meetingTasks, currentWorkspaceMembers, users),
    [currentWorkspaceMembers, meetingTasks, userMeetings, users]
  );
  const activeStoredMeetingDraft = currentWorkspaceId ? storedMeetingDrafts[currentWorkspaceId] || null : null;

  const applyRemoteWorkspaceState = useCallback((result) => {
    if (!result) {
      return;
    }

    if (Array.isArray(result.users)) {
      setUsers(result.users);
    }
    if (Array.isArray(result.workspaces)) {
      setWorkspaces(result.workspaces);
    }

    const nextState = result.state || {};
    const normalizedState = {
      meetings: Array.isArray(nextState.meetings) ? nextState.meetings : [],
      manualTasks: Array.isArray(nextState.manualTasks) ? nextState.manualTasks : [],
      taskState: nextState.taskState && typeof nextState.taskState === "object" ? nextState.taskState : {},
      taskBoards: nextState.taskBoards && typeof nextState.taskBoards === "object" ? nextState.taskBoards : {},
      calendarMeta: nextState.calendarMeta && typeof nextState.calendarMeta === "object" ? nextState.calendarMeta : {},
    };
    const nextSnapshot = serializeWorkspaceState(normalizedState);
    if (nextSnapshot === remoteSnapshotRef.current) {
      return;
    }

    setMeetings(normalizedState.meetings);
    setManualTasks(normalizedState.manualTasks);
    setTaskState(normalizedState.taskState);
    setTaskBoards(normalizedState.taskBoards);
    setCalendarMeta(normalizedState.calendarMeta);
    remoteSnapshotRef.current = nextSnapshot;

    hydratedWorkspaceIdRef.current = result.workspaceId || session?.workspaceId || "";
    if (result.workspaceId && result.workspaceId !== session?.workspaceId) {
      setSession((previous) =>
        previous
          ? {
              ...previous,
              workspaceId: result.workspaceId,
            }
          : previous
      );
    }
  }, [
    session?.workspaceId,
    setCalendarMeta,
    setManualTasks,
    setMeetings,
    setSession,
    setTaskBoards,
    setTaskState,
    setUsers,
    setWorkspaces,
  ]);

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
      markers: normalizeRecordingMarkers(overrides.markers || recording.markers),
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
        applyRemoteWorkspaceState(result);
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
    applyRemoteWorkspaceState,
    session?.token,
    session?.userId,
    session?.workspaceId,
    setSession,
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

    const payload = {
      meetings,
      manualTasks,
      taskState,
      taskBoards,
      calendarMeta,
    };
    const nextSnapshot = serializeWorkspaceState(payload);
    if (nextSnapshot === remoteSnapshotRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      stateService
        .syncWorkspaceState(currentWorkspaceId, payload)
        .then(() => {
          remoteSnapshotRef.current = nextSnapshot;
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
      setIsDetachedMeetingDraft(false);
      const freshDraft = createEmptyMeetingDraft();
      draftBaselineRef.current = freshDraft;
      restoredDraftWorkspaceRef.current = "";
      skipSelectedMeetingDraftSyncRef.current = "";
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(freshDraft);
      return;
    }

    const storedDraft = storedMeetingDrafts[currentWorkspaceId] || null;
    if (storedDraft && restoredDraftWorkspaceRef.current !== currentWorkspaceId) {
      if (storedDraft.selectedMeetingId && !userMeetings.length) {
        return;
      }

      const matchingMeeting = storedDraft.selectedMeetingId
        ? userMeetings.find((meeting) => meeting.id === storedDraft.selectedMeetingId) || null
        : null;
      const baselineDraft = storedDraft.baselineDraft || (matchingMeeting ? meetingToDraft(matchingMeeting) : createEmptyMeetingDraft());
      const nextDraft = normalizeMeetingDraftValue(storedDraft.draft || baselineDraft);

      restoredDraftWorkspaceRef.current = currentWorkspaceId;
      draftBaselineRef.current = baselineDraft;
      skipSelectedMeetingDraftSyncRef.current = matchingMeeting?.id || "";
      setSelectedMeetingId(matchingMeeting?.id || null);
      setSelectedRecordingId(matchingMeeting?.latestRecordingId || matchingMeeting?.recordings[0]?.id || null);
      setIsDetachedMeetingDraft(!matchingMeeting);
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(nextDraft);
      setWorkspaceMessage("Przywrocono ostatni autosave briefu.");
      return;
    }

    if (!userMeetings.length) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      return;
    }

    if (isDetachedMeetingDraft) {
      return;
    }

    const nextSelectedMeeting =
      userMeetings.find((meeting) => meeting.id === selectedMeetingId) || userMeetings[0];
    if (nextSelectedMeeting.id !== selectedMeetingId) {
      const nextDraft = meetingToDraft(nextSelectedMeeting);
      setSelectedMeetingId(nextSelectedMeeting.id);
      setSelectedRecordingId(nextSelectedMeeting.latestRecordingId || nextSelectedMeeting.recordings[0]?.id || null);
      draftBaselineRef.current = nextDraft;
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(nextDraft);
    }
  }, [currentUserId, currentWorkspaceId, isDetachedMeetingDraft, selectedMeetingId, storedMeetingDrafts, userMeetings]);

  useEffect(() => {
    if (!selectedMeeting) {
      return;
    }

    if (skipSelectedMeetingDraftSyncRef.current === selectedMeeting.id) {
      skipSelectedMeetingDraftSyncRef.current = "";
      return;
    }

    const nextDraft = meetingToDraft(selectedMeeting);
    draftBaselineRef.current = nextDraft;
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
  }, [selectedMeeting]);

  useEffect(() => {
    if (!currentWorkspaceId) {
      return;
    }

    const baselineDraft = selectedMeeting ? meetingToDraft(selectedMeeting) : draftBaselineRef.current;
    const hasDraftChanges = !areMeetingDraftsEqual(meetingDraft, baselineDraft);
    if (!hasMeetingDraftChanges && !activeStoredMeetingDraft) {
      return;
    }

    setStoredMeetingDrafts((previous) => {
      const next = { ...previous };
      if (!hasDraftChanges) {
        if (!next[currentWorkspaceId]) {
          return previous;
        }
        delete next[currentWorkspaceId];
        return next;
      }

      const currentEntry = next[currentWorkspaceId];
      const normalizedDraft = normalizeMeetingDraftValue(meetingDraft);
      const normalizedBaselineDraft = normalizeMeetingDraftValue(baselineDraft);
      if (
        currentEntry &&
        areMeetingDraftsEqual(currentEntry.draft, normalizedDraft) &&
        areMeetingDraftsEqual(currentEntry.baselineDraft, normalizedBaselineDraft) &&
        String(currentEntry.selectedMeetingId || "") === String(selectedMeeting?.id || "")
      ) {
        return previous;
      }

      next[currentWorkspaceId] = {
        draft: normalizedDraft,
        baselineDraft: normalizedBaselineDraft,
        selectedMeetingId: selectedMeeting?.id || "",
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
  }, [
    currentWorkspaceId,
    hasMeetingDraftChanges,
    meetingDraft,
    selectedMeeting,
    activeStoredMeetingDraft,
    setStoredMeetingDrafts,
  ]);

  function selectMeeting(meeting) {
    setSelectedMeetingId(meeting.id);
    setSelectedRecordingId(meeting.latestRecordingId || meeting.recordings[0]?.id || null);
    setIsDetachedMeetingDraft(false);
    const nextDraft = meetingToDraft(meeting);
    draftBaselineRef.current = nextDraft;
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    setWorkspaceMessage("");
  }

  function startNewMeetingDraft(prefill = null) {
    const freshDraft = createEmptyMeetingDraft();
    let nextDraft = freshDraft;
    if (prefill) {
      nextDraft = {
        ...freshDraft,
        ...(prefill.title ? { title: prefill.title } : {}),
        ...(prefill.context ? { context: prefill.context } : {}),
      };
      if (prefill.startsAt) {
        const d = new Date(prefill.startsAt);
        nextDraft.startsAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
    }
    restoredDraftWorkspaceRef.current = currentWorkspaceId || "";
    draftBaselineRef.current = nextDraft;
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setIsDetachedMeetingDraft(true);
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    if (currentWorkspaceId) {
      setStoredMeetingDrafts((previous) => {
        if (!previous[currentWorkspaceId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[currentWorkspaceId];
        return next;
      });
    }
  }

  function clearMeetingDraft() {
    const nextDraft = selectedMeeting ? meetingToDraft(selectedMeeting) : createEmptyMeetingDraft();
    draftBaselineRef.current = nextDraft;
    restoredDraftWorkspaceRef.current = currentWorkspaceId || "";
    if (!selectedMeeting) {
      setIsDetachedMeetingDraft(true);
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
    }
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    setWorkspaceMessage(selectedMeeting ? "Przywrocono ostatnia zapisana wersje spotkania." : "Wyczyszczono draft spotkania.");
    if (currentWorkspaceId) {
      setStoredMeetingDrafts((previous) => {
        if (!previous[currentWorkspaceId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[currentWorkspaceId];
        return next;
      });
    }
  }

  function createManualNote({ title, context, tags }) {
    if (!currentUser || !currentWorkspaceId || !title) return;
    const now = new Date();
    const noteTags = Array.isArray(tags) && tags.length > 0 ? tags.join("\n") : "notatka";
    const note = createMeeting(
      currentUser.id,
      {
        title,
        context: context || "",
        startsAt: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        durationMinutes: 0,
        attendees: "",
        tags: noteTags,
        needs: "",
        desiredOutputs: "",
        location: "",
      },
      {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
        createdByUserName: currentUser.name || currentUser.email || "Ty",
      }
    );
    setMeetings((previous) => upsertMeeting(previous, note));
    setWorkspaceMessage("Notatka zapisana.");
  }

  function renameTag(oldTag, newTag) {
    const normalized = newTag.trim().toLowerCase();
    if (!normalized || normalized === oldTag) return;
    setMeetings((prev) =>
      prev.map((m) => ({ ...m, tags: (m.tags || []).map((t) => (t === oldTag ? normalized : t)) }))
    );
    setManualTasks((prev) =>
      prev.map((t) => ({ ...t, tags: (t.tags || []).map((tag) => (tag === oldTag ? normalized : tag)) }))
    );
  }

  function deleteTag(tag) {
    setMeetings((prev) =>
      prev.map((m) => ({ ...m, tags: (m.tags || []).filter((t) => t !== tag) }))
    );
    setManualTasks((prev) =>
      prev.map((t) => ({ ...t, tags: (t.tags || []).filter((existing) => existing !== tag) }))
    );
  }

  function updatePersonNotes(personId, patches) {
    setPersonNotes((prev) => ({
      ...prev,
      [personId]: { ...(prev[personId] || {}), ...patches },
    }));
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
        createdByUserName: currentUser.name || currentUser.email || "Ty",
      }
    );

    setMeetings((previous) => upsertMeeting(previous, adHocMeeting));
    selectMeeting(adHocMeeting);
    setWorkspaceMessage("Utworzono spotkanie ad hoc.");
    return adHocMeeting;
  }

  function saveMeeting(draftOverride) {
    if (!currentUser || !currentWorkspaceId) {
      return;
    }

    if (!selectedMeeting) {
      const meeting = createMeeting(currentUser.id, meetingDraft, {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
        createdByUserName: currentUser.name || currentUser.email || "Ty",
      });
      setMeetings((previous) => upsertMeeting(previous, meeting));
      setIsDetachedMeetingDraft(false);
      selectMeeting(meeting);
      return;
    }

    const nextMeeting = {
      ...updateMeeting(selectedMeeting, (draftOverride || meetingDraft)),
      activity: [
        ...(selectedMeeting.activity || []),
        {
          id: createId("meeting_activity"),
          type: "updated",
          actorId: currentUser.id,
          actorName: currentUser.name || currentUser.email || "Ty",
          message: "Zmieniono brief spotkania.",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setMeetings((previous) => upsertMeeting(previous, nextMeeting));
    setIsDetachedMeetingDraft(false);
    selectMeeting(nextMeeting);
  }

  function createMeetingDirect(draft) {
    if (!currentUser || !currentWorkspaceId) {
      return null;
    }
    const meeting = createMeeting(currentUser.id, draft, {
      workspaceId: currentWorkspaceId,
      createdByUserId: currentUser.id,
      createdByUserName: currentUser.name || currentUser.email || "Ty",
    });
    setMeetings((previous) => upsertMeeting(previous, meeting));
    return meeting;
  }

  function attachCompletedRecording(recordingMeetingId, recording) {
    setMeetings((previous) =>
      previous.map((meeting) =>
        meeting.id === recordingMeetingId
          ? {
              ...attachRecording(meeting, recording),
              activity: [
                ...(meeting.activity || []),
                {
                  id: createId("meeting_activity"),
                  type: "recording",
                  actorId: currentUser?.id || "",
                  actorName: currentUser?.name || currentUser?.email || "Ty",
                  message: "Dodano nowe nagranie do spotkania.",
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : meeting
      )
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

  function prepareTaskMutation(task, updates, taskCollection = meetingTasks) {
    const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);
    if (normalizedUpdates.dependencies !== undefined) {
      validateTaskDependencies(task.id, normalizedUpdates.dependencies, taskCollection);
    }
    validateTaskCompletion(task, normalizedUpdates, taskCollection, taskColumns);

    const updatedAt = new Date().toISOString();
    const actor = currentUser?.name || currentUser?.email || "Ty";
    const nextTask = {
      ...task,
      ...normalizedUpdates,
      ...(task.googleTaskId && updates.googleSyncStatus === undefined
        ? {
            googleSyncStatus: "local_changes",
            googleLocalUpdatedAt: updatedAt,
            googleSyncConflict: null,
          }
        : {}),
      updatedAt,
    };
    const syncPayload =
      task.googleTaskId && updates.googleSyncStatus === undefined
        ? {
            googleSyncStatus: "local_changes",
            googleLocalUpdatedAt: updatedAt,
            googleSyncConflict: null,
          }
        : {};
    const nextHistory = [
      ...(normalizedUpdates.history || task.history || []),
      ...buildTaskChangeHistory(task, nextTask, actor, taskColumns),
    ];
    const nextPayload = {
      ...normalizedUpdates,
      ...syncPayload,
      history: nextHistory,
      updatedAt,
    };
    const shouldCreateRecurringFollowUp =
      !task.completed && nextPayload.completed && currentUser && currentWorkspaceId && nextTask.recurrence;

    return {
      task,
      nextTask,
      nextPayload,
      recurringTask: shouldCreateRecurringFollowUp
        ? createRecurringTaskFromTask(nextTask, currentUser.id, currentWorkspaceId, taskColumns, taskCollection)
        : null,
    };
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return null;
    }

    const { nextPayload, nextTask, recurringTask } = prepareTaskMutation(task, updates);

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
      return nextTask;
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

    return nextTask;
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

  function applyCalendarSyncSnapshot(entryType, entryId, snapshot, metaUpdates = {}) {
    if (!entryType || !entryId || !snapshot) {
      return;
    }

    const nextStartsAt = snapshot.startsAt || "";
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

    if (entryType === "meeting") {
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
                    ? String(snapshot.location || "").trim()
                    : meeting.location,
                updatedAt: new Date().toISOString(),
              }
        )
      );
    } else if (entryType === "task") {
      updateTask(entryId, {
        title: snapshot.title,
        dueDate: nextStartsAt,
      });
    }

    if (Object.keys(metaUpdates).length) {
      updateCalendarEntryMeta(entryType, entryId, metaUpdates);
    }
  }

  const syncLinkedGoogleCalendarEvents = useCallback((googleEvents) => {
    const eventMap = new Map((Array.isArray(googleEvents) ? googleEvents : []).map((event) => [event.id, event]));
    const metaUpdates = {};
    const rememberMetaUpdate = (metaKey, patch) => {
      metaUpdates[metaKey] = {
        ...(metaUpdates[metaKey] || {}),
        ...patch,
      };
    };

    setMeetings((previous) =>
      previous.map((meeting) => {
        const metaKey = `meeting:${meeting.id}`;
        const meta = calendarMeta?.[metaKey] || {};
        const linkedEventId = meta.googleEventId;
        if (!linkedEventId || meeting.workspaceId !== currentWorkspaceId) {
          return meeting;
        }

        const linkedEvent = eventMap.get(linkedEventId);
        if (!linkedEvent?.start?.dateTime || !linkedEvent?.end?.dateTime) {
          return meeting;
        }

        const localSnapshot = buildCalendarSyncSnapshot(meeting, { type: "meeting" });
        const remoteSnapshot = buildCalendarSyncSnapshot(linkedEvent, { type: "meeting" });
        const conflict = createGoogleCalendarConflictState({
          entryType: "meeting",
          localSnapshot,
          remoteSnapshot,
          localUpdatedAt: meeting.updatedAt || meeting.createdAt,
          remoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
          lastSyncedAt: meta.googleSyncedAt || meta.googlePulledAt || meeting.createdAt,
        });
        if (conflict) {
          rememberMetaUpdate(metaKey, {
            googleSyncConflict: conflict,
            googleRemoteUpdatedAt: conflict.remoteUpdatedAt,
            googlePulledAt: new Date().toISOString(),
          });
          return meeting;
        }

        if (areCalendarSyncSnapshotsEqual(localSnapshot, remoteSnapshot)) {
          rememberMetaUpdate(metaKey, {
            googlePulledAt: new Date().toISOString(),
            googleRemoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
            googleSyncConflict: null,
          });
          return meeting;
        }

        rememberMetaUpdate(metaKey, {
          googlePulledAt: new Date().toISOString(),
          googleRemoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
          googleSyncConflict: null,
        });
        return {
          ...meeting,
          title: remoteSnapshot.title || meeting.title,
          startsAt: remoteSnapshot.startsAt || meeting.startsAt,
          durationMinutes: remoteSnapshot.durationMinutes || meeting.durationMinutes,
          location: remoteSnapshot.location || meeting.location,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    setManualTasks((previous) =>
      previous.map((task) => {
        const metaKey = `task:${task.id}`;
        const meta = calendarMeta?.[metaKey] || {};
        const linkedEventId = meta.googleEventId;
        if (!linkedEventId || task.workspaceId !== currentWorkspaceId) {
          return task;
        }

        const linkedEvent = eventMap.get(linkedEventId);
        if (!linkedEvent?.start?.dateTime) {
          return task;
        }

        const localSnapshot = buildCalendarSyncSnapshot(task, { type: "task" });
        const remoteSnapshot = buildCalendarSyncSnapshot(
          {
            title: linkedEvent.summary || task.title,
            dueDate: linkedEvent.start.dateTime,
            startsAt: linkedEvent.start.dateTime,
            endsAt: linkedEvent.end?.dateTime || linkedEvent.start.dateTime,
            durationMinutes: 15,
          },
          { type: "task" }
        );
        const conflict = createGoogleCalendarConflictState({
          entryType: "task",
          localSnapshot,
          remoteSnapshot,
          localUpdatedAt: task.updatedAt || task.createdAt,
          remoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
          lastSyncedAt: meta.googleSyncedAt || meta.googlePulledAt || task.createdAt,
        });
        if (conflict) {
          rememberMetaUpdate(metaKey, {
            googleSyncConflict: conflict,
            googleRemoteUpdatedAt: conflict.remoteUpdatedAt,
            googlePulledAt: new Date().toISOString(),
          });
          return task;
        }

        if (areCalendarSyncSnapshotsEqual(localSnapshot, remoteSnapshot)) {
          rememberMetaUpdate(metaKey, {
            googlePulledAt: new Date().toISOString(),
            googleRemoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
            googleSyncConflict: null,
          });
          return task;
        }

        rememberMetaUpdate(metaKey, {
          googlePulledAt: new Date().toISOString(),
          googleRemoteUpdatedAt: linkedEvent.updated || linkedEvent.created || linkedEvent.start.dateTime,
          googleSyncConflict: null,
        });
        return {
          ...task,
          title: remoteSnapshot.title || task.title,
          dueDate: remoteSnapshot.startsAt || linkedEvent.start.dateTime,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    if (Object.keys(metaUpdates).length) {
      setCalendarMeta((previous) => {
        const nextMeta = { ...previous };
        Object.entries(metaUpdates).forEach(([metaKey, patch]) => {
          nextMeta[metaKey] = {
            ...(nextMeta[metaKey] || {}),
            ...patch,
          };
        });
        return nextMeta;
      });
    }
  }, [calendarMeta, currentWorkspaceId, setCalendarMeta, setManualTasks, setMeetings]);

  function reorderTask(taskId, placement) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    updateTask(taskId, buildTaskReorderUpdate(meetingTasks, placement));
  }

  function bulkUpdateTasks(taskIds, updates) {
    const selectedIds = [...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean))];
    if (!selectedIds.length) {
      return;
    }

    const selectedSet = new Set(selectedIds);
    const futureTaskMap = new Map(
      meetingTasks.map((task) => {
        if (!selectedSet.has(task.id)) {
          return [task.id, task];
        }

        const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);
        return [
          task.id,
          {
            ...task,
            ...normalizedUpdates,
          },
        ];
      })
    );
    const futureTasks = meetingTasks.map((task) => futureTaskMap.get(task.id) || task);

    const mutations = selectedIds
      .map((taskId) => meetingTasks.find((task) => task.id === taskId))
      .filter(Boolean)
      .map((task) => prepareTaskMutation(task, updates, futureTasks));

    const recurringTasks = mutations.map((mutation) => mutation.recurringTask).filter(Boolean);
    const manualPayloads = new Map(
      mutations
        .filter(({ task }) => task.sourceType === "manual" || task.sourceType === "google")
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );
    const derivedPayloads = Object.fromEntries(
      mutations
        .filter(({ task }) => task.sourceType !== "manual" && task.sourceType !== "google")
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );

    if (manualPayloads.size) {
      setManualTasks((previous) => [
        ...recurringTasks,
        ...previous.map((item) =>
          manualPayloads.has(item.id)
            ? {
                ...item,
                ...manualPayloads.get(item.id),
              }
            : item
        ),
      ]);
    } else if (recurringTasks.length) {
      setManualTasks((previous) => [...recurringTasks, ...previous]);
    }

    if (Object.keys(derivedPayloads).length) {
      setTaskState((previous) => {
        const nextState = { ...previous };
        Object.entries(derivedPayloads).forEach(([taskId, nextPayload]) => {
          nextState[taskId] = {
            ...(previous[taskId] || {}),
            ...nextPayload,
          };
        });
        return nextState;
      });
    }
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

  function bulkDeleteTasks(taskIds) {
    [...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean))].forEach((taskId) => {
      deleteTask(taskId);
    });
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

  function addRecordingMarker(marker) {
    if (!selectedRecording) {
      return;
    }

    updateSelectedRecording((recording) => {
      const nextMarkers = normalizeRecordingMarkers([
        ...(recording.markers || []),
        {
          id: createId("marker"),
          timestamp: marker?.timestamp,
          label: marker?.label,
          note: marker?.note,
          createdAt: new Date().toISOString(),
        },
      ]);

      return finalizeRecordingTranscript(recording, recording.transcript || [], {
        markers: nextMarkers,
      });
    });
  }

  function updateRecordingMarker(markerId, updates) {
    if (!selectedRecording || !markerId) {
      return;
    }

    updateSelectedRecording((recording) => {
      const nextMarkers = normalizeRecordingMarkers(
        (recording.markers || []).map((marker) =>
          marker.id !== markerId
            ? marker
            : {
                ...marker,
                ...updates,
              }
        )
      );

      return finalizeRecordingTranscript(recording, recording.transcript || [], {
        markers: nextMarkers,
      });
    });
  }

  function deleteRecordingMarker(markerId) {
    if (!selectedRecording || !markerId) {
      return;
    }

    updateSelectedRecording((recording) =>
      finalizeRecordingTranscript(recording, recording.transcript || [], {
        markers: normalizeRecordingMarkers((recording.markers || []).filter((marker) => marker.id !== markerId)),
      })
    );
  }

  function addMeetingComment(meetingId, text, authorName) {
    const now = new Date().toISOString();
    const comment = {
      id: createId("comment"),
      text: String(text || "").trim(),
      author: String(authorName || "Ty"),
      createdAt: now,
      mentions: (String(text || "").match(/@(\w+)/g) || []).map((m) => m.slice(1)),
    };
    const activityEntry = {
      id: createId("meeting_activity"),
      type: "comment",
      actorName: String(authorName || "Ty"),
      message: String(text || "").length > 80 ? String(text || "").slice(0, 77) + "..." : String(text || ""),
      createdAt: now,
    };
    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== meetingId) return meeting;
        return {
          ...meeting,
          comments: [...(Array.isArray(meeting.comments) ? meeting.comments : []), comment],
          activity: [...(Array.isArray(meeting.activity) ? meeting.activity : []), activityEntry],
        };
      })
    );
  }

  function resetSelectionState() {
    const freshDraft = createEmptyMeetingDraft();
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setIsDetachedMeetingDraft(false);
    draftBaselineRef.current = freshDraft;
    restoredDraftWorkspaceRef.current = "";
    skipSelectedMeetingDraftSyncRef.current = "";
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(freshDraft);
    setWorkspaceMessage("");
  }

  useEffect(() => {
    if (stateService.mode !== "remote") {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    const pullRemoteWorkspaceState = () => {
      stateService
        .bootstrap(currentWorkspaceId)
        .then((result) => {
          if (!result?.state) {
            return;
          }

          const normalizedState = {
            meetings: Array.isArray(result.state.meetings) ? result.state.meetings : [],
            manualTasks: Array.isArray(result.state.manualTasks) ? result.state.manualTasks : [],
            taskState: result.state.taskState && typeof result.state.taskState === "object" ? result.state.taskState : {},
            taskBoards: result.state.taskBoards && typeof result.state.taskBoards === "object" ? result.state.taskBoards : {},
            calendarMeta:
              result.state.calendarMeta && typeof result.state.calendarMeta === "object" ? result.state.calendarMeta : {},
          };
          const incomingSnapshot = serializeWorkspaceState(normalizedState);
          if (incomingSnapshot === remoteSnapshotRef.current) {
            return;
          }

          applyRemoteWorkspaceState(result);
        })
        .catch((error) => {
          console.error("Remote workspace pull failed.", error);
        });
    };

    remotePollTimerRef.current = window.setInterval(() => {
      if (document?.visibilityState === "hidden") {
        return;
      }

      pullRemoteWorkspaceState();
    }, 5000);

    return () => {
      window.clearInterval(remotePollTimerRef.current);
    };
  }, [applyRemoteWorkspaceState, currentWorkspaceId, isHydratingRemoteState, session?.token, stateService]);

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
    activeStoredMeetingDraft,
    isDetachedMeetingDraft,
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
    taskNotifications,
    workspaceActivity,
    taskPeople,
    taskTags,
    peopleProfiles,
    selectMeeting,
    startNewMeetingDraft,
    createManualNote,
    renameTag,
    deleteTag,
    updatePersonNotes,
    clearMeetingDraft,
    createAdHocMeeting,
    saveMeeting,
    createMeetingDirect,
    attachCompletedRecording,
    createTaskFromComposer,
    updateTask,
    bulkUpdateTasks,
    moveTaskToColumn,
    rescheduleTask,
    rescheduleMeeting,
    updateCalendarEntryMeta,
    applyCalendarSyncSnapshot,
    syncLinkedGoogleCalendarEvents,
    reorderTask,
    addTaskColumn,
    changeTaskColumn,
    removeTaskColumn,
    deleteTask,
    bulkDeleteTasks,
    renameSpeaker,
    updateTranscriptSegment,
    assignSpeakerToTranscriptSegments,
    mergeTranscriptSegments,
    splitTranscriptSegment,
    addRecordingMarker,
    updateRecordingMarker,
    deleteRecordingMarker,
    addMeetingComment,
    resetSelectionState,
  };
}
