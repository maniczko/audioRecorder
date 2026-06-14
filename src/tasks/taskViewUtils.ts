import { getTaskOrder, TASK_PRIORITIES } from '../lib/tasks';

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toInputDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formatListDueDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(date)
    .replace(/\./g, '');
}

export function dueTone(value) {
  if (!value) {
    return 'normal';
  }

  const date = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today.getTime()) {
    return 'danger';
  }

  return 'normal';
}

function priorityLabel(priority) {
  const labels = {
    high: 'Wysoki',
    medium: 'Średni',
    low: 'Niski',
  };
  return labels[priority] || priority || 'Średni';
}

function statusLabel(status, boardColumns) {
  return boardColumns.find((column) => column.id === status)?.label || status;
}

export function buildSidebarLists(tasks, boardColumns) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(todayStart.getDate() + 7);

  const isDueToday = (task) => {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate).getTime();
    return due >= todayStart.getTime() && due < tomorrowStart.getTime();
  };

  const isDueThisWeek = (task) => {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate).getTime();
    return due >= todayStart.getTime() && due < weekEnd.getTime();
  };

  const normalizeStatusLabel = (column) => {
    const id = String(column.id || '').toLowerCase();
    const label = String(column.label || '');
    if (column.isDone || id === 'done' || /zako|uko|done/i.test(label)) return 'Ukończone';
    if (id === 'todo') return 'Do zrobienia';
    if (id === 'in_progress') return 'W toku';
    if (id === 'waiting') return 'Oczekuje';
    return label;
  };

  const workspaceLists = boardColumns.map((column) => ({
    id: `column:${column.id}`,
    label: column.label,
    icon: 'o',
    count: tasks.filter((task) => task.status === column.id).length,
  }));

  const customGroups = Array.from(
    new Set<string>(tasks.map((task) => String(task.group || '').trim()).filter(Boolean))
  )
    .sort((left: string, right: string) => left.localeCompare(right))
    .map((group) => ({
      id: `group:${group}`,
      label: group,
      count: tasks.filter((task) => task.group === group).length,
    }));

  const taskLists = [
    {
      id: 'smart:today',
      label: 'Dziś',
      icon: 'today',
      count: tasks.filter(isDueToday).length,
    },
    {
      id: 'smart:week',
      label: 'Ten tydzień',
      icon: 'week',
      count: tasks.filter(isDueThisWeek).length,
    },
    {
      id: 'smart:planned',
      label: 'Zaplanowane',
      icon: 'planned',
      count: tasks.filter((task) => task.dueDate).length,
    },
    {
      id: 'smart:overdue',
      label: 'Zaległe',
      icon: 'overdue',
      count: tasks.filter(
        (task) => task.dueDate && !task.completed && new Date(task.dueDate).getTime() < Date.now()
      ).length,
    },
    {
      id: 'smart:important',
      label: 'Ważne',
      icon: 'important',
      count: tasks.filter((task) => task.important).length,
    },
    {
      id: 'smart:assigned',
      label: 'Przypisane do mnie',
      icon: 'assigned',
      count: tasks.filter((task) => task.assignedToMe).length,
    },
    { id: 'smart:all', label: 'Wszystkie', icon: 'all', count: tasks.length },
  ];

  const statusLists = workspaceLists.map((item) => {
    const columnId = item.id.slice('column:'.length);
    const column = boardColumns.find((candidate) => candidate.id === columnId) || {};
    return {
      ...item,
      label: normalizeStatusLabel(column),
      icon: column.isDone ? 'completed' : columnId,
    };
  });

  const priorityLists = ['high', 'medium', 'low'].map((priority) => ({
    id: `priority:${priority}`,
    label: priorityLabel(priority),
    icon: `priority-${priority}`,
    count: tasks.filter((task) => (task.priority || 'medium') === priority).length,
  }));

  const customLists = customGroups.map((item) => ({ ...item, icon: 'custom' }));

  return {
    taskLists,
    statusLists,
    priorityLists,
    customLists,
    baseLists: taskLists,
    workspaceLists: statusLists,
    priorityGroups: priorityLists,
    customGroups: customLists,
  };
}
export function applyMainListFilter(tasks, mainListId, boardColumns) {
  if (!mainListId || mainListId === 'smart:all') {
    return tasks;
  }

  if (mainListId === 'smart:today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    return tasks.filter((task) => {
      if (!task.dueDate || task.completed) return false;
      const due = new Date(task.dueDate).getTime();
      return due >= todayStart.getTime() && due < tomorrowStart.getTime();
    });
  }

  if (mainListId === 'smart:week') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(todayStart.getDate() + 7);
    return tasks.filter((task) => {
      if (!task.dueDate || task.completed) return false;
      const due = new Date(task.dueDate).getTime();
      return due >= todayStart.getTime() && due < weekEnd.getTime();
    });
  }

  if (mainListId === 'smart:my_day') {
    return tasks.filter((task) => task.myDay && !task.completed);
  }

  if (mainListId === 'smart:important') {
    return tasks.filter((task) => task.important);
  }

  if (mainListId === 'smart:planned') {
    return tasks.filter((task) => Boolean(task.dueDate));
  }

  if (mainListId === 'smart:overdue') {
    return tasks.filter(
      (task) => task.dueDate && !task.completed && new Date(task.dueDate).getTime() < Date.now()
    );
  }

  if (mainListId === 'smart:completed') {
    return tasks.filter((task) => task.completed);
  }

  if (mainListId === 'smart:assigned') {
    return tasks.filter((task) => task.assignedToMe);
  }

  if (mainListId.startsWith('column:')) {
    const columnId = mainListId.slice('column:'.length);
    if (boardColumns.some((column) => column.id === columnId)) {
      return tasks.filter((task) => task.status === columnId);
    }
  }

  if (mainListId.startsWith('priority:')) {
    const priority = mainListId.slice('priority:'.length);
    return tasks.filter((task) => (task.priority || 'medium') === priority);
  }

  if (mainListId.startsWith('group:')) {
    const groupName = mainListId.slice('group:'.length);
    return tasks.filter((task) => task.group === groupName);
  }

  return tasks;
}

function priorityRank(priority) {
  const rank = ['urgent', 'high', 'medium', 'low'].indexOf(priority);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function parseSortBy(sortBy = 'due:asc') {
  if (!sortBy || sortBy === 'manual') {
    return { field: 'manual', direction: 'asc' };
  }

  const [field, rawDirection] = String(sortBy).split(':');
  return {
    field,
    direction: rawDirection === 'desc' ? 'desc' : 'asc',
  };
}

function dueTime(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function sortVisibleTasks(tasks, sortBy) {
  const { field, direction } = parseSortBy(sortBy);
  const directionMultiplier = direction === 'desc' ? -1 : 1;

  return [...tasks].sort((left, right) => {
    if (field === 'manual') {
      return getTaskOrder(left) - getTaskOrder(right);
    }
    if (field === 'title') {
      return (
        directionMultiplier * String(left.title || '').localeCompare(String(right.title || ''))
      );
    }
    if (field === 'status') {
      return (
        directionMultiplier * String(left.status || '').localeCompare(String(right.status || ''))
      );
    }
    if (field === 'due') {
      const leftDue = dueTime(left.dueDate);
      const rightDue = dueTime(right.dueDate);
      if (!Number.isFinite(leftDue) && Number.isFinite(rightDue)) return 1;
      if (Number.isFinite(leftDue) && !Number.isFinite(rightDue)) return -1;
      return directionMultiplier * (leftDue - rightDue);
    }
    if (field === 'owner') {
      return (
        directionMultiplier * String(left.owner || '').localeCompare(String(right.owner || ''))
      );
    }
    if (field === 'source') {
      const leftSource = left.sourceType || (left.sourceMeetingId ? 'meeting' : 'manual');
      const rightSource = right.sourceType || (right.sourceMeetingId ? 'meeting' : 'manual');
      return directionMultiplier * String(leftSource).localeCompare(String(rightSource));
    }
    if (field === 'priority') {
      return directionMultiplier * (priorityRank(left.priority) - priorityRank(right.priority));
    }

    const updatedDescending =
      new Date(right.updatedAt || right.createdAt).getTime() -
      new Date(left.updatedAt || left.createdAt).getTime();
    return direction === 'asc' ? updatedDescending * -1 : updatedDescending;
  });
}

export function groupTasks(tasks, groupBy, boardColumns) {
  if (groupBy === 'none') {
    return [{ id: 'all', label: '', tasks }];
  }

  const map = new Map();
  tasks.forEach((task) => {
    let key = 'other';
    let label = 'Other';

    if (groupBy === 'status') {
      key = task.status;
      label = boardColumns.find((column) => column.id === task.status)?.label || task.status;
    } else if (groupBy === 'owner') {
      key = task.owner || 'unassigned';
      label = task.owner || 'Nieprzypisane';
    } else if (groupBy === 'priority') {
      key = task.priority;
      label =
        TASK_PRIORITIES.find((priority) => priority.id === task.priority)?.label || task.priority;
    } else if (groupBy === 'group') {
      key = task.group || '__ungrouped__';
      label = task.group || 'Bez grupy';
    } else if (groupBy === 'source') {
      key = task.sourceType;
      label =
        task.sourceType === 'meeting'
          ? 'Spotkania'
          : task.sourceType === 'google'
            ? 'Google Tasks'
            : 'Reczne';
    }

    const bucket = map.get(key) || { id: key, label, tasks: [] };
    bucket.tasks.push(task);
    map.set(key, bucket);
  });

  return [...map.values()];
}

export function createQuickDraft(boardColumns) {
  return {
    title: '',
    owner: '',
    group: '',
    dueDate: '',
    reminderAt: '',
    description: '',
    status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || '',
    important: false,
    myDay: false,
    priority: 'medium',
    tags: '',
    notes: '',
    links: [],
  };
}

export function canDrop(event) {
  if (event.dataTransfer) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
}

export function writeDragTask(event, taskId) {
  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.setData('text/plain', taskId);
  event.dataTransfer.setData('application/x-voicelog-task', taskId);
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragTask(event) {
  if (!event.dataTransfer) {
    return '';
  }

  return (
    event.dataTransfer.getData('application/x-voicelog-task') ||
    event.dataTransfer.getData('text/plain') ||
    ''
  );
}

export function getSelectedListLabel(sidebarLists, selectedListId) {
  return (
    sidebarLists.baseLists.find((item) => item.id === selectedListId)?.label ||
    sidebarLists.workspaceLists.find((item) => item.id === selectedListId)?.label ||
    sidebarLists.priorityLists?.find((item) => item.id === selectedListId)?.label ||
    sidebarLists.priorityGroups?.find((item) => item.id === selectedListId)?.label ||
    sidebarLists.customGroups.find((item) => item.id === selectedListId)?.label ||
    'Zadania'
  );
}

export function buildContextualDraft(quickDraft, selectedListId, boardColumns) {
  const nextDraft = { ...quickDraft };

  if (selectedListId?.startsWith('column:')) {
    const columnId = selectedListId.slice('column:'.length);
    if (boardColumns.some((column) => column.id === columnId)) {
      nextDraft.status = columnId;
    }
  }

  if (selectedListId?.startsWith('group:') && !nextDraft.group) {
    nextDraft.group = selectedListId.slice('group:'.length);
  }

  return nextDraft;
}

export function taskMatchesVisibleContext(task, filters) {
  if (!task) {
    return false;
  }

  if (filters.ownerFilter !== 'all' && task.owner !== filters.ownerFilter) {
    return false;
  }

  if (filters.tagFilter !== 'all' && !(task.tags || []).includes(filters.tagFilter)) {
    return false;
  }

  if (filters.query.trim()) {
    const haystack = [
      task.title,
      task.owner,
      task.group,
      task.description,
      task.notes,
      statusLabel(task.status, filters.boardColumns || []),
      priorityLabel(task.priority),
      safeArray(task.tags).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(filters.query.trim().toLowerCase())) {
      return false;
    }
  }

  if (!filters.selectedListId || filters.selectedListId === 'smart:all') {
    return true;
  }

  return applyMainListFilter([task], filters.selectedListId, filters.boardColumns).length > 0;
}

export function handleCardKeyDown(event, callback) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    callback();
  }
}
