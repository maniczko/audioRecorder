import { useEffect, useRef, useState } from "react";
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
} from "../lib/google";
import { createTaskFromGoogle, upsertGoogleImportedTasks } from "../lib/tasks";

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

  const googleButtonRef = useRef(null);
  const googleCalendarTokenRef = useRef("");
  const googleTasksTokenRef = useRef("");
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!currentWorkspaceId) {
      setGoogleCalendarStatus("idle");
      setGoogleCalendarEvents([]);
      setGoogleCalendarMessage("");
      setGoogleTasksStatus("idle");
      setGoogleTaskLists([]);
      setSelectedGoogleTaskListId("");
      setGoogleTasksMessage("");
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

  async function loadGoogleMonthEvents(accessToken, monthDate) {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();
    const payload = await fetchPrimaryCalendarEvents(accessToken, {
      timeMin: monthStart,
      timeMax: monthEnd,
    });
    setGoogleCalendarEvents(payload.items || []);
    setGoogleCalendarStatus("connected");
    setGoogleCalendarMessage("Pobrano wydarzenia z podstawowego kalendarza Google.");
  }

  useEffect(() => {
    if (!googleCalendarTokenRef.current) {
      return;
    }

    loadGoogleMonthEvents(googleCalendarTokenRef.current, calendarMonth).catch((error) => {
      console.error("Google Calendar refresh failed.", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Nie udalo sie odswiezyc wydarzen Google. Polacz kalendarz ponownie.");
    });
  }, [calendarMonth]);

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
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage("Polaczono z Google Tasks.");
    } catch (error) {
      console.error("Google Tasks connect failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie polaczyc z Google Tasks.");
    }
  }

  async function importGoogleTasksFromList() {
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
      setManualTasks((previous) => upsertGoogleImportedTasks(previous, importedTasks, currentUser.id));
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(`Zaimportowano ${importedTasks.length} zadan z Google Tasks.`);
    } catch (error) {
      console.error("Google Tasks import failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie zaimportowac zadan z Google Tasks.");
    }
  }

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
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(`Wyeksportowano ${exportableTasks.length} otwartych zadan do Google Tasks.`);
    } catch (error) {
      console.error("Google Tasks export failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie wyeksportowac zadan do Google Tasks.");
    }
  }

  function resetGoogleSession() {
    setGoogleCalendarEvents([]);
    setGoogleCalendarMessage("");
    setGoogleCalendarStatus("idle");
    setGoogleTaskLists([]);
    setSelectedGoogleTaskListId("");
    setGoogleTasksStatus("idle");
    setGoogleTasksMessage("");
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
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    syncCalendarEntryToGoogle,
    rescheduleGoogleCalendarEntry,
    connectGoogleTasks,
    importGoogleTasksFromList,
    exportTasksToGoogle,
    resetGoogleSession,
    googleCalendarWritable: Boolean(googleCalendarTokenRef.current),
  };
}
