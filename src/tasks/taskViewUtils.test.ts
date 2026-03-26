import { describe, it, expect, vi } from 'vitest';
import {
  safeArray,
  toInputDateTime,
  formatListDueDate,
  dueTone,
  canDrop,
  writeDragTask,
  readDragTask,
  handleCardKeyDown,
  sortVisibleTasks,
  groupTasks,
  applyMainListFilter,
  buildSidebarLists,
  createQuickDraft,
  buildContextualDraft,
  taskMatchesVisibleContext,
  getSelectedListLabel,
} from './taskViewUtils';

/* ------------------------------------------------------------------ */
/*  safeArray                                                         */
/* ------------------------------------------------------------------ */
describe('safeArray', () => {
  it('returns the same array if given an array', () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
  });
  it('returns [] for non-array values', () => {
    expect(safeArray(undefined)).toEqual([]);
    expect(safeArray(null)).toEqual([]);
    expect(safeArray('hello')).toEqual([]);
    expect(safeArray(42)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  toInputDateTime                                                   */
/* ------------------------------------------------------------------ */
describe('toInputDateTime', () => {
  it('returns empty string for falsy value', () => {
    expect(toInputDateTime('')).toBe('');
    expect(toInputDateTime(null)).toBe('');
    expect(toInputDateTime(undefined)).toBe('');
  });
  it('returns empty string for invalid date', () => {
    expect(toInputDateTime('not-a-date')).toBe('');
  });
  it('returns YYYY-MM-DDTHH:mm format for valid ISO string', () => {
    const result = toInputDateTime('2026-06-15T10:30:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

/* ------------------------------------------------------------------ */
/*  formatListDueDate                                                 */
/* ------------------------------------------------------------------ */
describe('formatListDueDate', () => {
  it('returns empty string for falsy', () => {
    expect(formatListDueDate('')).toBe('');
    expect(formatListDueDate(null)).toBe('');
  });
  it('returns empty string for invalid date', () => {
    expect(formatListDueDate('bad')).toBe('');
  });
  it('formats a valid date', () => {
    const result = formatListDueDate('2026-01-15');
    expect(result).toMatch(/01/);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2026/);
  });
});

/* ------------------------------------------------------------------ */
/*  dueTone                                                           */
/* ------------------------------------------------------------------ */
describe('dueTone', () => {
  it('returns normal for falsy', () => {
    expect(dueTone('')).toBe('normal');
    expect(dueTone(null)).toBe('normal');
  });
  it('returns danger for past date', () => {
    expect(dueTone('2020-01-01')).toBe('danger');
  });
  it('returns normal for future date', () => {
    expect(dueTone('2099-12-31')).toBe('normal');
  });
});

/* ------------------------------------------------------------------ */
/*  canDrop / writeDragTask / readDragTask                            */
/* ------------------------------------------------------------------ */
describe('drag helpers', () => {
  it('canDrop calls preventDefault and sets dropEffect', () => {
    const event = {
      dataTransfer: { dropEffect: '' },
      preventDefault: vi.fn(),
    };
    canDrop(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('move');
  });

  it('canDrop does nothing without dataTransfer', () => {
    const event = { preventDefault: vi.fn() };
    canDrop(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('writeDragTask sets dataTransfer data', () => {
    const setData = vi.fn();
    const event = { dataTransfer: { setData, effectAllowed: '' } };
    writeDragTask(event, 'task-123');
    expect(setData).toHaveBeenCalledWith('text/plain', 'task-123');
    expect(setData).toHaveBeenCalledWith('application/x-voicelog-task', 'task-123');
    expect(event.dataTransfer.effectAllowed).toBe('move');
  });

  it('writeDragTask does nothing without dataTransfer', () => {
    expect(() => writeDragTask({}, 'task-123')).not.toThrow();
  });

  it('readDragTask reads from custom type first', () => {
    const event = {
      dataTransfer: {
        getData: (type) => (type === 'application/x-voicelog-task' ? 'task-abc' : 'task-fallback'),
      },
    };
    expect(readDragTask(event)).toBe('task-abc');
  });

  it('readDragTask falls back to text/plain', () => {
    const event = {
      dataTransfer: {
        getData: (type) => (type === 'text/plain' ? 'task-plain' : ''),
      },
    };
    expect(readDragTask(event)).toBe('task-plain');
  });

  it('readDragTask returns empty string without dataTransfer', () => {
    expect(readDragTask({})).toBe('');
  });
});

/* ------------------------------------------------------------------ */
/*  handleCardKeyDown                                                 */
/* ------------------------------------------------------------------ */
describe('handleCardKeyDown', () => {
  it('calls callback on Enter', () => {
    const cb = vi.fn();
    const event = { key: 'Enter', preventDefault: vi.fn() };
    handleCardKeyDown(event, cb);
    expect(cb).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
  it('calls callback on Space', () => {
    const cb = vi.fn();
    const event = { key: ' ', preventDefault: vi.fn() };
    handleCardKeyDown(event, cb);
    expect(cb).toHaveBeenCalled();
  });
  it('does not call callback on other keys', () => {
    const cb = vi.fn();
    const event = { key: 'a', preventDefault: vi.fn() };
    handleCardKeyDown(event, cb);
    expect(cb).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  sortVisibleTasks                                                  */
/* ------------------------------------------------------------------ */
describe('sortVisibleTasks', () => {
  const tasks = [
    { id: '1', title: 'Bravo', priority: 'low', owner: 'Zoe', dueDate: '2026-03-10', order: 2 },
    { id: '2', title: 'Alpha', priority: 'high', owner: 'Ana', dueDate: '2026-01-05', order: 1 },
    {
      id: '3',
      title: 'Charlie',
      priority: 'medium',
      owner: 'Mia',
      dueDate: '2026-06-20',
      order: 3,
    },
  ];

  it('sorts by title alphabetically', () => {
    const sorted = sortVisibleTasks(tasks, 'title');
    expect(sorted.map((t) => t.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sorts by priority (urgent > high > medium > low)', () => {
    const sorted = sortVisibleTasks(tasks, 'priority');
    expect(sorted.map((t) => t.priority)).toEqual(['high', 'medium', 'low']);
  });

  it('sorts by owner alphabetically', () => {
    const sorted = sortVisibleTasks(tasks, 'owner');
    expect(sorted.map((t) => t.owner)).toEqual(['Ana', 'Mia', 'Zoe']);
  });

  it('sorts by due date ascending', () => {
    const sorted = sortVisibleTasks(tasks, 'due');
    expect(sorted.map((t) => t.id)).toEqual(['2', '1', '3']);
  });
});

/* ------------------------------------------------------------------ */
/*  groupTasks                                                        */
/* ------------------------------------------------------------------ */
describe('groupTasks', () => {
  const columns = [
    { id: 'todo', label: 'Do zrobienia' },
    { id: 'done', label: 'Zakończone' },
  ];
  const tasks = [
    { id: '1', status: 'todo', owner: 'Ana', priority: 'high', group: 'Sprint1' },
    { id: '2', status: 'done', owner: 'Ana', priority: 'low', group: '' },
    { id: '3', status: 'todo', owner: 'Bob', priority: 'high', group: 'Sprint1' },
  ];

  it('returns a single group for groupBy=none', () => {
    const groups = groupTasks(tasks, 'none', columns);
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks).toHaveLength(3);
  });

  it('groups by status', () => {
    const groups = groupTasks(tasks, 'status', columns);
    expect(groups.map((g) => g.id).sort()).toEqual(['done', 'todo']);
  });

  it('groups by owner', () => {
    const groups = groupTasks(tasks, 'owner', columns);
    expect(groups.map((g) => g.id).sort()).toEqual(['Ana', 'Bob']);
  });

  it('groups by group name', () => {
    const groups = groupTasks(tasks, 'group', columns);
    const ids = groups.map((g) => g.id).sort();
    expect(ids).toEqual(['Sprint1', '__ungrouped__']);
  });
});

/* ------------------------------------------------------------------ */
/*  applyMainListFilter                                               */
/* ------------------------------------------------------------------ */
describe('applyMainListFilter', () => {
  const columns = [{ id: 'col1' }, { id: 'col2' }];
  const tasks = [
    {
      id: '1',
      important: true,
      dueDate: '2099-01-01',
      completed: false,
      status: 'col1',
      group: 'A',
      myDay: true,
    },
    {
      id: '2',
      important: false,
      dueDate: '',
      completed: true,
      status: 'col2',
      group: 'B',
      myDay: false,
    },
    {
      id: '3',
      important: false,
      dueDate: '2020-01-01',
      completed: false,
      status: 'col1',
      group: 'A',
      myDay: false,
    },
  ];

  it('returns all tasks for smart:all', () => {
    expect(applyMainListFilter(tasks, 'smart:all', columns)).toHaveLength(3);
  });
  it('filters important tasks', () => {
    expect(applyMainListFilter(tasks, 'smart:important', columns)).toHaveLength(1);
  });
  it('filters planned tasks', () => {
    expect(applyMainListFilter(tasks, 'smart:planned', columns)).toHaveLength(2);
  });
  it('filters completed tasks', () => {
    expect(applyMainListFilter(tasks, 'smart:completed', columns)).toHaveLength(1);
  });
  it('filters overdue tasks', () => {
    const overdue = applyMainListFilter(tasks, 'smart:overdue', columns);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].id).toBe('3');
  });
  it('filters by column', () => {
    expect(applyMainListFilter(tasks, 'column:col1', columns)).toHaveLength(2);
    expect(applyMainListFilter(tasks, 'column:col2', columns)).toHaveLength(1);
  });
  it('filters by group', () => {
    expect(applyMainListFilter(tasks, 'group:A', columns)).toHaveLength(2);
    expect(applyMainListFilter(tasks, 'group:B', columns)).toHaveLength(1);
  });
  it('filters my_day tasks', () => {
    expect(applyMainListFilter(tasks, 'smart:my_day', columns)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/*  buildSidebarLists                                                 */
/* ------------------------------------------------------------------ */
describe('buildSidebarLists', () => {
  it('returns baseLists, workspaceLists, and customGroups', () => {
    const columns = [{ id: 'c1', label: 'Col1' }];
    const tasks = [
      { id: '1', status: 'c1', important: true, group: 'Sprint1' },
      { id: '2', status: 'c1', group: '' },
    ];
    const result = buildSidebarLists(tasks, columns);
    expect(result.baseLists.length).toBeGreaterThan(0);
    expect(result.workspaceLists).toHaveLength(1);
    expect(result.customGroups).toHaveLength(1);
    expect(result.customGroups[0].label).toBe('Sprint1');
  });
});

/* ------------------------------------------------------------------ */
/*  createQuickDraft                                                  */
/* ------------------------------------------------------------------ */
describe('createQuickDraft', () => {
  it('creates a draft with first non-done column status', () => {
    const cols = [
      { id: 'done', label: 'Done', isDone: true },
      { id: 'todo', label: 'To Do', isDone: false },
    ];
    const draft = createQuickDraft(cols);
    expect(draft.status).toBe('todo');
    expect(draft.title).toBe('');
    expect(draft.priority).toBe('medium');
  });
  it('falls back to first column if all are done', () => {
    const cols = [{ id: 'done', label: 'Done', isDone: true }];
    const draft = createQuickDraft(cols);
    expect(draft.status).toBe('done');
  });
});

/* ------------------------------------------------------------------ */
/*  buildContextualDraft                                              */
/* ------------------------------------------------------------------ */
describe('buildContextualDraft', () => {
  const cols = [{ id: 'c1' }, { id: 'c2' }];

  it('sets status from column: list', () => {
    const draft = buildContextualDraft({ status: 'c1' }, 'column:c2', cols);
    expect(draft.status).toBe('c2');
  });
  it('sets group from group: list if empty', () => {
    const draft = buildContextualDraft({ group: '' }, 'group:Alpha', cols);
    expect(draft.group).toBe('Alpha');
  });
  it('does not override existing group', () => {
    const draft = buildContextualDraft({ group: 'Beta' }, 'group:Alpha', cols);
    expect(draft.group).toBe('Beta');
  });
});

/* ------------------------------------------------------------------ */
/*  taskMatchesVisibleContext                                          */
/* ------------------------------------------------------------------ */
describe('taskMatchesVisibleContext', () => {
  const filters = {
    selectedListId: 'smart:all',
    ownerFilter: 'all',
    tagFilter: 'all',
    query: '',
    boardColumns: [{ id: 'c1' }],
  };
  const task = { id: '1', title: 'Test', owner: 'Ana', tags: ['ui'], status: 'c1' };

  it('returns true with no filters', () => {
    expect(taskMatchesVisibleContext(task, filters)).toBe(true);
  });
  it('returns false for null task', () => {
    expect(taskMatchesVisibleContext(null, filters)).toBe(false);
  });
  it('filters by owner', () => {
    expect(taskMatchesVisibleContext(task, { ...filters, ownerFilter: 'Bob' })).toBe(false);
    expect(taskMatchesVisibleContext(task, { ...filters, ownerFilter: 'Ana' })).toBe(true);
  });
  it('filters by tag', () => {
    expect(taskMatchesVisibleContext(task, { ...filters, tagFilter: 'ui' })).toBe(true);
    expect(taskMatchesVisibleContext(task, { ...filters, tagFilter: 'backend' })).toBe(false);
  });
  it('filters by query text', () => {
    expect(taskMatchesVisibleContext(task, { ...filters, query: 'test' })).toBe(true);
    expect(taskMatchesVisibleContext(task, { ...filters, query: 'xyz' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  getSelectedListLabel                                              */
/* ------------------------------------------------------------------ */
describe('getSelectedListLabel', () => {
  const lists = {
    baseLists: [{ id: 'smart:all', label: 'Tasks' }],
    workspaceLists: [{ id: 'column:c1', label: 'To Do' }],
    customGroups: [{ id: 'group:Sprint', label: 'Sprint' }],
  };

  it('returns label from baseLists', () => {
    expect(getSelectedListLabel(lists, 'smart:all')).toBe('Tasks');
  });
  it('returns label from workspaceLists', () => {
    expect(getSelectedListLabel(lists, 'column:c1')).toBe('To Do');
  });
  it('returns label from customGroups', () => {
    expect(getSelectedListLabel(lists, 'group:Sprint')).toBe('Sprint');
  });
  it('returns fallback Tasks for unknown id', () => {
    expect(getSelectedListLabel(lists, 'unknown')).toBe('Tasks');
  });
});
