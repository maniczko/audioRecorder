import {
  parseTagInput,
  normalizeTaskPeopleList,
  normalizeTaskDependencies,
  normalizeTaskComments,
  normalizeTaskHistory,
  normalizeTaskSubtasks,
  normalizeTaskLinks,
  normalizeTaskRecurrence,
  createTaskComment,
  createTaskSubtask,
  createTaskHistoryEntry,
  getTaskDependencyDetails,
  validateTaskDependencies,
  validateTaskCompletion,
  getTaskSlaState,
  buildTaskNotifications,
  getTaskOrder,
  getNextTaskOrderTop,
  buildTaskReorderUpdate,
  nextRecurringDueDate,
  buildTaskChangeHistory,
  getTaskAssigneeSummary,
  buildTaskColumns,
  createTaskColumn,
  buildTaskPeople,
  buildTaskTags,
  buildTaskGroups,
  createManualTask,
  createTaskFromGoogle,
  createRecurringTaskFromTask,
  upsertGoogleImportedTasks,
  extractMeetingTasks,
  buildTasksFromMeetings,
  taskListStats,
  DEFAULT_TASK_COLUMNS,
} from './tasks';

describe('extended tasks functions', () => {
  test('normalization functions', () => {
    expect(parseTagInput('a, b#c\nd')).toEqual(['a', 'b', 'c', 'd']);
    expect(normalizeTaskPeopleList('a, b\nc')).toEqual(['a', 'b', 'c']);
    expect(normalizeTaskDependencies(['1', '2', '2'])).toEqual(['1', '2']);
    expect(
      normalizeTaskComments(['test', { text: 'test2', id: '1', author: 'Bob', createdAt: 'now' }])
    ).toHaveLength(2);
    expect(normalizeTaskHistory([{ message: 'test msg', type: 'status' }])).toHaveLength(1);
    expect(normalizeTaskSubtasks(['sub1', { title: 'sub2', completed: true }])).toHaveLength(2);
    expect(
      normalizeTaskLinks(['http://test.com', { url: 'http://test2.com', label: 't2' }])
    ).toHaveLength(2);
    expect(normalizeTaskRecurrence('daily')).toEqual({ frequency: 'daily', interval: 1 });
  });

  test('creation functions', () => {
    expect(createTaskComment('hello').text).toBe('hello');
    expect(createTaskSubtask('todo').title).toBe('todo');
    expect(createTaskHistoryEntry('done').message).toBe('done');
  });

  test('dependency details', () => {
    const tasks = [
      { id: 't1', completed: false },
      { id: 't2', completed: true },
    ];
    const targetTask = { id: 'tt', dependencies: ['t1', 't2', 'nonexistent'] };
    const details = getTaskDependencyDetails(targetTask, tasks);
    expect(details.dependencies).toHaveLength(2);
    expect(details.unresolved).toHaveLength(1);
    expect(details.blocking).toBe(true);
  });

  test('validation functions', () => {
    expect(() => validateTaskDependencies('t1', ['t1'], [])).toThrow();
    const tasks = [
      { id: 't1', dependencies: ['t2'] },
      { id: 't2', dependencies: ['t1'] },
    ];
    expect(() => validateTaskDependencies('t3', ['t1'], tasks)).toThrow(); // cyclic

    expect(() =>
      validateTaskCompletion({ id: 't1', dependencies: ['t2'] }, { completed: true }, [
        { id: 't2', completed: false, title: 'Blocked By t2' },
      ])
    ).toThrow();
  });

  test('sla and notifications', () => {
    const past = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    expect(getTaskSlaState({ dueDate: past }).tone).toBe('danger');
    expect(buildTaskNotifications([{ id: 't1', dueDate: past, completed: false }])).toHaveLength(1);
  });

  test('order functions', () => {
    expect(getTaskOrder({ order: 10 })).toBe(10);
    expect(getNextTaskOrderTop([{ order: 10 }])).toBeLessThan(10);
  });

  test('change history build', () => {
    const h = buildTaskChangeHistory(
      { title: 'A', tags: ['a'] },
      { title: 'B', tags: ['a', 'b'] },
      'User',
      DEFAULT_TASK_COLUMNS
    );
    expect(h.length).toBeGreaterThan(1);
  });

  test('assignee summary', () => {
    expect(getTaskAssigneeSummary({})).toBe('Nieprzypisane');
    expect(getTaskAssigneeSummary({ assignedTo: ['a', 'b'] })).toBe('a +1');
  });

  test('columns', () => {
    expect(buildTaskColumns({}, 'workspace_1').length).toBe(DEFAULT_TASK_COLUMNS.length);
    const newBoard = createTaskColumn({}, 'workspace_1', { label: 'Nowa kolumna' });
    expect(newBoard['workspace_1'].columns.length).toBeGreaterThan(DEFAULT_TASK_COLUMNS.length);
  });

  test('recurrence, SLA and ordering branches', () => {
    expect(normalizeTaskRecurrence({ frequency: 'weekly', interval: 2 })).toEqual({
      frequency: 'weekly',
      interval: 2,
    });
    expect(normalizeTaskRecurrence({ frequency: 'invalid' })).toBeNull();
    expect(
      nextRecurringDueDate('2026-03-24T10:00:00.000Z', { frequency: 'daily', interval: 2 })
    ).toBe('2026-03-26T10:00:00.000Z');
    expect(getTaskSlaState({}).id).toBe('none');
    expect(
      getTaskSlaState({ dueDate: '2026-03-24T20:00:00.000Z' }, new Date('2026-03-24T10:00:00.000Z'))
        .id
    ).toBe('at_risk');
    expect(
      getTaskSlaState({ dueDate: '2026-03-24T13:00:00.000Z' }, new Date('2026-03-24T10:00:00.000Z'))
        .id
    ).toBe('critical');
    expect(
      getTaskSlaState({ dueDate: '2026-03-24T09:00:00.000Z' }, new Date('2026-03-24T10:00:00.000Z'))
        .id
    ).toBe('overdue');
    expect(
      getTaskSlaState({ dueDate: '2026-03-23T10:00:00.000Z' }, new Date('2026-03-24T10:00:00.000Z'))
        .id
    ).toBe('breached');
    expect(
      buildTaskReorderUpdate(
        [
          { id: 'a', order: 10 },
          { id: 'b', order: 20 },
        ],
        { previousTaskId: 'a', nextTaskId: 'b', status: 'done', group: 'Nowa grupa' }
      )
    ).toMatchObject({ order: 15, status: 'done', group: 'Nowa grupa' });
  });

  test('builds history entries for many changes', () => {
    const history = buildTaskChangeHistory(
      {
        title: 'A',
        status: 'todo',
        completed: false,
        owner: 'Ola',
        assignedTo: ['Ola'],
        group: 'Sprzedaz',
        priority: 'low',
        dueDate: '2026-03-24T10:00:00.000Z',
        description: 'Opis',
        notes: 'Notatki',
        important: false,
        tags: ['a'],
        dependencies: ['1'],
        comments: [],
        subtasks: [],
        recurrence: null,
        order: 1,
      },
      {
        title: 'B',
        status: 'done',
        completed: true,
        owner: 'Jan',
        assignedTo: ['Jan', 'Ala'],
        group: '',
        priority: 'high',
        dueDate: '2026-03-25T10:00:00.000Z',
        description: 'Nowy opis',
        notes: 'Nowe notatki',
        important: true,
        tags: ['a', 'b'],
        dependencies: ['1', '2'],
        comments: [{ id: 'c1' }],
        subtasks: [{ id: 's1' }],
        recurrence: { frequency: 'weekly', interval: 1 },
        order: 2,
      },
      'System',
      DEFAULT_TASK_COLUMNS
    );

    expect(history.length).toBeGreaterThan(8);
    expect(history.map((entry) => entry.type)).toEqual(
      expect.arrayContaining(['status', 'completed', 'owner'])
    );
  });

  test('builds task lists and stats', () => {
    const columns = DEFAULT_TASK_COLUMNS;
    const manualTask = createManualTask(
      'user_1',
      {
        title: '  przygotowac raport  ',
        owner: 'Ola',
        assignedTo: ['Ola', 'Jan'],
        description: 'Opis',
        dueDate: '2026-03-24T10:00:00.000Z',
        important: true,
        priority: 'high',
        tags: 'alpha, beta',
        group: 'sprzedaz',
        comments: ['Pierwszy komentarz'],
        dependencies: ['dep_1'],
        subtasks: ['Podzadanie'],
        links: ['https://example.com'],
        recurrence: { frequency: 'weekly', interval: 1 },
      },
      columns,
      'workspace_1'
    );
    const googleTask = createTaskFromGoogle(
      'user_1',
      {
        id: 'g1',
        title: 'google follow up',
        notes: 'Notatka',
        due: '2026-03-25T10:00:00.000Z',
        status: 'completed',
        updated: '2026-03-24T12:00:00.000Z',
      },
      { id: 'list_1', title: 'Lista' },
      columns,
      { name: 'Ola' },
      'workspace_1'
    );
    const recurring = createRecurringTaskFromTask(
      { ...manualTask, recurrence: { frequency: 'daily', interval: 1 } },
      'user_1',
      'workspace_1',
      columns,
      [manualTask]
    );
    const merged = upsertGoogleImportedTasks(
      [googleTask],
      [{ ...googleTask, title: 'google follow up updated', completed: true }],
      'user_1'
    );
    const extracted = extractMeetingTasks(
      {
        id: 'meeting_1',
        title: 'Spotkanie',
        startsAt: '2026-03-24T10:00:00.000Z',
        updatedAt: '2026-03-24T11:00:00.000Z',
        createdAt: '2026-03-24T09:00:00.000Z',
        tags: ['meeting'],
        analysis: { tasks: [{ title: 'Jan: Zrobic ofert', sourceQuote: 'ASAP' }] },
      },
      columns
    );
    const built = buildTasksFromMeetings(
      [
        {
          id: 'meeting_1',
          title: 'Spotkanie',
          startsAt: '2026-03-24T10:00:00.000Z',
          updatedAt: '2026-03-24T11:00:00.000Z',
          createdAt: '2026-03-24T09:00:00.000Z',
          tags: ['meeting'],
          analysis: { tasks: [{ title: 'Jan: Zrobic ofert', sourceQuote: 'ASAP' }] },
        },
      ],
      [manualTask],
      { [manualTask.id]: { title: 'Przygotowac raport' } },
      { id: 'user_1', name: 'Ola', email: 'ola@example.com' },
      columns,
      'workspace_1'
    );
    const stats = taskListStats([
      manualTask,
      {
        ...googleTask,
        completed: true,
        assignedToMe: true,
        subtasks: [{ completed: true }, { completed: false }],
      },
      {
        id: 't3',
        completed: false,
        dueDate: '2026-03-23T10:00:00.000Z',
        assignedTo: [],
        owner: '',
        sourceType: 'manual',
      },
    ]);

    expect(manualTask.title).toBe('Przygotowac raport');
    expect(manualTask.completed).toBe(false);
    expect(googleTask.status).toBe('done');
    expect(recurring).not.toBeNull();
    expect(merged.merged).toHaveLength(1);
    expect(merged.conflictCount).toBe(0);
    expect(extracted).toHaveLength(1);
    expect(built.length).toBeGreaterThan(0);
    expect(buildTaskPeople([], { name: 'Ola' }, [{ name: 'Jan' }], [manualTask])).toEqual(
      expect.arrayContaining(['Ola', 'Jan'])
    );
    expect(buildTaskTags([{ tags: ['a', 'b'] }], [{ tags: ['b', 'c'] }])).toEqual(['a', 'b', 'c']);
    expect(buildTaskGroups([{ group: 'A' }, { group: 'A' }, { group: 'B' }])).toEqual(['A', 'B']);
    expect(stats.all).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.open).toBe(2);
    expect(stats.manual).toBe(2);
  });
});
