// @ts-nocheck
import { createId } from './storage';
import { createGoogleTaskConflictState } from './googleSync';

const ORDER_GAP = 1024;

export const DEFAULT_TASK_COLUMNS = [
  { id: 'todo', label: 'Do zrobienia', color: '#5a92ff', isDone: false, system: true },
  { id: 'in_progress', label: 'W toku', color: '#8a6bff', isDone: false, system: true },
  { id: 'waiting', label: 'Oczekuje', color: '#f3ca72', isDone: false, system: true },
  { id: 'done', label: 'Zakonczone', color: '#67d59f', isDone: true, system: true },
];

export const TASK_PRIORITIES = [
  { id: 'low', label: 'Niski', color: '#8db4ff' },
  { id: 'medium', label: 'Średni', color: '#75d6c4' },
  { id: 'high', label: 'Wysoki', color: '#f3ca72' },
  { id: 'urgent', label: 'Krytyczny', color: '#f17d72' },
];

export const TASK_RECURRENCE_OPTIONS = [
  { id: 'none', label: 'Bez cyklu' },
  { id: 'daily', label: 'Codziennie' },
  { id: 'weekly', label: 'Co tydzien' },
  { id: 'monthly', label: 'Co miesiac' },
  { id: 'custom', label: 'Wlasny interwal' },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function uniqueStrings(items) {
  return [
    ...new Set(
      safeArray(items)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Custom people/tags storage in localStorage to persist user-created values
const CUSTOM_TASK_PEOPLE_KEY = 'voicelog_custom_task_people';
const CUSTOM_TASK_TAGS_KEY = 'voicelog_custom_task_tags';

export function getCustomTaskPeople() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_TASK_PEOPLE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addCustomTaskPerson(person: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getCustomTaskPeople();
    const normalized = String(person).trim();
    if (!normalized || normalized === 'Nieprzypisane') return;
    if (!current.some((p) => p.toLowerCase() === normalized.toLowerCase())) {
      localStorage.setItem(CUSTOM_TASK_PEOPLE_KEY, JSON.stringify([...current, normalized]));
    }
  } catch {}
}

export function getCustomTaskTags() {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CUSTOM_TASK_TAGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addCustomTaskTag(tag: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getCustomTaskTags();
    const normalized = String(tag).trim();
    if (!normalized) return;
    if (!current.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
      localStorage.setItem(CUSTOM_TASK_TAGS_KEY, JSON.stringify([...current, normalized]));
    }
  } catch {}
}

function normalizeGroup(value) {
  return titleCase(normalizeWhitespace(value));
}

function normalizePriority(value) {
  return TASK_PRIORITIES.some((priority) => priority.id === value) ? value : 'medium';
}

function titleCase(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return '';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
        color:
          normalizeWhitespace(column.color) ||
          DEFAULT_TASK_COLUMNS[index % DEFAULT_TASK_COLUMNS.length].color,
        isDone: Boolean(column.isDone),
        system: Boolean(column.system),
        wipLimit: Number.isFinite(column.wipLimit) && column.wipLimit > 0 ? column.wipLimit : null,
      };
    })
    .filter(Boolean);

  if (!normalized.length) {
    return DEFAULT_TASK_COLUMNS;
  }

  return normalized.some((column) => column.isDone)
    ? normalized
    : [
        ...normalized.slice(0, normalized.length - 1),
        { ...normalized[normalized.length - 1], isDone: true },
      ];
}

function defaultOpenColumnId(columns) {
  return (
    normalizeColumns(columns).find((column) => !column.isDone)?.id ||
    normalizeColumns(columns)[0].id
  );
}

function defaultDoneColumnId(columns) {
  return (
    normalizeColumns(columns).find((column) => column.isDone)?.id ||
    normalizeColumns(columns).slice(-1)[0].id
  );
}

function sanitizeStatus(columns, value) {
  const normalizedColumns = normalizeColumns(columns);
  return normalizedColumns.some((column) => column.id === value)
    ? value
    : defaultOpenColumnId(normalizedColumns);
}

function isDoneStatus(columns, status) {
  return normalizeColumns(columns).some((column) => column.id === status && column.isDone);
}

function statusLabel(columns, status) {
  return (
    normalizeColumns(columns).find((column) => column.id === status)?.label || status || 'Kolumna'
  );
}

function knownOwnersForMeeting(meeting) {
  return uniqueStrings([
    ...safeArray(meeting.attendees),
    ...Object.values(meeting.speakerNames || {}),
    ...Object.values(meeting.analysis?.speakerLabels || {}),
    ...safeArray(
      meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))
    ),
  ]);
}

function normalizeOwner(owner, candidates) {
  const cleaned = normalizeWhitespace(owner);
  if (!cleaned) {
    return '';
  }

  const match = safeArray(candidates).find(
    (candidate) => candidate.toLowerCase() === cleaned.toLowerCase()
  );
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
    const name = String(item || '')
      .trim()
      .toLowerCase();
    return name && lower.includes(name);
  });

  return {
    owner: candidate || '',
    title: normalized,
  };
}

function inferPriority(candidate) {
  const text = `${candidate.title || ''} ${candidate.sourceQuote || ''}`.toLowerCase();
  if (/pilne|natychmiast|asap|krytyczne/.test(text)) {
    return 'urgent';
  }
  if (/wysok|priorytet|blokuje|deadline/.test(text)) {
    return 'high';
  }
  if (/pozniej|nice to have|opcjonal/.test(text)) {
    return 'low';
  }
  return normalizePriority(candidate.priority);
}

function matchesCurrentUser(ownerSignals, currentUser) {
  const userSignals = uniqueStrings([
    currentUser?.name,
    currentUser?.email,
    currentUser?.googleEmail,
  ]).map((item) => item.toLowerCase());

  if (!userSignals.length) {
    return false;
  }

  return safeArray(ownerSignals).some((owner) => {
    const normalizedOwner = normalizeWhitespace(owner).toLowerCase();
    if (!normalizedOwner) {
      return false;
    }

    return userSignals.some(
      (signal) => normalizedOwner.includes(signal) || signal.includes(normalizedOwner)
    );
  });
}

function normalizeTaskArray(value, normalizer) {
  return safeArray(value)
    .map((item, index) => normalizer(item, index))
    .filter(Boolean);
}

function normalizeTaskComment(item, index = 0) {
  const text = normalizeWhitespace(item?.text ?? item);
  if (!text) {
    return null;
  }

  return {
    id: normalizeWhitespace(item?.id) || createId(`comment_${index}`),
    text,
    author: normalizeWhitespace(item?.author) || 'Ty',
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

function normalizeTaskHistoryEntry(item, index = 0) {
  const message = normalizeWhitespace(item?.message ?? item);
  if (!message) {
    return null;
  }

  return {
    id: normalizeWhitespace(item?.id) || createId(`history_${index}`),
    type: normalizeWhitespace(item?.type) || 'updated',
    actor: normalizeWhitespace(item?.actor) || 'System',
    message,
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

function normalizeTaskSubtask(item, index = 0) {
  const title = normalizeWhitespace(item?.title ?? item);
  if (!title) {
    return null;
  }

  return {
    id: normalizeWhitespace(item?.id) || createId(`subtask_${index}`),
    title,
    completed: Boolean(item?.completed),
    assignee: normalizeWhitespace(item?.assignee),
    createdAt: item?.createdAt || new Date().toISOString(),
    completedAt: item?.completedAt || '',
  };
}

function normalizeTaskLink(item, index = 0) {
  const rawValue = typeof item === 'string' ? item : item?.url || item?.href || '';
  const url = normalizeWhitespace(rawValue);
  if (!url) {
    return null;
  }

  return {
    id: normalizeWhitespace(item?.id) || createId(`link_${index}`),
    label: normalizeWhitespace(item?.label) || url,
    url,
  };
}

function recurrenceLabel(recurrence) {
  if (!recurrence) {
    return '';
  }

  const interval = Math.max(1, Number(recurrence.interval) || 1);
  if (recurrence.frequency === 'daily') {
    return interval === 1 ? 'Codziennie' : `Co ${interval} dni`;
  }
  if (recurrence.frequency === 'weekly') {
    return interval === 1 ? 'Co tydzien' : `Co ${interval} tygodnie`;
  }
  if (recurrence.frequency === 'monthly') {
    return interval === 1 ? 'Co miesiac' : `Co ${interval} miesiace`;
  }
  if (recurrence.frequency === 'custom') {
    return `Co ${interval} dni`;
  }
  return '';
}

function normalizeRecurrenceFrequency(value) {
  return TASK_RECURRENCE_OPTIONS.some((option) => option.id === value) ? value : 'none';
}

function sameTextList(left, right) {
  return uniqueStrings(left).join('||') === uniqueStrings(right).join('||');
}

function toValidTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function taskLookup(tasks) {
  return new Map(safeArray(tasks).map((task) => [task.id, task]));
}

function dependencyGraph(tasks) {
  return safeArray(tasks).reduce((graph, task) => {
    graph[task.id] = normalizeTaskDependencies(task.dependencies);
    return graph;
  }, {});
}

function visitDependency(nodeId, graph, seen, trail) {
  if (trail.has(nodeId)) {
    return true;
  }
  if (seen.has(nodeId)) {
    return false;
  }

  seen.add(nodeId);
  trail.add(nodeId);
  const blockedBy = graph[nodeId] || [];
  const hasCycle = blockedBy.some((dependencyId) =>
    visitDependency(dependencyId, graph, seen, trail)
  );
  trail.delete(nodeId);
  return hasCycle;
}

export function parseTagInput(value) {
  return uniqueStrings(
    String(value || '')
      .split(/\r?\n|,|#/)
      .map((item) => item.trim())
  );
}

export function normalizeTaskPeopleList(value) {
  if (typeof value === 'string') {
    return uniqueStrings(value.split(/\r?\n|,/));
  }
  return uniqueStrings(value);
}

export function normalizeTaskDependencies(value) {
  return uniqueStrings(value);
}

export function normalizeTaskComments(value) {
  return normalizeTaskArray(value, normalizeTaskComment);
}

export function normalizeTaskHistory(value) {
  return normalizeTaskArray(value, normalizeTaskHistoryEntry);
}

export function normalizeTaskSubtasks(value) {
  return normalizeTaskArray(value, normalizeTaskSubtask);
}

export function normalizeTaskLinks(value) {
  if (typeof value === 'string') {
    return normalizeTaskArray(value.split(/\r?\n|,/), normalizeTaskLink);
  }
  return normalizeTaskArray(value, normalizeTaskLink);
}

export function normalizeTaskRecurrence(value) {
  if (!value || value === 'none') {
    return null;
  }

  const frequency = normalizeRecurrenceFrequency(value.frequency || value);
  if (frequency === 'none') {
    return null;
  }

  return {
    frequency,
    interval: Math.max(1, Number(value.interval) || 1),
  };
}

export function createTaskComment(text, author = 'Ty') {
  return normalizeTaskComment({
    id: createId('comment'),
    text,
    author,
    createdAt: new Date().toISOString(),
  });
}

export function createTaskSubtask(title, assignee = '') {
  return normalizeTaskSubtask({
    id: createId('subtask'),
    title,
    assignee,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: '',
  });
}

export function createTaskHistoryEntry(message, actor = 'System', type = 'updated') {
  return normalizeTaskHistoryEntry({
    id: createId('history'),
    actor,
    type,
    message,
    createdAt: new Date().toISOString(),
  });
}

export function getTaskDependencyDetails(task, tasks) {
  const lookup = taskLookup(tasks);
  const dependencies = normalizeTaskDependencies(task?.dependencies)
    .map((dependencyId) => lookup.get(dependencyId))
    .filter(Boolean);
  const unresolved = dependencies.filter((dependency) => !dependency.completed);

  return {
    dependencies,
    unresolved,
    blocking: unresolved.length > 0,
  };
}

export function validateTaskDependencies(taskId, dependencyIds, tasks) {
  const normalizedDependencies = normalizeTaskDependencies(dependencyIds);
  if (normalizedDependencies.includes(taskId)) {
    throw new Error('Zadanie nie moze zalezec od samego siebie.');
  }

  const graph = dependencyGraph(tasks);
  graph[taskId] = normalizedDependencies;
  const hasCycle = visitDependency(taskId, graph, new Set(), new Set());
  if (hasCycle) {
    throw new Error('Ta zaleznosc tworzy petle miedzy zadaniami.');
  }
}

export function validateTaskCompletion(task, updates, tasks, columns = DEFAULT_TASK_COLUMNS) {
  const nextStatus = String(updates.status || task.status || '');
  const shouldBeCompleted =
    typeof updates.completed === 'boolean'
      ? updates.completed
      : normalizeColumns(columns).some((column) => column.id === nextStatus && column.isDone);
  if (!shouldBeCompleted) {
    return;
  }

  const dependencyState = getTaskDependencyDetails(task, tasks);
  if (dependencyState.unresolved.length) {
    throw new Error(
      `Najpierw zakoncz zalezne zadania: ${dependencyState.unresolved
        .slice(0, 3)
        .map((dependency) => dependency.title)
        .join(', ')}.`
    );
  }
}

export function getTaskSlaState(task, now = new Date()) {
  if (!task || task.completed || !task.dueDate) {
    return { id: 'none', label: 'Brak SLA', tone: 'neutral' };
  }

  const dueTime = toValidTimestamp(task.dueDate);
  const deltaMinutes = Math.round((dueTime - now.getTime()) / (60 * 1000));
  if (deltaMinutes < 0) {
    const overdueHours = Math.abs(deltaMinutes) / 60;
    if (overdueHours >= 24) {
      return { id: 'breached', label: 'SLA naruszone', tone: 'danger' };
    }
    return { id: 'overdue', label: 'Po SLA', tone: 'danger' };
  }
  if (deltaMinutes <= 4 * 60) {
    return { id: 'critical', label: 'Krytyczne', tone: 'danger' };
  }
  if (deltaMinutes <= 24 * 60) {
    return { id: 'at_risk', label: 'Zagrozone', tone: 'warning' };
  }

  return { id: 'healthy', label: 'W normie', tone: 'success' };
}

export function buildTaskNotifications(tasks, now = new Date()) {
  return safeArray(tasks)
    .filter((task) => !task.completed)
    .map((task) => ({
      task,
      sla: getTaskSlaState(task, now),
      dependencies: getTaskDependencyDetails(task, tasks),
    }))
    .filter(
      ({ sla, dependencies }) =>
        ['critical', 'overdue', 'breached'].includes(sla.id) || dependencies.blocking
    )
    .sort((left, right) => {
      const leftScore =
        (left.sla.id === 'breached'
          ? 4
          : left.sla.id === 'overdue'
            ? 3
            : left.sla.id === 'critical'
              ? 2
              : 1) + (left.dependencies.blocking ? 1 : 0);
      const rightScore =
        (right.sla.id === 'breached'
          ? 4
          : right.sla.id === 'overdue'
            ? 3
            : right.sla.id === 'critical'
              ? 2
              : 1) + (right.dependencies.blocking ? 1 : 0);
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return toValidTimestamp(left.task.dueDate) - toValidTimestamp(right.task.dueDate);
    });
}

export function getTaskOrder(task, fallbackIndex = 0) {
  const order = Number(task?.order);
  if (Number.isFinite(order)) {
    return order;
  }

  const timestamp = new Date(
    task?.updatedAt || task?.createdAt || task?.sourceMeetingDate || 0
  ).getTime();
  return (Number.isFinite(timestamp) ? -timestamp : 0) + fallbackIndex;
}

export function getNextTaskOrderTop(tasks) {
  const orders = safeArray(tasks).map((task, index) => getTaskOrder(task, index));
  return orders.length ? Math.min(...orders) - ORDER_GAP : -Date.now();
}

export function buildTaskReorderUpdate(tasks, placement = {}) {
  const sorted = [...safeArray(tasks)].sort(
    (left, right) => getTaskOrder(left) - getTaskOrder(right)
  );
  const previousTask = sorted.find((task) => task.id === placement.previousTaskId);
  const nextTask = sorted.find((task) => task.id === placement.nextTaskId);
  let order = getNextTaskOrderTop(sorted);

  if (previousTask && nextTask) {
    order = (getTaskOrder(previousTask) + getTaskOrder(nextTask)) / 2;
  } else if (previousTask) {
    order = getTaskOrder(previousTask) + ORDER_GAP;
  } else if (nextTask) {
    order = getTaskOrder(nextTask) - ORDER_GAP;
  }

  return {
    ...(placement.status !== undefined ? { status: placement.status } : {}),
    ...(placement.group !== undefined ? { group: placement.group } : {}),
    order,
  };
}

export function nextRecurringDueDate(value, recurrence) {
  const normalizedRecurrence = normalizeTaskRecurrence(recurrence);
  if (!normalizedRecurrence) {
    return '';
  }

  const baseDate = new Date(value || new Date().toISOString());
  if (Number.isNaN(baseDate.getTime())) {
    return '';
  }

  const nextDate = new Date(baseDate);
  const interval = Math.max(1, Number(normalizedRecurrence.interval) || 1);

  if (normalizedRecurrence.frequency === 'daily' || normalizedRecurrence.frequency === 'custom') {
    nextDate.setDate(nextDate.getDate() + interval);
  } else if (normalizedRecurrence.frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + interval * 7);
  } else if (normalizedRecurrence.frequency === 'monthly') {
    nextDate.setMonth(nextDate.getMonth() + interval);
  }

  return nextDate.toISOString();
}

export function buildTaskChangeHistory(previousTask, nextTask, actor, columns) {
  const entries = [];

  if ((previousTask.title || '') !== (nextTask.title || '')) {
    entries.push(createTaskHistoryEntry(`Zmieniono tytul na "${nextTask.title}".`, actor));
  }

  if ((previousTask.status || '') !== (nextTask.status || '')) {
    entries.push(
      createTaskHistoryEntry(
        `Przeniesiono zadanie do kolumny "${statusLabel(columns, nextTask.status)}".`,
        actor,
        'status'
      )
    );
  }

  if ((previousTask.completed || false) !== (nextTask.completed || false)) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.completed ? 'Oznaczono zadanie jako zakonczone.' : 'Otworzono zadanie ponownie.',
        actor,
        'completed'
      )
    );
  }

  if ((previousTask.owner || '') !== (nextTask.owner || '')) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.owner
          ? `Zmieniono glowna osobe na "${nextTask.owner}".`
          : 'Usunieto glowna osobe.',
        actor,
        'owner'
      )
    );
  }

  if (!sameTextList(previousTask.assignedTo, nextTask.assignedTo)) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.assignedTo?.length
          ? `Zmieniono przypisane osoby: ${nextTask.assignedTo.join(', ')}.`
          : 'Usunieto przypisane osoby.',
        actor,
        'assignees'
      )
    );
  }

  if ((previousTask.group || '') !== (nextTask.group || '')) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.group
          ? `Przeniesiono zadanie do grupy "${nextTask.group}".`
          : 'Usunieto grupe zadania.',
        actor,
        'group'
      )
    );
  }

  if ((previousTask.priority || '') !== (nextTask.priority || '')) {
    entries.push(createTaskHistoryEntry('Zmieniono priorytet zadania.', actor, 'priority'));
  }

  if ((previousTask.dueDate || '') !== (nextTask.dueDate || '')) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.dueDate ? 'Zmieniono termin zadania.' : 'Usunieto termin zadania.',
        actor,
        'due_date'
      )
    );
  }

  if ((previousTask.description || '') !== (nextTask.description || '')) {
    entries.push(createTaskHistoryEntry('Zmieniono opis zadania.', actor, 'description'));
  }

  if ((previousTask.notes || '') !== (nextTask.notes || '')) {
    entries.push(createTaskHistoryEntry('Zmieniono notatki zadania.', actor, 'notes'));
  }

  if ((previousTask.important || false) !== (nextTask.important || false)) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.important ? 'Oznaczono zadanie jako wazne.' : 'Usunieto oznaczenie waznosci.',
        actor,
        'important'
      )
    );
  }

  if (!sameTextList(previousTask.tags, nextTask.tags)) {
    entries.push(createTaskHistoryEntry('Zmieniono tagi zadania.', actor, 'tags'));
  }

  if (!sameTextList(previousTask.dependencies, nextTask.dependencies)) {
    entries.push(createTaskHistoryEntry('Zmieniono zaleznosci zadania.', actor, 'dependencies'));
  }

  if ((previousTask.comments || []).length !== (nextTask.comments || []).length) {
    entries.push(createTaskHistoryEntry('Dodano komentarz do zadania.', actor, 'comment'));
  }

  if ((previousTask.subtasks || []).length !== (nextTask.subtasks || []).length) {
    entries.push(createTaskHistoryEntry('Zmieniono liste podzadan.', actor, 'subtasks'));
  }

  if (
    normalizeWhitespace(recurrenceLabel(previousTask.recurrence)) !==
    normalizeWhitespace(recurrenceLabel(nextTask.recurrence))
  ) {
    entries.push(
      createTaskHistoryEntry(
        nextTask.recurrence
          ? `Ustawiono cykl zadania: ${recurrenceLabel(nextTask.recurrence)}.`
          : 'Usunieto cykl zadania.',
        actor,
        'recurrence'
      )
    );
  }

  if (previousTask.order !== nextTask.order) {
    entries.push(createTaskHistoryEntry('Zmieniono kolejnosc zadania.', actor, 'order'));
  }

  return entries;
}

export function getTaskAssigneeSummary(task) {
  const people = normalizeTaskPeopleList(task?.assignedTo?.length ? task.assignedTo : task?.owner);
  if (!people.length) {
    return 'Nieprzypisane';
  }
  if (people.length === 1) {
    return people[0];
  }
  return `${people[0]} +${people.length - 1}`;
}

function taskFromCandidate(candidate, meeting, index, columns) {
  const candidates = knownOwnersForMeeting(meeting);
  const ownerHint = normalizeOwner(candidate.owner, candidates);
  const parsed = inferOwner(candidate.title || candidate.text || '', candidates);
  const owner = ownerHint || parsed.owner || 'Nieprzypisane';
  const title = titleCase(parsed.title || candidate.title || candidate.text || '');

  if (!title) {
    return null;
  }

  const assignedTo = owner && owner !== 'Nieprzypisane' ? [owner] : [];

  return {
    id: `${meeting.id}::task::${index}`,
    title,
    owner,
    assignedTo,
    description: normalizeWhitespace(candidate.description || ''),
    dueDate: meeting.startsAt || '',
    sourceType: 'meeting',
    sourceMeetingId: meeting.id,
    sourceMeetingTitle: meeting.title,
    sourceMeetingDate: meeting.startsAt,
    sourceRecordingId: meeting.latestRecordingId || '',
    sourceQuote: candidate.sourceQuote || '',
    createdAt: meeting.updatedAt || meeting.createdAt,
    updatedAt: meeting.updatedAt || meeting.createdAt,
    status: defaultOpenColumnId(columns),
    important: false,
    completed: false,
    notes: candidate.sourceQuote || '',
    priority: inferPriority(candidate),
    tags: uniqueStrings([...(meeting.tags || []), ...safeArray(candidate.tags)]),
    group: normalizeGroup(candidate.group),
    comments: [],
    history: [],
    dependencies: [],
    recurrence: null,
    subtasks: [],
    order: getTaskOrder({ updatedAt: meeting.updatedAt || meeting.createdAt }) + index,
  };
}

function fallbackTaskCandidates(meeting) {
  const analysis = meeting.analysis || {};
  return safeArray(analysis.actionItems).map((item) => ({
    title: item,
    owner: '',
    sourceQuote: item,
    tags: meeting.tags || [],
  }));
}

function mergeTaskState(task, state, currentUser, columns) {
  const status = sanitizeStatus(columns, state?.status || task.status);
  const completed =
    typeof state?.completed === 'boolean' ? state.completed : isDoneStatus(columns, status);
  const stateAssignedTo = hasOwn(state, 'assignedTo')
    ? normalizeTaskPeopleList(state.assignedTo)
    : normalizeTaskPeopleList(task.assignedTo?.length ? task.assignedTo : task.owner);
  const stateOwner = hasOwn(state, 'owner')
    ? normalizeWhitespace(state.owner)
    : normalizeWhitespace(task.owner);
  const owner = stateOwner || stateAssignedTo[0] || 'Nieprzypisane';
  const assignedTo = stateAssignedTo.length
    ? stateAssignedTo
    : owner !== 'Nieprzypisane'
      ? [owner]
      : [];

  return {
    ...task,
    title: hasOwn(state, 'title') ? state.title : task.title,
    owner,
    assignedTo,
    description: hasOwn(state, 'description') ? state.description : task.description || '',
    dueDate: hasOwn(state, 'dueDate') ? state.dueDate : task.dueDate || '',
    notes: hasOwn(state, 'notes') ? state.notes : task.notes || '',
    reminderAt: hasOwn(state, 'reminderAt')
      ? String(state.reminderAt || '')
      : task.reminderAt || '',
    myDay: typeof state?.myDay === 'boolean' ? state.myDay : Boolean(task.myDay),
    tags: hasOwn(state, 'tags') ? parseTagInput(state.tags) : safeArray(task.tags),
    group: normalizeGroup(hasOwn(state, 'group') ? state.group : task.group),
    updatedAt: state?.updatedAt || task.updatedAt || task.createdAt,
    important: typeof state?.important === 'boolean' ? state.important : Boolean(task.important),
    priority: normalizePriority(state?.priority || task.priority),
    status: completed ? defaultDoneColumnId(columns) : status,
    completed,
    archived: Boolean(state?.archived),
    comments: hasOwn(state, 'comments')
      ? normalizeTaskComments(state.comments)
      : normalizeTaskComments(task.comments),
    history: hasOwn(state, 'history')
      ? normalizeTaskHistory(state.history)
      : normalizeTaskHistory(task.history),
    dependencies: hasOwn(state, 'dependencies')
      ? normalizeTaskDependencies(state.dependencies)
      : normalizeTaskDependencies(task.dependencies),
    recurrence: hasOwn(state, 'recurrence')
      ? normalizeTaskRecurrence(state.recurrence)
      : normalizeTaskRecurrence(task.recurrence),
    subtasks: hasOwn(state, 'subtasks')
      ? normalizeTaskSubtasks(state.subtasks)
      : normalizeTaskSubtasks(task.subtasks),
    links: hasOwn(state, 'links')
      ? normalizeTaskLinks(state.links)
      : normalizeTaskLinks(task.links),
    order: hasOwn(state, 'order') ? Number(state.order) : task.order,
    assignedToMe: matchesCurrentUser([owner, ...assignedTo], currentUser),
  };
}

export function buildTaskColumns(taskBoards, workspaceId) {
  return normalizeColumns(taskBoards?.[workspaceId]?.columns || DEFAULT_TASK_COLUMNS);
}

export function createTaskColumn(taskBoards, workspaceId, draft) {
  const columns = buildTaskColumns(taskBoards, workspaceId);
  const label = titleCase(draft.label);
  if (!label) {
    throw new Error('Dodaj nazwe kolumny.');
  }

  return {
    ...taskBoards,
    [workspaceId]: {
      columns: [
        ...columns,
        {
          id: createId('column'),
          label,
          color: normalizeWhitespace(draft.color) || '#9ef2db',
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

export function buildTaskPeople(meetings, currentUser, workspaceMembers = [], tasks = []) {
  const customPeople = getCustomTaskPeople();
  return uniqueStrings([
    currentUser?.name,
    currentUser?.email,
    currentUser?.googleEmail,
    ...customPeople,
    ...safeArray(workspaceMembers).flatMap((member) => [
      member.name,
      member.email,
      member.googleEmail,
    ]),
    ...safeArray(meetings).flatMap((meeting) => [
      ...safeArray(meeting.attendees),
      ...Object.values(meeting.speakerNames || {}),
      ...Object.values(meeting.analysis?.speakerLabels || {}),
      ...safeArray(
        meeting.recordings?.flatMap((recording) => Object.values(recording.speakerNames || {}))
      ),
    ]),
    ...safeArray(tasks).flatMap((task) => [task.owner, ...safeArray(task.assignedTo)]),
  ]).filter((p) => p && p !== 'Nieprzypisane');
}

export function buildTaskTags(tasks, meetings) {
  const customTags = getCustomTaskTags();
  return uniqueStrings([
    ...customTags,
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
    throw new Error('Dodaj tytul zadania.');
  }

  const status = sanitizeStatus(columns, draft.status || defaultOpenColumnId(columns));
  const assignedTo = normalizeTaskPeopleList(
    draft.assignedTo?.length ? draft.assignedTo : draft.owner
  );
  const owner = assignedTo[0] || normalizeWhitespace(draft.owner) || 'Nieprzypisane';

  return {
    id: createId('task'),
    userId,
    workspaceId: workspaceId || draft.workspaceId || '',
    createdByUserId: userId,
    title,
    owner,
    assignedTo,
    description: String(draft.description || '').trim(),
    dueDate: draft.dueDate || '',
    sourceType: 'manual',
    sourceMeetingId: String(draft.sourceMeetingId || '').trim(),
    sourceMeetingTitle: String(draft.sourceMeetingTitle || 'Reczne zadanie').trim(),
    sourceMeetingDate: String(draft.sourceMeetingDate || draft.dueDate || now).trim(),
    sourceRecordingId: String(draft.sourceRecordingId || '').trim(),
    sourceQuote: '',
    createdAt: now,
    updatedAt: now,
    status,
    important: Boolean(draft.important),
    completed: isDoneStatus(columns, status),
    notes: String(draft.notes || '').trim(),
    reminderAt: String(draft.reminderAt || '').trim(),
    myDay: Boolean(draft.myDay),
    priority: normalizePriority(draft.priority),
    tags: Array.isArray(draft.tags) ? draft.tags : parseTagInput(draft.tags),
    group: normalizeGroup(draft.group),
    comments: normalizeTaskComments(draft.comments),
    history: normalizeTaskHistory(
      draft.history?.length
        ? draft.history
        : [createTaskHistoryEntry('Utworzono zadanie.', 'System', 'created')]
    ),
    dependencies: normalizeTaskDependencies(draft.dependencies),
    recurrence: normalizeTaskRecurrence(draft.recurrence),
    subtasks: normalizeTaskSubtasks(draft.subtasks),
    links: normalizeTaskLinks(draft.links),
    order: Number.isFinite(Number(draft.order)) ? Number(draft.order) : -Date.now(),
  };
}

export function createTaskFromGoogle(
  userId,
  googleTask,
  taskList,
  columns,
  currentUser,
  workspaceId
) {
  const notes = String(googleTask.notes || '').trim();
  const dueDate = googleTask.due || googleTask.updated || new Date().toISOString();
  const completed = googleTask.status === 'completed';
  const owner = currentUser?.name || currentUser?.email || 'Ja';
  const syncedAt = new Date().toISOString();

  return {
    id: createId('google_task'),
    userId,
    workspaceId: workspaceId || '',
    createdByUserId: userId,
    googleTaskId: googleTask.id,
    googleTaskListId: taskList.id,
    title: titleCase(googleTask.title || 'Google task'),
    owner,
    assignedTo: owner ? [owner] : [],
    description: notes,
    dueDate,
    sourceType: 'google',
    sourceMeetingId: '',
    sourceMeetingTitle: taskList.title || 'Google Tasks',
    sourceMeetingDate: dueDate,
    sourceRecordingId: '',
    sourceQuote: '',
    createdAt: googleTask.updated || new Date().toISOString(),
    updatedAt: googleTask.updated || new Date().toISOString(),
    status: completed ? defaultDoneColumnId(columns) : defaultOpenColumnId(columns),
    important: false,
    completed,
    notes,
    reminderAt: '',
    myDay: false,
    priority: 'medium',
    tags: [],
    group: normalizeGroup(taskList.title || ''),
    comments: [],
    history: [createTaskHistoryEntry('Zaimportowano z Google Tasks.', 'System', 'import')],
    dependencies: [],
    recurrence: null,
    subtasks: [],
    links: [],
    order: -new Date(googleTask.updated || new Date().toISOString()).getTime(),
    googleUpdatedAt: googleTask.updated || googleTask.completed || dueDate,
    googleSyncedAt: syncedAt,
    googlePulledAt: syncedAt,
    googleSyncStatus: 'synced',
    googleSyncConflict: null,
  };
}

export function createRecurringTaskFromTask(task, userId, workspaceId, columns, tasks = []) {
  const recurrence = normalizeTaskRecurrence(task.recurrence);
  if (!recurrence) {
    return null;
  }

  const dueDate = nextRecurringDueDate(task.dueDate || new Date().toISOString(), recurrence);
  if (!dueDate) {
    return null;
  }

  return createManualTask(
    userId,
    {
      title: task.title,
      owner: task.owner,
      assignedTo: task.assignedTo,
      description: task.description,
      dueDate,
      status: defaultOpenColumnId(columns),
      important: task.important,
      priority: task.priority,
      tags: task.tags,
      notes: task.notes,
      reminderAt: task.reminderAt,
      myDay: false,
      group: task.group,
      recurrence,
      dependencies: task.dependencies,
      subtasks: safeArray(task.subtasks).map((subtask) => ({
        ...subtask,
        completed: false,
        completedAt: '',
      })),
      history: [
        createTaskHistoryEntry('Utworzono kolejne cykliczne zadanie.', 'System', 'recurrence'),
      ],
      links: task.links,
      order: getNextTaskOrderTop(tasks),
      workspaceId,
    },
    columns,
    workspaceId
  );
}

export function upsertGoogleImportedTasks(existingTasks, importedTasks, userId) {
  const incoming = safeArray(importedTasks).filter(Boolean);
  const merged = [...safeArray(existingTasks)];
  const syncedAt = new Date().toISOString();

  incoming.forEach((task) => {
    const index = merged.findIndex(
      (candidate) =>
        candidate.userId === userId &&
        candidate.sourceType === 'google' &&
        candidate.googleTaskId === task.googleTaskId &&
        candidate.googleTaskListId === task.googleTaskListId
    );

    if (index >= 0) {
      const existingTask = merged[index];
      const conflict = createGoogleTaskConflictState(existingTask, task);
      if (conflict) {
        merged[index] = {
          ...existingTask,
          googleUpdatedAt:
            task.googleUpdatedAt || task.updatedAt || existingTask.googleUpdatedAt || '',
          googlePulledAt: syncedAt,
          googleSyncStatus: 'conflict',
          googleSyncConflict: conflict,
        };
        return;
      }

      merged[index] = {
        ...existingTask,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        sourceMeetingDate: task.sourceMeetingDate,
        updatedAt: task.updatedAt,
        status: task.status,
        completed: task.completed,
        notes: task.notes,
        group: task.group,
        owner: task.owner || existingTask.owner,
        assignedTo: task.assignedTo?.length ? task.assignedTo : existingTask.assignedTo,
        googleUpdatedAt: task.googleUpdatedAt || task.updatedAt || '',
        googleSyncedAt: syncedAt,
        googlePulledAt: syncedAt,
        googleSyncStatus: 'synced',
        googleSyncConflict: null,
        id: existingTask.id,
      };
      return;
    }

    merged.unshift({
      ...task,
      googleSyncedAt: syncedAt,
      googlePulledAt: syncedAt,
      googleSyncStatus: 'synced',
      googleSyncConflict: null,
    });
  });

  const conflictCount = merged.filter((task) => task.googleSyncStatus === 'conflict').length;
  return { merged, conflictCount };
}

export function extractMeetingTasks(meeting, columns) {
  const analysis = meeting.analysis || {};
  const candidates = safeArray(analysis.tasks).length
    ? analysis.tasks
    : fallbackTaskCandidates(meeting);

  return candidates
    .map((candidate, index) => taskFromCandidate(candidate, meeting, index, columns))
    .filter(Boolean);
}

export function buildTasksFromMeetings(
  meetings,
  manualTasks,
  taskState,
  currentUser,
  columns,
  workspaceId
) {
  const normalizedColumns = normalizeColumns(columns);

  const meetingTasks = safeArray(meetings)
    .flatMap((meeting) => extractMeetingTasks(meeting, normalizedColumns))
    .map((task) => mergeTaskState(task, taskState?.[task.id], currentUser, normalizedColumns))
    .filter((task) => !task.archived);

  const standaloneTasks = safeArray(manualTasks)
    .filter((task) =>
      workspaceId ? task.workspaceId === workspaceId : task.userId === currentUser?.id
    )
    .map((task) => mergeTaskState(task, taskState?.[task.id], currentUser, normalizedColumns))
    .filter((task) => !task.archived);

  return [...meetingTasks, ...standaloneTasks].sort((left, right) => {
    const orderDelta = getTaskOrder(left) - getTaskOrder(right);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return (
      new Date(
        right.updatedAt || right.dueDate || right.sourceMeetingDate || right.createdAt
      ).getTime() -
      new Date(left.updatedAt || left.dueDate || left.sourceMeetingDate || left.createdAt).getTime()
    );
  });
}

export function taskListStats(tasks) {
  const list = safeArray(tasks);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEdge = new Date(today);
  weekEdge.setDate(today.getDate() + 7);
  const completedCount = list.filter((task) => task.completed).length;
  const allSubtasks = list.flatMap((task) => safeArray(task.subtasks));
  const byPriority = TASK_PRIORITIES.reduce(
    (accumulator, priority) => ({
      ...accumulator,
      [priority.id]: list.filter((task) => task.priority === priority.id).length,
    }),
    {}
  );
  const byStatus = list.reduce((accumulator, task) => {
    const key = task.status || 'unknown';
    return {
      ...accumulator,
      [key]: (accumulator[key] || 0) + 1,
    };
  }, {});
  const slaSummary = list.reduce(
    (summary, task) => {
      const state = getTaskSlaState(task);
      if (state.id === 'healthy') {
        summary.healthy += 1;
      } else if (state.id === 'at_risk') {
        summary.atRisk += 1;
      } else if (state.id === 'critical') {
        summary.critical += 1;
      } else if (state.id === 'overdue') {
        summary.overdue += 1;
      } else if (state.id === 'breached') {
        summary.breached += 1;
      }
      return summary;
    },
    { healthy: 0, atRisk: 0, critical: 0, overdue: 0, breached: 0 }
  );

  return {
    all: list.length,
    assigned: list.filter((task) => task.assignedToMe).length,
    important: list.filter((task) => task.important).length,
    completed: completedCount,
    open: list.filter((task) => !task.completed).length,
    manual: list.filter((task) => task.sourceType === 'manual').length,
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
    unassigned: list.filter(
      (task) => !(task.assignedTo || []).length && (!task.owner || task.owner === 'Nieprzypisane')
    ).length,
    waiting: list.filter((task) => task.status === 'waiting').length,
    inProgress: list.filter((task) => task.status === 'in_progress').length,
    grouped: list.filter((task) => Boolean(task.group)).length,
    recurring: list.filter((task) => Boolean(task.recurrence)).length,
    blocked: list.filter((task) => getTaskDependencyDetails(task, list).blocking).length,
    commented: list.filter((task) => (task.comments || []).length).length,
    subtasksOpen: allSubtasks.filter((subtask) => !subtask.completed).length,
    subtasksCompleted: allSubtasks.filter((subtask) => subtask.completed).length,
    progress: list.length ? Math.round((completedCount / list.length) * 100) : 0,
    byPriority,
    byStatus,
    slaHealthy: slaSummary.healthy,
    slaAtRisk: slaSummary.atRisk,
    slaCritical: slaSummary.critical,
    slaBreached: slaSummary.overdue + slaSummary.breached,
  };
}
