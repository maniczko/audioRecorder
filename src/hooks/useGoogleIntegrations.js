import { useCallback, useEffect, useRef, useState } from "react";
import {
  GOOGLE_CLIENT_ID,
  buildGoogleCalendarEventPayload,
  createGoogleCalendarEvent,
  createGoogleTask,
  fetchGoogleTaskLists,
  fetchGoogleTasks,
  fetchPrimaryCalendarEvents,
  renderGoogleSignInButton,
  requestGoogleCalendarAccess,
  requestGoogleTasksAccess,
  signOutGoogleSession,
  updateGoogleCalendarEvent,
  updateGoogleTask,
} from "../lib/google";
import { createTaskFromGoogle, createTaskHistoryEntry, upsertGoogleImportedTasks } from "../lib/tasks";

export default function useGoogleIntegrations({
  currentUser,
  currentWorkspaceId,
  calendarMonth,
  taskColumns,
  meetingTasks,
  setManualTasks,
  onGoogleProfile,
  onGoogleError,
}) {
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState("idle");
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [googleCalendarMessage, setGoogleCalendarMessage] = useState("");
  const [googleTasksStatus, setGoogleTasksStatus] = useState("idle");
  const [googleTaskLists, setGoogleTaskLists] = useState([]);
  const [selectedGoogleTaskListId, setSelectedGoogleTaskListId] = useState("");
  const [googleTasksMessage, setGoogleTasksMessage] = useState("");
  const [googleCalendarLastSyncedAt, setGoogleCalendarLastSyncedAt] = useState("");
  const [googleTasksLastSyncedAt, setGoogleTasksLastSyncedAt] = useState("");

  const googleButtonRef = useRef(null);
  const googleCalendarTokenRef = useRef("");
  const googleTasksTokenRef = useRef("");
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID);
  const openTaskColumnId = taskColumns.find((column) => !column.isDone)?.id || taskColumns[0]?.id || "todo";
  const doneTaskColumnId = taskColumns.find((column) => column.isDone)?.id || taskColumns[taskColumns.length - 1]?.id || "done";

  function buildGoogleTaskPayloadFromSnapshot(snapshot) {
    return {
      title: String(snapshot?.title || "").trim() || "VoiceLog task",
      notes: String(snapshot?.notes || "").trim(),
      due: snapshot?.dueDate ? new Date(snapshot.dueDate).toISOString() : undefined,
      status: snapshot?.completed ? "completed" : "needsAction",
    };
  }

  useEffect(() => {
    if (!currentWorkspaceId) {
      setGoogleCalendarStatus("idle");
      setGoogleCalendarEvents([]);
      setGoogleCalendarMessage("");
      setGoogleTasksStatus("idle");
      setGoogleTaskLists([]);
      setSelectedGoogleTaskListId("");
      setGoogleTasksMessage("");
      setGoogleCalendarLastSyncedAt("");
      setGoogleTasksLastSyncedAt("");
      googleCalendarTokenRef.current = "";
      googleTasksTokenRef.current = "";
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    const googleButtonNode = googleButtonRef.current;

    if (currentUser || !googleEnabled || !googleButtonNode) {
      return undefined;
    }

    let active = true;

    renderGoogleSignInButton(googleButtonNode, (profile) => {
      if (!active) {
        return;
      }

      onGoogleProfile(profile);
    }).catch((error) => {
      console.error("Google sign-in render failed.", error);
      if (active) {
        onGoogleError?.("Nie udalo sie zaladowac logowania Google.");
      }
    });

    return () => {
      active = false;
      googleButtonNode.innerHTML = "";
    };
  }, [currentUser, googleEnabled, onGoogleError, onGoogleProfile]);

  const loadGoogleMonthEvents = useCallback(async (accessToken, monthDate) => {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();
    const payload = await fetchPrimaryCalendarEvents(accessToken, {
      timeMin: monthStart,
      timeMax: monthEnd,
    });
    setGoogleCalendarEvents(payload.items || []);
    setGoogleCalendarLastSyncedAt(new Date().toISOString());
    setGoogleCalendarStatus("connected");
    setGoogleCalendarMessage("Pobrano wydarzenia z podstawowego kalendarza Google.");
  }, []);

  useEffect(() => {
    if (!googleCalendarTokenRef.current) {
      return;
    }

    loadGoogleMonthEvents(googleCalendarTokenRef.current, calendarMonth).catch((error) => {
      console.error("Google Calendar refresh failed.", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Nie udalo sie odswiezyc wydarzen Google. Polacz kalendarz ponownie.");
    });
  }, [calendarMonth, loadGoogleMonthEvents]);

  useEffect(() => {
    if (!googleCalendarTokenRef.current) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      loadGoogleMonthEvents(googleCalendarTokenRef.current, calendarMonth).catch((error) => {
        console.error("Google Calendar live refresh failed.", error);
      });
    }, 45000);

    return () => window.clearInterval(timer);
  }, [calendarMonth, loadGoogleMonthEvents]);

  useEffect(
    () => () => {
      signOutGoogleSession();
    },
    []
  );

  async function connectGoogleCalendar() {
    if (!currentUser) {
      return;
    }

    if (!googleEnabled) {
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Dodaj REACT_APP_GOOGLE_CLIENT_ID, aby laczyc Google Calendar.");
      return;
    }

    try {
      setGoogleCalendarStatus("loading");
      setGoogleCalendarMessage("");
      const response = await requestGoogleCalendarAccess({
        loginHint: currentUser.googleEmail || currentUser.email,
      });
      googleCalendarTokenRef.current = response.access_token;
      await loadGoogleMonthEvents(response.access_token, calendarMonth);
    } catch (error) {
      console.error("Google Calendar connect failed.", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Nie udalo sie polaczyc z Google Calendar.");
    }
  }

  function disconnectGoogleCalendar() {
    googleCalendarTokenRef.current = "";
    setGoogleCalendarStatus("idle");
    setGoogleCalendarEvents([]);
    setGoogleCalendarLastSyncedAt("");
    setGoogleCalendarMessage("Polaczenie z Google Calendar zostalo odlaczone.");
  }

  function upsertLocalGoogleEvent(nextEvent) {
    setGoogleCalendarEvents((previous) => {
      const existingIndex = previous.findIndex((event) => event.id === nextEvent.id);
      if (existingIndex === -1) {
        return [...previous, nextEvent].sort(
          (left, right) =>
            new Date(left.start?.dateTime || left.start?.date || 0).getTime() -
            new Date(right.start?.dateTime || right.start?.date || 0).getTime()
        );
      }

      return previous.map((event) => (event.id === nextEvent.id ? nextEvent : event));
    });
  }

  async function syncCalendarEntryToGoogle(entry, options = {}) {
    if (!googleCalendarTokenRef.current) {
      throw new Error("Najpierw polacz Google Calendar.");
    }

    const payload = buildGoogleCalendarEventPayload(entry, options);
    const response = options.googleEventId
      ? await updateGoogleCalendarEvent(googleCalendarTokenRef.current, options.googleEventId, payload)
      : await createGoogleCalendarEvent(googleCalendarTokenRef.current, payload);

    upsertLocalGoogleEvent(response);
    setGoogleCalendarLastSyncedAt(new Date().toISOString());
    setGoogleCalendarStatus("connected");
    setGoogleCalendarMessage(
      options.googleEventId
        ? `Zsynchronizowano wydarzenie "${entry.title}" z Google Calendar.`
        : `Utworzono wydarzenie Google dla "${entry.title}".`
    );

    return response;
  }

  async function rescheduleGoogleCalendarEntry(eventId, startsAt, endsAt) {
    if (!googleCalendarTokenRef.current) {
      throw new Error("Najpierw polacz Google Calendar.");
    }

    const response = await updateGoogleCalendarEvent(googleCalendarTokenRef.current, eventId, {
      start: { dateTime: new Date(startsAt).toISOString() },
      end: { dateTime: new Date(endsAt).toISOString() },
    });
    upsertLocalGoogleEvent(response);
    setGoogleCalendarLastSyncedAt(new Date().toISOString());
    setGoogleCalendarStatus("connected");
    setGoogleCalendarMessage(`Zaktualizowano termin wydarzenia Google "${response.summary || "Event"}".`);
    return response;
  }

  async function connectGoogleTasks() {
    if (!currentUser) {
      return;
    }

    if (!googleEnabled) {
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Dodaj REACT_APP_GOOGLE_CLIENT_ID, aby laczyc Google Tasks.");
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      setGoogleTasksMessage("");
      const response = await requestGoogleTasksAccess({
        loginHint: currentUser.googleEmail || currentUser.email,
      });
      googleTasksTokenRef.current = response.access_token;
      const payload = await fetchGoogleTaskLists(response.access_token);
      const lists = payload.items || [];
      setGoogleTaskLists(lists);
      setSelectedGoogleTaskListId((previous) => previous || lists[0]?.id || "");
      setGoogleTasksLastSyncedAt(new Date().toISOString());
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage("Polaczono z Google Tasks.");
    } catch (error) {
      console.error("Google Tasks connect failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie polaczyc z Google Tasks.");
    }
  }

  const importGoogleTasksFromList = useCallback(async () => {
    if (!currentUser || !googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      const payload = await fetchGoogleTasks(googleTasksTokenRef.current, selectedGoogleTaskListId);
      const selectedList = googleTaskLists.find((list) => list.id === selectedGoogleTaskListId) || {
        id: selectedGoogleTaskListId,
        title: "Google Tasks",
      };
      const importedTasks = (payload.items || []).map((task) =>
        createTaskFromGoogle(currentUser.id, task, selectedList, taskColumns, currentUser, currentWorkspaceId)
      );
      let conflictCount = 0;
      setManualTasks((previous) => {
        const merged = upsertGoogleImportedTasks(previous, importedTasks, currentUser.id);
        conflictCount = merged.filter((task) => task.googleSyncStatus === "conflict").length;
        return merged;
      });
      setGoogleTasksLastSyncedAt(new Date().toISOString());
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(
        conflictCount
          ? `Zaimportowano ${importedTasks.length} zadan z Google Tasks. Wykryto ${conflictCount} konfliktow do rozwiazania.`
          : `Zaimportowano ${importedTasks.length} zadan z Google Tasks.`
      );
    } catch (error) {
      console.error("Google Tasks import failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie zaimportowac zadan z Google Tasks.");
    }
  }, [currentUser, currentWorkspaceId, googleTaskLists, selectedGoogleTaskListId, setManualTasks, taskColumns]);

  const refreshGoogleCalendar = useCallback(async () => {
    if (!googleCalendarTokenRef.current) {
      throw new Error("Najpierw polacz Google Calendar.");
    }

    await loadGoogleMonthEvents(googleCalendarTokenRef.current, calendarMonth);
  }, [calendarMonth, loadGoogleMonthEvents]);

  const refreshGoogleTasks = useCallback(async () => {
    if (!googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      throw new Error("Wybierz i polacz liste Google Tasks.");
    }

    await importGoogleTasksFromList();
  }, [importGoogleTasksFromList, selectedGoogleTaskListId]);

  async function exportTasksToGoogle() {
    if (!googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      const exportableTasks = meetingTasks.filter((task) => task.sourceType !== "google" && !task.completed);
      for (const task of exportableTasks) {
        const notes = [
          task.description,
          task.notes,
          task.tags?.length ? `Tagi: ${task.tags.join(", ")}` : "",
          `Priorytet: ${task.priority}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        await createGoogleTask(googleTasksTokenRef.current, selectedGoogleTaskListId, {
          title: task.title,
          notes,
          due: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
        });
      }
      setGoogleTasksLastSyncedAt(new Date().toISOString());
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(`Wyeksportowano ${exportableTasks.length} otwartych zadan do Google Tasks.`);
    } catch (error) {
      console.error("Google Tasks export failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie wyeksportowac zadan do Google Tasks.");
    }
  }

  const resolveGoogleTaskConflict = useCallback(
    async (taskId, mode, finalSnapshot = null) => {
      const task = meetingTasks.find((item) => item.id === taskId);
      const conflict = task?.googleSyncConflict;
      if (!task || !conflict) {
        return;
      }

      const nextSnapshot =
        mode === "google"
          ? conflict.remoteSnapshot
          : mode === "merge" && finalSnapshot
            ? {
                ...conflict.finalSnapshot,
                ...finalSnapshot,
              }
            : conflict.localSnapshot;
      const now = new Date().toISOString();
      let remoteResponse = null;

      if (mode !== "google") {
        if (!googleTasksTokenRef.current || !task.googleTaskId || !task.googleTaskListId) {
          throw new Error("Najpierw polacz Google Tasks, aby zapisac finalna wersje.");
        }

        remoteResponse = await updateGoogleTask(
          googleTasksTokenRef.current,
          task.googleTaskListId,
          task.googleTaskId,
          buildGoogleTaskPayloadFromSnapshot(nextSnapshot)
        );
      }

      setManualTasks((previous) =>
        previous.map((item) =>
          item.id !== taskId
            ? item
            : {
                ...item,
                title: nextSnapshot.title || item.title,
                dueDate: nextSnapshot.dueDate || "",
                notes: nextSnapshot.notes || "",
                description: nextSnapshot.notes || "",
                completed: Boolean(nextSnapshot.completed),
                status: nextSnapshot.completed ? doneTaskColumnId : openTaskColumnId,
                updatedAt: now,
                googleUpdatedAt:
                  remoteResponse?.updated ||
                  task.googleSyncConflict?.remoteUpdatedAt ||
                  task.googleUpdatedAt ||
                  now,
                googleSyncedAt: now,
                googlePulledAt: now,
                googleLocalUpdatedAt: now,
                googleSyncStatus: "synced",
                googleSyncConflict: null,
                history: [
                  ...(item.history || []),
                  createTaskHistoryEntry(
                    mode === "google"
                      ? "Przyjeto wersje z Google po konflikcie synchronizacji."
                      : mode === "merge"
                        ? "Scalono lokalne i zdalne zmiany po konflikcie synchronizacji."
                        : "Zachowano lokalna wersje zadania i zsynchronizowano ja do Google.",
                    currentUser?.name || currentUser?.email || "Ty",
                    "google_sync"
                  ),
                ],
              }
        )
      );
      setGoogleTasksLastSyncedAt(now);
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(
        mode === "google"
          ? `Przyjeto wersje Google dla "${task.title}".`
          : mode === "merge"
            ? `Scalono konflikt dla "${task.title}".`
            : `Zachowano lokalna wersje "${task.title}" i zapisano ja do Google.`
      );
    },
    [currentUser, doneTaskColumnId, meetingTasks, openTaskColumnId, setManualTasks]
  );

  useEffect(() => {
    if (!currentUser || !googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      return undefined;
    }

    const syncTasksFromGoogle = () => {
      importGoogleTasksFromList().catch((error) => {
        console.error("Google Tasks live refresh failed.", error);
      });
    };

    const timer = window.setInterval(syncTasksFromGoogle, 45000);
    return () => window.clearInterval(timer);
  }, [currentUser, importGoogleTasksFromList, selectedGoogleTaskListId]);

  function resetGoogleSession() {
    setGoogleCalendarEvents([]);
    setGoogleCalendarMessage("");
    setGoogleCalendarStatus("idle");
    setGoogleTaskLists([]);
    setSelectedGoogleTaskListId("");
    setGoogleTasksStatus("idle");
    setGoogleTasksMessage("");
    setGoogleCalendarLastSyncedAt("");
    setGoogleTasksLastSyncedAt("");
    googleCalendarTokenRef.current = "";
    googleTasksTokenRef.current = "";
    signOutGoogleSession();
  }

  return {
    googleEnabled,
    googleButtonRef,
    googleCalendarStatus,
    googleCalendarEvents,
    googleCalendarMessage,
    googleTasksStatus,
    googleTaskLists,
    selectedGoogleTaskListId,
    setSelectedGoogleTaskListId,
    googleTasksMessage,
    googleCalendarLastSyncedAt,
    googleTasksLastSyncedAt,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    refreshGoogleCalendar,
    syncCalendarEntryToGoogle,
    rescheduleGoogleCalendarEntry,
    connectGoogleTasks,
    importGoogleTasksFromList,
    exportTasksToGoogle,
    refreshGoogleTasks,
    resolveGoogleTaskConflict,
    resetGoogleSession,
    googleCalendarWritable: Boolean(googleCalendarTokenRef.current),
  };
}
