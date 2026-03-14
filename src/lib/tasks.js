import { createId } from "./storage";

export const DEFAULT_TASK_COLUMNS = [
  { id: "todo", label: "Do zrobienia", color: "#5a92ff", isDone: false, system: true },
  { id: "in_progress", label: "W toku", color: "#8a6bff", isDone: false, system: true },
  { id: "waiting", label: "Oczekuje", color: "#f3ca72", isDone: false, system: true },
  { id: "done", label: "Zakonczone", color: "#67d59f", isDone: true, system: true },
];

export const TASK_PRIORITIES = [
  { id: "low", label: "Niski", color: "#8db4ff" },
  { id: "medium", label: "Sredni", color: "#75d6c4" },
  { id: "high", label: "Wysoki", color: "#f3ca72" },
  { id: "urgent", label: "Krytyczny", color: "#f17d72" },
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

function normalizeGroup(value) {
  return titleCase(normalizeWhitespace(value));
}

export function parseTagInput(value) {
  return uniqueStrings(
    String(value || "")
      .split(/\r?\n|,|#/)
      .map((item) => item.trim())
  );
}

function normalizePriority(value) {
  return TASK_PRIORITIES.some((priority) => priority.id === value) ? value : "medium";
}

function normalizeColumns(columns) {
  const normalized = safeArray(columns)
    .map((column, index) => {
      const label = normalizeWhitespace(column?.label);
      if (!label) {
        return null;
      }

      return {
        id: normalizeWhitespace(column.id) || createId(`column_${index}`),
        label,
        color: normalizeWhitespace(column.color) || DEFAULT_TASK_COLUMNS[index % DEFAULT_TASK_COLUMNS.length].color,
        isDone: Boolean(column.isDone),
        system: Boolean(column.system),
      };
    })
    .filter(Boolean);

  if (!normalized.length) {
    return DEFAULT_TASK_COLUMNS;
  }

  return normalized.some((column) => column.isDone)
    ? normalized
    : [...normalized.slice(0, normalized.length - 1), { ...normalized[normalized.length - 1], isDone: true }];
}

function defaultOpenColumnId(columns) {
  return normalizeColumns(columns).find((column) => !column.isDone)?.id || normalizeColumns(columns)[0].id;
}

function defaultDoneColumnId(columns) {
  return normalizeColumns(columns).find((column) => column.isDone)?.id || normalizeColumns(columns).slice(-1)[0].id;
}

function sanitizeStatus(columns, value) {
  const normalizedColumns = normalizeColumns(columns);
  return normalizedColumns.some((column) => column.id === value) ? value : defaultOpenColumnId(normalizedColumns);
}

function isDoneStatus(columns, status) {
  return normalizeColumns(columns).some((column) => column.id === status && column.isDone);
}

function knownOwnersForMeeting(meeting) {
  return uniqueStrings([
    ...safeArray(meeting.attendees),
    ...Object.values(meeting.speakerNames || {}),
    ...Object.values(meeting.analysis?.speakerLabels || {}),
    ...safeArray(meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))),
  ]);
}

function normalizeOwner(owner, candidates) {
  const cleaned = normalizeWhitespace(owner);
  if (!cleaned) {
    return "";
  }

  const match = safeArray(candidates).find((candidate) => candidate.toLowerCase() === cleaned.toLowerCase());
  return match || cleaned;
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

function inferPriority(candidate) {
  const text = `${candidate.title || ""} ${candidate.sourceQuote || ""}`.toLowerCase();
  if (/pilne|natychmiast|asap|krytyczne/.test(text)) {
    return "urgent";
  }
  if (/wysok|priorytet|blokuje|deadline/.test(text)) {
    return "high";
  }
  if (/pozniej|nice to have|opcjonal/.test(text)) {
    return "low";
  }
  return normalizePriority(candidate.priority);
}

function matchesCurrentUser(owner, currentUser) {
  const normalizedOwner = normalizeWhitespace(owner).toLowerCase();
  if (!normalizedOwner || !currentUser) {
    return false;
  }

  const signals = uniqueStrings([currentUser.name, currentUser.email, currentUser.googleEmail]).map((item) =>
    item.toLowerCase()
  );

  return signals.some((signal) => normalizedOwner.includes(signal) || signal.includes(normalizedOwner));
}

function taskFromCandidate(candidate, meeting, index, columns) {
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
    updatedAt: meeting.updatedAt || meeting.createdAt,
    status: defaultOpenColumnId(columns),
    important: false,
    completed: false,
    notes: candidate.sourceQuote || "",
    priority: inferPriority(candidate),
    tags: uniqueStrings([...(meeting.tags || []), ...safeArray(candidate.tags)]),
    group: normalizeGroup(candidate.group),
    comments: [],
    history: [],
    dependencies: [],
    recurrence: null,
  };
}

function fallbackTaskCandidates(meeting) {
  const analysis = meeting.analysis || {};
  return safeArray(analysis.actionItems).map((item) => ({
    title: item,
    owner: "",
    sourceQuote: item,
    tags: meeting.tags || [],
  }));
}

function mergeTaskState(task, state, currentUser, columns) {
  const status = sanitizeStatus(columns, state?.status || task.status);
  const completed = typeof state?.completed === "boolean" ? state.completed : isDoneStatus(columns, status);
  const owner = state?.owner ?? task.owner;
  const title = state?.title ?? task.title;
  const description = state?.description ?? task.description ?? "";
  const dueDate = state?.dueDate ?? task.dueDate ?? "";
  const notes = state?.notes ?? task.notes ?? "";
  const tags = uniqueStrings([...(task.tags || []), ...safeArray(state?.tags)]);
  const group = normalizeGroup(state?.group ?? task.group);

  return {
    ...task,
    title,
    owner: normalizeWhitespace(owner) || "Nieprzypisane",
    description,
    dueDate,
    notes,
    tags,
    group,
    updatedAt: state?.updatedAt || task.updatedAt || task.createdAt,
    important: typeof state?.important === "boolean" ? state.important : Boolean(task.important),
    priority: normalizePriority(state?.priority || task.priority),
    status: completed ? defaultDoneColumnId(columns) : status,
    completed,
    archived: Boolean(state?.archived),
    comments: safeArray(state?.comments).length ? safeArray(state.comments) : safeArray(task.comments),
    history: safeArray(state?.history).length ? safeArray(state.history) : safeArray(task.history),
    dependencies: safeArray(state?.dependencies).length
      ? uniqueStrings(state.dependencies)
      : uniqueStrings(task.dependencies),
    recurrence: state?.recurrence ?? task.recurrence ?? null,
    assignedToMe: matchesCurrentUser(owner, currentUser),
  };
}

export function buildTaskColumns(taskBoards, workspaceId) {
  return normalizeColumns(taskBoards?.[workspaceId]?.columns || DEFAULT_TASK_COLUMNS);
}

export function createTaskColumn(taskBoards, workspaceId, draft) {
  const columns = buildTaskColumns(taskBoards, workspaceId);
  const label = titleCase(draft.label);
  if (!label) {
    throw new Error("Dodaj nazwe kolumny.");
  }

  return {
    ...taskBoards,
    [workspaceId]: {
      columns: [
        ...columns,
        {
          id: createId("column"),
          label,
          color: normalizeWhitespace(draft.color) || "#9ef2db",
          isDone: Boolean(draft.isDone),
          system: false,
        },
      ],
    },
  };
}

export function updateTaskColumns(taskBoards, workspaceId, nextColumns) {
  return {
    ...taskBoards,
    [workspaceId]: {
      columns: normalizeColumns(nextColumns),
    },
  };
}

export function buildTaskPeople(meetings, currentUser, workspaceMembers = []) {
  return uniqueStrings([
    currentUser?.name,
    currentUser?.email,
    currentUser?.googleEmail,
    ...safeArray(workspaceMembers).flatMap((member) => [member.name, member.email, member.googleEmail]),
    ...safeArray(meetings).flatMap((meeting) => [
      ...safeArray(meeting.attendees),
      ...Object.values(meeting.speakerNames || {}),
      ...Object.values(meeting.analysis?.speakerLabels || {}),
      ...safeArray(meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))),
    ]),
  ]);
}

export function buildTaskTags(tasks, meetings) {
  return uniqueStrings([
    ...safeArray(tasks).flatMap((task) => task.tags || []),
    ...safeArray(meetings).flatMap((meeting) => meeting.tags || []),
  ]);
}

export function buildTaskGroups(tasks) {
  return uniqueStrings(safeArray(tasks).map((task) => task.group));
}

export function createManualTask(userId, draft, columns, workspaceId) {
  const now = new Date().toISOString();
  const title = titleCase(draft.title);
  if (!title) {
    throw new Error("Dodaj tytul zadania.");
  }

  const status = sanitizeStatus(columns, draft.status || defaultOpenColumnId(columns));

  return {
    id: createId("task"),
    userId,
    workspaceId: workspaceId || draft.workspaceId || "",
    createdByUserId: userId,
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
    status,
    important: Boolean(draft.important),
    completed: isDoneStatus(columns, status),
    notes: String(draft.notes || "").trim(),
    priority: normalizePriority(draft.priority),
    tags: parseTagInput(draft.tags),
    group: normalizeGroup(draft.group),
    comments: safeArray(draft.comments),
    history: safeArray(draft.history),
    dependencies: uniqueStrings(draft.dependencies),
    recurrence: draft.recurrence || null,
  };
}

export function createTaskFromGoogle(userId, googleTask, taskList, columns, currentUser, workspaceId) {
  const notes = String(googleTask.notes || "").trim();
  const dueDate = googleTask.due || googleTask.updated || new Date().toISOString();
  const completed = googleTask.status === "completed";

  return {
    id: createId("google_task"),
    userId,
    workspaceId: workspaceId || "",
    createdByUserId: userId,
    googleTaskId: googleTask.id,
    googleTaskListId: taskList.id,
    title: titleCase(googleTask.title || "Google task"),
    owner: currentUser?.name || currentUser?.email || "Ja",
    description: notes,
    dueDate,
    sourceType: "google",
    sourceMeetingId: "",
    sourceMeetingTitle: taskList.title || "Google Tasks",
    sourceMeetingDate: dueDate,
    sourceRecordingId: "",
    sourceQuote: "",
    createdAt: googleTask.updated || new Date().toISOString(),
    updatedAt: googleTask.updated || new Date().toISOString(),
    status: completed ? defaultDoneColumnId(columns) : defaultOpenColumnId(columns),
    important: false,
    completed,
    notes,
    priority: "medium",
    tags: [],
    group: normalizeGroup(taskList.title || ""),
    comments: [],
    history: [],
    dependencies: [],
    recurrence: null,
  };
}

export function upsertGoogleImportedTasks(existingTasks, importedTasks, userId) {
  const incoming = safeArray(importedTasks).filter(Boolean);
  const merged = [...safeArray(existingTasks)];

  incoming.forEach((task) => {
    const index = merged.findIndex(
      (candidate) =>
        candidate.userId === userId &&
        candidate.sourceType === "google" &&
        candidate.googleTaskId === task.googleTaskId &&
        candidate.googleTaskListId === task.googleTaskListId
    );

    if (index >= 0) {
      merged[index] = {
        ...merged[index],
        ...task,
        id: merged[index].id,
      };
      return;
    }

    merged.unshift(task);
  });

  return merged;
}

export function extractMeetingTasks(meeting, columns) {
  const analysis = meeting.analysis || {};
  const candidates = safeArray(analysis.tasks).length ? analysis.tasks : fallbackTaskCandidates(meeting);

  return candidates.map((candidate, index) => taskFromCandidate(candidate, meeting, index, columns)).filter(Boolean);
}

export function buildTasksFromMeetings(meetings, manualTasks, taskState, currentUser, columns, workspaceId) {
  const normalizedColumns = normalizeColumns(columns);

  const meetingTasks = safeArray(meetings)
    .flatMap((meeting) => extractMeetingTasks(meeting, normalizedColumns))
    .map((task) => mergeTaskState(task, taskState?.[task.id], currentUser, normalizedColumns))
    .filter((task) => !task.archived);

  const standaloneTasks = safeArray(manualTasks)
    .filter((task) => (workspaceId ? task.workspaceId === workspaceId : task.userId === currentUser?.id))
    .map((task) => mergeTaskState(task, taskState?.[task.id], currentUser, normalizedColumns))
    .filter((task) => !task.archived);

  return [...meetingTasks, ...standaloneTasks].sort(
    (left, right) =>
      new Date(right.updatedAt || right.dueDate || right.sourceMeetingDate || right.createdAt).getTime() -
      new Date(left.updatedAt || left.dueDate || left.sourceMeetingDate || left.createdAt).getTime()
  );
}

export function taskListStats(tasks) {
  const list = safeArray(tasks);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEdge = new Date(today);
  weekEdge.setDate(today.getDate() + 7);
  const completedCount = list.filter((task) => task.completed).length;
  const byPriority = TASK_PRIORITIES.reduce(
    (accumulator, priority) => ({
      ...accumulator,
      [priority.id]: list.filter((task) => task.priority === priority.id).length,
    }),
    {}
  );
  const byStatus = list.reduce((accumulator, task) => {
    const key = task.status || "unknown";
    return {
      ...accumulator,
      [key]: (accumulator[key] || 0) + 1,
    };
  }, {});

  return {
    all: list.length,
    assigned: list.filter((task) => task.assignedToMe).length,
    important: list.filter((task) => task.important).length,
    completed: completedCount,
    open: list.filter((task) => !task.completed).length,
    manual: list.filter((task) => task.sourceType === "manual").length,
    overdue: list.filter((task) => {
      if (!task.dueDate || task.completed) {
        return false;
      }
      return new Date(task.dueDate).getTime() < today.getTime();
    }).length,
    dueToday: list.filter((task) => {
      if (!task.dueDate || task.completed) {
        return false;
      }
      return new Date(task.dueDate).toDateString() === today.toDateString();
    }).length,
    dueThisWeek: list.filter((task) => {
      if (!task.dueDate || task.completed) {
        return false;
      }
      const dueDate = new Date(task.dueDate).getTime();
      return dueDate >= today.getTime() && dueDate < weekEdge.getTime();
    }).length,
    scheduled: list.filter((task) => Boolean(task.dueDate)).length,
    unassigned: list.filter((task) => !task.owner || task.owner === "Nieprzypisane").length,
    waiting: list.filter((task) => task.status === "waiting").length,
    inProgress: list.filter((task) => task.status === "in_progress").length,
    grouped: list.filter((task) => Boolean(task.group)).length,
    progress: list.length ? Math.round((completedCount / list.length) * 100) : 0,
    byPriority,
    byStatus,
  };
}
