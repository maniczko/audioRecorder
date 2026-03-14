import { createId } from "./storage";

export const TASK_STATUSES = [
  { id: "todo", label: "Do zrobienia", shortLabel: "Todo" },
  { id: "in_progress", label: "W toku", shortLabel: "W toku" },
  { id: "waiting", label: "Oczekuje", shortLabel: "Czeka" },
  { id: "done", label: "Gotowe", shortLabel: "Done" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(items) {
  return [...new Set(safeArray(items).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeOwner(owner, candidates) {
  const cleaned = normalizeWhitespace(owner);
  if (!cleaned) {
    return "";
  }

  const match = safeArray(candidates).find((candidate) => candidate.toLowerCase() === cleaned.toLowerCase());
  return match || cleaned;
}

function statusFromValue(value) {
  return TASK_STATUSES.some((status) => status.id === value) ? value : "todo";
}

function matchesCurrentUser(owner, currentUser) {
  const normalizedOwner = normalizeWhitespace(owner).toLowerCase();
  if (!normalizedOwner || !currentUser) {
    return false;
  }

  const signals = uniqueStrings([
    currentUser.name,
    currentUser.email,
    currentUser.googleEmail,
  ]).map((item) => item.toLowerCase());

  return signals.some(
    (signal) => normalizedOwner.includes(signal) || signal.includes(normalizedOwner)
  );
}

function knownOwnersForMeeting(meeting) {
  return uniqueStrings([
    ...safeArray(meeting.attendees),
    ...Object.values(meeting.speakerNames || {}),
    ...Object.values(meeting.analysis?.speakerLabels || {}),
    ...safeArray(meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))),
  ]);
}

function inferOwner(text, candidates) {
  const normalized = normalizeWhitespace(text);
  const prefixMatch = normalized.match(/^([^:]{2,40}):\s*(.+)$/);
  if (prefixMatch) {
    return {
      owner: normalizeOwner(prefixMatch[1], candidates),
      title: normalizeWhitespace(prefixMatch[2]),
    };
  }

  const lower = normalized.toLowerCase();
  const candidate = safeArray(candidates).find((item) => {
    const name = String(item || "").trim().toLowerCase();
    return name && lower.includes(name);
  });

  return {
    owner: candidate || "",
    title: normalized,
  };
}

function titleCase(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function taskFromCandidate(candidate, meeting, index) {
  const candidates = knownOwnersForMeeting(meeting);
  const ownerHint = normalizeOwner(candidate.owner, candidates);
  const parsed = inferOwner(candidate.title || candidate.text || "", candidates);
  const owner = ownerHint || parsed.owner || "Nieprzypisane";
  const title = titleCase(parsed.title || candidate.title || candidate.text || "");

  if (!title) {
    return null;
  }

  return {
    id: `${meeting.id}::task::${index}`,
    title,
    owner,
    description: normalizeWhitespace(candidate.description || ""),
    dueDate: meeting.startsAt || "",
    sourceType: "meeting",
    sourceMeetingId: meeting.id,
    sourceMeetingTitle: meeting.title,
    sourceMeetingDate: meeting.startsAt,
    sourceRecordingId: meeting.latestRecordingId || "",
    sourceQuote: candidate.sourceQuote || "",
    createdAt: meeting.updatedAt || meeting.createdAt,
    status: "todo",
    important: false,
    completed: false,
    notes: candidate.sourceQuote || "",
  };
}

function fallbackTaskCandidates(meeting) {
  const analysis = meeting.analysis || {};
  return safeArray(analysis.actionItems).map((item) => ({
    title: item,
    owner: "",
    sourceQuote: item,
  }));
}

function mergeTaskState(task, state, currentUser) {
  const nextStatus = statusFromValue(
    state?.status || (state?.completed === true ? "done" : "") || task.status
  );
  const completed = typeof state?.completed === "boolean" ? state.completed : nextStatus === "done";
  const owner = state?.owner ?? task.owner;
  const title = state?.title ?? task.title;
  const description = state?.description ?? task.description ?? "";
  const dueDate = state?.dueDate ?? task.dueDate ?? "";
  const notes = state?.notes ?? task.notes ?? "";

  return {
    ...task,
    title,
    owner: normalizeWhitespace(owner) || "Nieprzypisane",
    description,
    dueDate,
    notes,
    updatedAt: state?.updatedAt || task.updatedAt || task.createdAt,
    important: typeof state?.important === "boolean" ? state.important : Boolean(task.important),
    status: completed ? "done" : nextStatus,
    completed,
    archived: Boolean(state?.archived),
    assignedToMe: matchesCurrentUser(owner, currentUser),
  };
}

export function buildTaskPeople(meetings, currentUser) {
  return uniqueStrings([
    currentUser?.name,
    currentUser?.email,
    currentUser?.googleEmail,
    ...safeArray(meetings).flatMap((meeting) => [
      ...safeArray(meeting.attendees),
      ...Object.values(meeting.speakerNames || {}),
      ...Object.values(meeting.analysis?.speakerLabels || {}),
      ...safeArray(meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))),
    ]),
  ]);
}

export function createManualTask(userId, draft) {
  const now = new Date().toISOString();
  const title = titleCase(draft.title);

  if (!title) {
    throw new Error("Dodaj tytul zadania.");
  }

  return {
    id: createId("task"),
    userId,
    title,
    owner: normalizeWhitespace(draft.owner) || "Nieprzypisane",
    description: String(draft.description || "").trim(),
    dueDate: draft.dueDate || "",
    sourceType: "manual",
    sourceMeetingId: "",
    sourceMeetingTitle: "Reczne zadanie",
    sourceMeetingDate: draft.dueDate || now,
    sourceRecordingId: "",
    sourceQuote: "",
    createdAt: now,
    updatedAt: now,
    status: statusFromValue(draft.status),
    important: Boolean(draft.important),
    completed: draft.status === "done",
    notes: String(draft.notes || "").trim(),
  };
}

export function extractMeetingTasks(meeting) {
  const analysis = meeting.analysis || {};
  const candidates = safeArray(analysis.tasks).length ? analysis.tasks : fallbackTaskCandidates(meeting);

  return candidates.map((candidate, index) => taskFromCandidate(candidate, meeting, index)).filter(Boolean);
}

export function buildTasksFromMeetings(meetings, manualTasks, taskState, currentUser) {
  const meetingTasks = safeArray(meetings)
    .flatMap((meeting) => extractMeetingTasks(meeting))
    .map((task) => mergeTaskState(task, taskState?.[task.id], currentUser))
    .filter((task) => !task.archived);

  const standaloneTasks = safeArray(manualTasks)
    .filter((task) => task.userId === currentUser?.id)
    .map((task) => mergeTaskState(task, {}, currentUser))
    .filter((task) => !task.archived);

  return [...meetingTasks, ...standaloneTasks].sort(
    (left, right) =>
      new Date(right.updatedAt || right.dueDate || right.sourceMeetingDate || right.createdAt).getTime() -
      new Date(left.updatedAt || left.dueDate || left.sourceMeetingDate || left.createdAt).getTime()
  );
}

export function taskListStats(tasks) {
  const list = safeArray(tasks);
  return {
    all: list.length,
    assigned: list.filter((task) => task.assignedToMe).length,
    important: list.filter((task) => task.important).length,
    completed: list.filter((task) => task.completed).length,
    open: list.filter((task) => !task.completed).length,
    manual: list.filter((task) => task.sourceType === "manual").length,
  };
}
