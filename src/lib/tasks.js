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

  const match = safeArray(candidates).find(
    (candidate) => candidate.toLowerCase() === cleaned.toLowerCase()
  );

  return match || cleaned;
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
    sourceMeetingId: meeting.id,
    sourceMeetingTitle: meeting.title,
    sourceMeetingDate: meeting.startsAt,
    sourceRecordingId: meeting.latestRecordingId || "",
    createdAt: meeting.updatedAt || meeting.createdAt,
    status: "open",
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

export function extractMeetingTasks(meeting) {
  const analysis = meeting.analysis || {};
  const candidates = safeArray(analysis.tasks).length ? analysis.tasks : fallbackTaskCandidates(meeting);

  return candidates
    .map((candidate, index) => taskFromCandidate(candidate, meeting, index))
    .filter(Boolean);
}

export function buildTasksFromMeetings(meetings, taskState, currentUser) {
  const currentUserName = String(currentUser?.name || "").trim().toLowerCase();

  const tasks = safeArray(meetings)
    .flatMap((meeting) => extractMeetingTasks(meeting))
    .map((task) => {
      const state = taskState?.[task.id] || {};
      const assignedToMe = currentUserName
        ? task.owner.toLowerCase().includes(currentUserName) || currentUserName.includes(task.owner.toLowerCase())
        : false;

      return {
        ...task,
        completed: Boolean(state.completed),
        important: Boolean(state.important),
        notes: state.notes ?? task.notes ?? "",
        assignedToMe,
      };
    })
    .sort((left, right) => new Date(right.sourceMeetingDate).getTime() - new Date(left.sourceMeetingDate).getTime());

  return tasks;
}

export function taskListStats(tasks) {
  const list = safeArray(tasks);
  return {
    all: list.length,
    assigned: list.filter((task) => task.assignedToMe).length,
    important: list.filter((task) => task.important).length,
    completed: list.filter((task) => task.completed).length,
    open: list.filter((task) => !task.completed).length,
  };
}
