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

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
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

export function buildSidebarLists(tasks, boardColumns) {
  const baseLists = [
    {
      id: 'smart:important',
      label: 'Ważne',
      icon: '⭐',
      count: tasks.filter((task) => task.important).length,
    },
    {
      id: 'smart:planned',
      label: 'Zaplanowane',
      icon: '📅',
      count: tasks.filter((task) => task.dueDate).length,
    },
    {
      id: 'smart:overdue',
      label: 'Zaległe',
      icon: '⚠️',
      count: tasks.filter(
        (task) => task.dueDate && !task.completed && new Date(task.dueDate).getTime() < Date.now()
      ).length,
    },
    {
      id: 'smart:completed',
      label: 'Zakończone',
      icon: '✓',
      count: tasks.filter((task) => task.completed).length,
    },
    {
      id: 'smart:assigned',
      label: 'Przypisane do mnie',
      icon: '👤',
      count: tasks.filter((task) => task.assignedToMe).length,
    },
    { id: 'smart:all', label: 'Zadania', icon: '✦', count: tasks.length },
  ];

  const workspaceLists = boardColumns.map((column) => ({
    id: `column:${column.id}`,
    label: column.label,
    icon: '◉',
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

  return { baseLists, workspaceLists, customGroups };
}

export function applyMainListFilter(tasks, mainListId, boardColumns) {
  if (!mainListId || mainListId === 'smart:all') {
    return tasks;
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

  if (mainListId.startsWith('group:')) {
    const groupName = mainListId.slice('group:'.length);
    return tasks.filter((task) => task.group === groupName);
  }

  return tasks;
}

function priorityRank(priority) {
  return ['urgent', 'high', 'medium', 'low'].indexOf(priority);
}

export function sortVisibleTasks(tasks, sortBy) {
  return [...tasks].sort((left, right) => {
    if (sortBy === 'manual') {
      return getTaskOrder(left) - getTaskOrder(right);
    }
    if (sortBy === 'title') {
      return left.title.localeCompare(right.title);
    }
    if (sortBy === 'due') {
      return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime();
    }
    if (sortBy === 'owner') {
      return (left.owner || '').localeCompare(right.owner || '');
    }
    if (sortBy === 'priority') {
      return priorityRank(left.priority) - priorityRank(right.priority);
    }
    return (
      new Date(right.updatedAt || right.createdAt).getTime() -
      new Date(left.updatedAt || left.createdAt).getTime()
    );
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
