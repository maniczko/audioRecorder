import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildTaskChangeHistory,
  buildTaskColumns,
  buildTaskGroups,
  buildTaskPeople,
  buildTaskReorderUpdate,
  buildTaskTags,
  buildTasksFromMeetings,
  createManualTask,
  createRecurringTaskFromTask,
  createTaskFromGoogle,
  DEFAULT_TASK_COLUMNS,
  extractMeetingTasks,
  getTaskLifecycleStatus,
  nextRecurringDueDate,
  TASK_LIFECYCLE_STATUSES,
  taskListStats,
  updateTaskColumns,
  upsertGoogleImportedTasks,
} from './tasks';
import type { TaskRecord } from '../shared/types';

describe('tasks extra coverage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('buildTaskReorderUpdate uses neighbors and placement fields', () => {
    const tasks = [
      { id: 't1', order: 0 },
      { id: 't2', order: 1024 },
      { id: 't3', order: 2048 },
    ];

    expect(buildTaskReorderUpdate(tasks, { previousTaskId: 't1', nextTaskId: 't2' }).order).toBe(
      512
    );
    expect(
      buildTaskReorderUpdate(tasks, { previousTaskId: 't2', status: 'waiting', group: 'Ops' })
    ).toEqual(expect.objectContaining({ order: 2048, status: 'waiting', group: 'Ops' }));
    expect(buildTaskReorderUpdate(tasks, { nextTaskId: 't2' }).order).toBe(0);
  });

  test('buildTaskReorderUpdate uses top order when no neighbors', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const update = buildTaskReorderUpdate([], {});
    expect(update.order).toBe(-new Date('2026-03-01T00:00:00.000Z').getTime());
  });

  // ------------------------------------------------------------------
  // Issue #1377 - canonical task lifecycle status
  // Date: 2026-07-06
  // Bug: task lifecycle was inferred differently from status, completed,
  //      archived, soft-delete, dependency and Google conflict fields.
  // Fix: getTaskLifecycleStatus centralizes the lifecycle mapping.
  // ------------------------------------------------------------------
  test('maps canonical task lifecycle statuses', () => {
    const columns = [
      { id: 'todo', label: 'Todo', isDone: false },
      { id: 'in_progress', label: 'Doing', isDone: false },
      { id: 'waiting', label: 'Waiting', isDone: false },
      { id: 'done', label: 'Done', isDone: true },
    ];
    const tasks = [
      { id: 'active', status: 'todo', completed: false },
      { id: 'in-progress', status: 'in_progress', completed: false },
      { id: 'waiting', status: 'waiting', completed: false },
      { id: 'dependency', status: 'todo', completed: false },
      { id: 'blocked', status: 'todo', completed: false, dependencies: ['dependency'] },
      { id: 'done-by-completed', status: 'todo', completed: true },
      { id: 'done-by-column', status: 'done', completed: false },
      { id: 'archived', status: 'done', completed: true, archived: true },
      { id: 'delete-pending', status: 'done', completed: true, _softDeleted: true },
      { id: 'conflict', status: 'todo', completed: false, googleSyncStatus: 'conflict' },
    ];

    expect(getTaskLifecycleStatus(tasks[0], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.ACTIVE);
    expect(getTaskLifecycleStatus(tasks[1], columns, tasks)).toBe(
      TASK_LIFECYCLE_STATUSES.IN_PROGRESS
    );
    expect(getTaskLifecycleStatus(tasks[2], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.WAITING);
    expect(getTaskLifecycleStatus(tasks[4], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.BLOCKED);
    expect(getTaskLifecycleStatus(tasks[5], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.DONE);
    expect(getTaskLifecycleStatus(tasks[6], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.DONE);
    expect(getTaskLifecycleStatus(tasks[7], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.ARCHIVED);
    expect(getTaskLifecycleStatus(tasks[8], columns, tasks)).toBe(
      TASK_LIFECYCLE_STATUSES.DELETE_PENDING
    );
    expect(getTaskLifecycleStatus(tasks[9], columns, tasks)).toBe(TASK_LIFECYCLE_STATUSES.CONFLICT);
  });

  test('nextRecurringDueDate advances based on recurrence', () => {
    expect(nextRecurringDueDate('', null)).toBe('');
    expect(nextRecurringDueDate('invalid', { frequency: 'daily' })).toBe('');
    expect(
      nextRecurringDueDate('2026-03-10T00:00:00.000Z', { frequency: 'daily', interval: 2 })
    ).toBe('2026-03-12T00:00:00.000Z');
    expect(
      nextRecurringDueDate('2026-03-10T00:00:00.000Z', { frequency: 'weekly', interval: 1 })
    ).toBe('2026-03-17T00:00:00.000Z');
    const expectedMonthly = new Date('2026-03-10T00:00:00.000Z');
    expectedMonthly.setMonth(expectedMonthly.getMonth() + 1);
    expect(
      nextRecurringDueDate('2026-03-10T00:00:00.000Z', { frequency: 'monthly', interval: 1 })
    ).toBe(expectedMonthly.toISOString());
  });

  test('createManualTask builds a normalized manual task', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

    const columns = [
      { id: 'todo', label: 'Todo', isDone: false },
      { id: 'done', label: 'Done', isDone: true },
    ];

    const task = createManualTask(
      'user_1',
      {
        title: '  raport kwartalny ',
        status: 'done',
        owner: 'Ola',
        tags: 'finanse, raport',
        group: '  sprzedaz ',
        comments: ['Start'],
      },
      columns,
      'ws_1'
    );
    const typedTask = task satisfies TaskRecord;

    expect(typedTask.sourceType).toBe('manual');
    expect(task.completed).toBe(true);
    expect(task.status).toBe('done');
    expect(task.tags).toEqual(['finanse', 'raport']);
    expect(task.group).toBe('Sprzedaz');
    expect(task.assignedTo).toEqual(['Ola']);
    expect(task.history[0].type).toBe('created');
    expect(task.comments).toHaveLength(1);
  });

  test('Regression: createManualTask preserves multiple assignees without personId shadow field', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));

    const task = createManualTask(
      'user_1',
      {
        title: '  plan wdrozenia ',
        owner: 'Nieprzypisane',
        assignedTo: ['Iwo', 'Anna', 'iwo', 'Nieprzypisane', 'Marta'],
        status: 'todo',
      },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    expect(task.owner).toBe('Iwo');
    expect(task.assignedTo).toEqual(['Iwo', 'Anna', 'Marta']);
    expect(task).not.toHaveProperty('personId');
    expect(task).not.toHaveProperty('assigneeIds');
  });

  test('createManualTask throws without title and sanitizes status', () => {
    const columns = [
      { id: 'todo', label: 'Todo', isDone: false },
      { id: 'done', label: 'Done', isDone: true },
    ];

    expect(() => createManualTask('user_1', { title: '   ' }, columns, 'ws_1')).toThrow(
      'Dodaj tytul zadania.'
    );

    const task = createManualTask('user_1', { title: 'OK', status: 'missing' }, columns, 'ws_1');
    expect(task.status).toBe('todo');
  });

  test('createTaskFromGoogle sets google fields and completion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T09:00:00.000Z'));

    const task = createTaskFromGoogle(
      'user_2',
      {
        id: 'google_1',
        title: 'podsumowanie',
        status: 'completed',
        updated: '2026-03-09T10:00:00.000Z',
        notes: 'Notatka',
      },
      { id: 'list_1', title: 'moj list' },
      DEFAULT_TASK_COLUMNS,
      { name: 'Anna' },
      'ws_1'
    );
    const typedTask = task satisfies TaskRecord;

    expect(typedTask.sourceType).toBe('google');
    expect(task.status).toBe('done');
    expect(task.completed).toBe(true);
    expect(task.group).toBe('Moj list');
    expect(task.googleSyncedAt).toBe('2026-03-10T09:00:00.000Z');
    expect(task.googleSyncStatus).toBe('synced');
    expect(task.googleSync).toEqual(
      expect.objectContaining({
        provider: 'google_tasks',
        taskId: 'google_1',
        taskListId: 'list_1',
        status: 'synced',
        syncedAt: '2026-03-10T09:00:00.000Z',
        pulledAt: '2026-03-10T09:00:00.000Z',
      })
    );
  });

  test('createRecurringTaskFromTask creates a new cycle task', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    const baseTask = {
      id: 'task_recurring_source',
      title: 'Przygotuj demo',
      owner: 'Ola',
      assignedTo: ['Ola'],
      description: 'Opis',
      dueDate: '2026-03-10T00:00:00.000Z',
      important: true,
      priority: 'high',
      tags: ['demo'],
      notes: 'Notatki',
      reminderAt: '',
      group: 'Sprint',
      recurrence: { frequency: 'weekly', interval: 1 },
      dependencies: ['t2'],
      subtasks: [
        { id: 's1', title: 'Sub', completed: true, completedAt: '2026-03-09T00:00:00.000Z' },
      ],
      links: [{ id: 'l1', url: 'https://example.com' }],
    };

    expect(
      createRecurringTaskFromTask(
        { ...baseTask, recurrence: null },
        'user_3',
        'ws_1',
        DEFAULT_TASK_COLUMNS
      )
    ).toBeNull();

    const recurring = createRecurringTaskFromTask(
      baseTask,
      'user_3',
      'ws_1',
      DEFAULT_TASK_COLUMNS,
      [{ id: 'existing', order: 0 }]
    );

    expect(recurring).not.toBeNull();
    expect(recurring.dueDate).toBe('2026-03-17T00:00:00.000Z');
    expect(recurring.recurrenceParentId).toBe(baseTask.id);
    expect(recurring.recurrenceGeneratedFromTaskId).toBe(baseTask.id);
    expect(recurring.recurrenceOccurrenceDate).toBe('2026-03-17T00:00:00.000Z');
    expect(recurring.history[0].type).toBe('recurrence');
    expect(recurring.subtasks[0].completed).toBe(false);
    expect(recurring.subtasks[0].completedAt).toBe('');
    expect(
      createRecurringTaskFromTask(baseTask, 'user_3', 'ws_1', DEFAULT_TASK_COLUMNS, [recurring])
    ).toBeNull();
  });

  test('upsertGoogleImportedTasks merges synced tasks and detects conflicts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T08:00:00.000Z'));

    const existingTasks = [
      {
        id: 'task_1',
        userId: 'user_1',
        sourceType: 'google',
        googleTaskId: 'g1',
        googleTaskListId: 'l1',
        title: 'Old',
        description: 'Old',
        dueDate: '2026-03-10T00:00:00.000Z',
        sourceMeetingDate: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-10T00:00:00.000Z',
        status: 'todo',
        completed: false,
        notes: 'Old',
        group: 'OldGroup',
        owner: 'Ola',
        assignedTo: ['Ola'],
        googleUpdatedAt: '2026-03-10T00:00:00.000Z',
        googleSyncedAt: '2026-03-10T00:00:00.000Z',
        googlePulledAt: '2026-03-10T00:00:00.000Z',
        googleSyncStatus: 'synced',
      },
    ];

    const importedTasks = [
      {
        googleTaskId: 'g1',
        googleTaskListId: 'l1',
        title: 'New',
        description: 'New',
        dueDate: '2026-03-12T00:00:00.000Z',
        sourceMeetingDate: '2026-03-12T00:00:00.000Z',
        updatedAt: '2026-03-12T00:00:00.000Z',
        status: 'done',
        completed: true,
        notes: 'New',
        group: 'Group',
        owner: '',
        assignedTo: [],
        googleUpdatedAt: '2026-03-12T00:00:00.000Z',
      },
    ];

    const mergedResult = upsertGoogleImportedTasks(existingTasks, importedTasks, 'user_1');
    expect(mergedResult.conflictCount).toBe(0);
    expect(mergedResult.merged[0].id).toBe('task_1');
    expect(mergedResult.merged[0].title).toBe('New');
    expect(mergedResult.merged[0].googleSyncStatus).toBe('synced');
    expect(mergedResult.merged[0].googleSyncedAt).toBe('2026-03-12T08:00:00.000Z');
    expect(mergedResult.merged[0].googleSync).toEqual(
      expect.objectContaining({
        provider: 'google_tasks',
        taskId: 'g1',
        taskListId: 'l1',
        status: 'synced',
        syncedAt: '2026-03-12T08:00:00.000Z',
        pulledAt: '2026-03-12T08:00:00.000Z',
      })
    );

    const conflictExisting = [
      {
        ...existingTasks[0],
        googleSyncedAt: '2026-03-10T00:00:00.000Z',
        updatedAt: '2026-03-11T00:00:00.000Z',
        googleSyncStatus: 'local_changes',
      },
    ];
    const conflictImported = [
      {
        ...importedTasks[0],
        title: 'Remote change',
        updatedAt: '2026-03-11T01:00:00.000Z',
        googleUpdatedAt: '2026-03-11T01:00:00.000Z',
      },
    ];

    const conflictResult = upsertGoogleImportedTasks(conflictExisting, conflictImported, 'user_1');
    expect(conflictResult.conflictCount).toBe(1);
    expect(conflictResult.merged[0].googleSyncStatus).toBe('conflict');
    expect(conflictResult.merged[0].googleSyncConflict).not.toBeNull();
    expect(conflictResult.merged[0].googleSync).toEqual(
      expect.objectContaining({
        provider: 'google_tasks',
        taskId: 'g1',
        taskListId: 'l1',
        status: 'conflict',
        conflict: conflictResult.merged[0].googleSyncConflict,
      })
    );
  });

  test('Google sync conflict lifecycle can read the nested sync state', () => {
    const lifecycle = getTaskLifecycleStatus(
      {
        id: 'nested-conflict',
        status: 'todo',
        completed: false,
        googleSync: {
          provider: 'google_tasks',
          status: 'conflict',
          conflict: { detectedAt: '2026-03-12T08:00:00.000Z' },
        },
      },
      DEFAULT_TASK_COLUMNS,
      []
    );

    expect(lifecycle).toBe(TASK_LIFECYCLE_STATUSES.CONFLICT);
  });

  test('extractMeetingTasks uses analysis tasks or action items', () => {
    const meeting = {
      id: 'm1',
      title: 'Daily',
      startsAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T11:00:00.000Z',
      createdAt: '2026-03-10T09:00:00.000Z',
      latestRecordingId: 'r1',
      attendees: ['Anna'],
      analysis: {
        tasks: [
          {
            title: 'Anna: przygotuj raport',
            tags: ['finanse'],
            group: 'sprzedaz',
            sourceQuote: 'Anna: przygotuj raport',
          },
        ],
      },
      tags: ['call'],
    };

    const tasks = extractMeetingTasks(meeting, DEFAULT_TASK_COLUMNS);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].owner).toBe('Anna');
    expect(tasks[0].assignedTo).toEqual(['Anna']);
    expect(tasks[0].title).toBe('Przygotuj raport');
    expect(tasks[0].group).toBe('Sprzedaz');
    expect(tasks[0].tags).toEqual(expect.arrayContaining(['call', 'finanse']));

    const fallback = extractMeetingTasks(
      {
        ...meeting,
        analysis: { tasks: [], actionItems: ['Zamknij temat'] },
      },
      DEFAULT_TASK_COLUMNS
    );
    expect(fallback).toHaveLength(1);
    expect(fallback[0].title).toBe('Zamknij temat');
  });

  test('extractMeetingTasks returns empty array when analysis is null or missing', () => {
    const baseMeeting = {
      id: 'm2',
      title: 'Daily',
      startsAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T11:00:00.000Z',
      createdAt: '2026-03-10T09:00:00.000Z',
      latestRecordingId: 'r1',
      attendees: ['Anna'],
      tags: ['call'],
    };

    // analysis: null
    const result1 = extractMeetingTasks({ ...baseMeeting, analysis: null }, DEFAULT_TASK_COLUMNS);
    expect(result1).toEqual([]);

    // analysis missing entirely
    const result2 = extractMeetingTasks(baseMeeting, DEFAULT_TASK_COLUMNS);
    expect(result2).toEqual([]);

    // analysis: {} (no tasks key)
    const result3 = extractMeetingTasks({ ...baseMeeting, analysis: {} }, DEFAULT_TASK_COLUMNS);
    expect(result3).toEqual([]);
  });

  test('buildTaskReorderUpdate with invalid neighbor IDs uses fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00.000Z'));

    const tasks = [
      { id: 't1', order: 0 },
      { id: 't2', order: 1024 },
    ];

    // previousTaskId that doesn't exist → should fallback
    const result = buildTaskReorderUpdate(tasks, { previousTaskId: 'nonexistent' });
    expect(result.order).toBeDefined();
    expect(typeof result.order).toBe('number');
  });

  test('buildTasksFromMeetings merges tasks and respects workspace filter', () => {
    const meeting = {
      id: 'm2',
      title: 'Sync',
      startsAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T11:00:00.000Z',
      createdAt: '2026-03-10T09:00:00.000Z',
      analysis: { tasks: [{ title: 'Anna: follow up' }] },
      attendees: ['Anna'],
    };

    const manualTasks = [
      createManualTask(
        'user_1',
        { title: 'Manual', owner: 'Anna', workspaceId: 'ws_1' },
        DEFAULT_TASK_COLUMNS,
        'ws_1'
      ),
      createManualTask(
        'user_1',
        { title: 'Manual 2', owner: 'Anna', workspaceId: 'ws_2' },
        DEFAULT_TASK_COLUMNS,
        'ws_2'
      ),
    ];

    const taskState = {
      'm2::task::0': { archived: true },
    };

    const result = buildTasksFromMeetings(
      [meeting],
      manualTasks,
      taskState,
      { id: 'user_1', name: 'Anna' },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe('ws_1');
    expect(result[0].assignedToMe).toBe(true);
  });

  test('Regression: #0 - buildTasksFromMeetings does not auto-add meeting analysis tasks', () => {
    const meeting = {
      id: 'm-auto',
      title: 'Decision review',
      startsAt: '2026-06-18T10:00:00.000Z',
      updatedAt: '2026-06-18T10:30:00.000Z',
      createdAt: '2026-06-18T09:50:00.000Z',
      analysis: {
        tasks: [{ title: 'Anna: prepare automatic follow-up' }],
        actionItems: ['Send automatic notes'],
      },
      attendees: ['Anna'],
    };

    const manualTask = createManualTask(
      'user_1',
      { title: 'Manual follow-up', owner: 'Anna', workspaceId: 'ws_1' },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    const result = buildTasksFromMeetings(
      [meeting],
      [manualTask],
      {},
      { id: 'user_1', name: 'Anna' },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Manual follow-up');
    expect(result.some((task) => task.sourceMeetingId === 'm-auto')).toBe(false);
  });

  test('Regression: #0 - buildTasksFromMeetings ignores null manual tasks from persisted state', () => {
    const result = buildTasksFromMeetings(
      [],
      [
        null,
        {
          id: 'manual_valid',
          title: 'Valid task',
          workspaceId: 'ws_1',
          status: 'todo',
          completed: false,
        },
        {
          id: 'manual_other',
          title: 'Other workspace task',
          workspaceId: 'ws_2',
          status: 'todo',
          completed: false,
        },
      ],
      {},
      { id: 'user_1' },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'manual_valid',
      title: 'Valid task',
      workspaceId: 'ws_1',
    });
  });

  test('Regression: #0 - buildTasksFromMeetings deduplicates persisted tasks by id before render', () => {
    const duplicatedTaskId = 'task_v2sb1yj4_mq485au1';
    const result = buildTasksFromMeetings(
      [],
      [
        {
          id: duplicatedTaskId,
          title: 'Original title',
          workspaceId: 'ws_1',
          status: 'todo',
          completed: false,
          tags: [],
        },
        {
          id: duplicatedTaskId,
          title: 'Updated title',
          workspaceId: 'ws_1',
          status: 'in_progress',
          completed: false,
          tags: ['follow-up'],
        },
      ],
      {},
      { id: 'user_1' },
      DEFAULT_TASK_COLUMNS,
      'ws_1'
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: duplicatedTaskId,
      title: 'Updated title',
      status: 'in_progress',
      tags: ['follow-up'],
    });
  });

  test('taskListStats aggregates counts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    const tasks = [
      {
        id: 't1',
        completed: true,
        dueDate: '2026-03-09T10:00:00.000Z',
        priority: 'low',
        status: 'done',
        sourceType: 'manual',
        assignedToMe: true,
        important: false,
        assignedTo: ['A'],
        owner: 'A',
        group: '',
        recurrence: null,
        comments: [],
        subtasks: [],
      },
      {
        id: 't2',
        completed: false,
        dueDate: '2026-03-09T10:00:00.000Z',
        priority: 'high',
        status: 'waiting',
        sourceType: 'manual',
        assignedToMe: false,
        important: true,
        assignedTo: [],
        owner: 'Nieprzypisane',
        group: '',
        recurrence: null,
        comments: [{ id: 'c1' }],
        subtasks: [{ completed: false }, { completed: true }],
      },
      {
        id: 't3',
        completed: false,
        dueDate: '2026-03-10T12:00:00.000Z',
        priority: 'medium',
        status: 'in_progress',
        sourceType: 'google',
        assignedToMe: true,
        important: false,
        assignedTo: ['Anna'],
        owner: 'Anna',
        group: 'Group',
        recurrence: { frequency: 'daily', interval: 1 },
        dependencies: ['t2'],
        comments: [],
        subtasks: [],
      },
      {
        id: 't4',
        completed: false,
        dueDate: '2026-03-13T12:00:00.000Z',
        priority: 'urgent',
        status: 'todo',
        sourceType: 'manual',
        assignedToMe: false,
        important: false,
        assignedTo: ['Bob'],
        owner: 'Bob',
        group: '',
        recurrence: null,
        comments: [],
        subtasks: [],
      },
      {
        id: 't5',
        completed: false,
        dueDate: '',
        priority: 'low',
        status: 'todo',
        sourceType: 'manual',
        assignedToMe: false,
        important: false,
        assignedTo: [],
        owner: 'Nieprzypisane',
        group: '',
        recurrence: null,
        comments: [],
        subtasks: [],
      },
    ];

    const stats = taskListStats(tasks);
    expect(stats.all).toBe(5);
    expect(stats.completed).toBe(1);
    expect(stats.open).toBe(4);
    expect(stats.overdue).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.dueThisWeek).toBe(2);
    expect(stats.scheduled).toBe(4);
    expect(stats.unassigned).toBe(2);
    expect(stats.waiting).toBe(1);
    expect(stats.inProgress).toBe(0);
    expect(stats.grouped).toBe(1);
    expect(stats.recurring).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.commented).toBe(1);
    expect(stats.subtasksOpen).toBe(1);
    expect(stats.subtasksCompleted).toBe(1);
    expect(stats.progress).toBe(20);
    expect(stats.byPriority.low).toBe(2);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.urgent).toBe(1);
    expect(stats.byPriority.medium).toBe(1);
    expect(stats.slaBreached).toBe(1);
  });

  test('buildTaskPeople/tags/groups and updateTaskColumns', () => {
    const people = buildTaskPeople(
      [
        {
          attendees: ['Anna'],
          speakerNames: { s1: 'Ola' },
          analysis: { speakerLabels: { s2: 'Marek' } },
          recordings: [{ speakerNames: { s3: 'Bartek' } }],
        },
      ],
      { name: 'Jan', email: 'jan@example.com', googleEmail: 'jan@google.com' },
      [{ name: 'Kasia', email: 'kasia@example.com', googleEmail: '' }],
      [{ owner: 'Ola', assignedTo: ['Anna'] }]
    );

    expect(people).toEqual(['Jan', 'Kasia']);
    expect(buildTaskTags([{ tags: ['a', 'b'] }], [{ tags: ['b', 'c'] }])).toEqual(['a', 'b', 'c']);
    expect(buildTaskGroups([{ group: 'Group' }, { group: 'Group 2' }, { group: 'Group' }])).toEqual(
      ['Group', 'Group 2']
    );

    const updated = updateTaskColumns({}, 'ws_1', [
      { id: 'col_1', label: 'Nowe', isDone: false },
      { id: 'col_2', label: 'Koniec', isDone: false },
    ]);
    expect(updated['ws_1'].columns.slice(-1)[0].isDone).toBe(true);
  });

  test('buildTaskPeople only exposes real workspace assignees', () => {
    const people = buildTaskPeople(
      [
        {
          attendees: ['Barbara Zynda', 'RYTM', 'biuro.rytm@example.com'],
          speakerNames: { s1: 'Speaker 1' },
          analysis: { speakerLabels: { s2: 'Speaker 2' } },
        },
      ],
      { name: 'Iwo Zynda', email: 'iwo@example.com', googleEmail: 'iwo@gmail.com' },
      [{ name: 'Barbara Zynda', email: 'barbara@example.com' }],
      [
        {
          owner: 'wizjeprojektowe@example.com',
          assignedTo: ['RYTM', 'biuro.rytm@example.com'],
        },
      ]
    );

    expect(people).toEqual(['Iwo Zynda', 'Barbara Zynda']);
    expect(people).not.toEqual(
      expect.arrayContaining(['RYTM', 'biuro.rytm@example.com', 'wizjeprojektowe@example.com'])
    );
  });

  test('buildTaskChangeHistory records comment and recurrence changes', () => {
    const previousTask = {
      title: 'A',
      tags: ['a'],
      dependencies: ['t1'],
      comments: [],
      subtasks: [],
      recurrence: null,
      order: 1,
    };
    const nextTask = {
      title: 'A',
      tags: ['b'],
      dependencies: [],
      comments: [{ id: 'c1' }],
      subtasks: [{ id: 's1' }],
      recurrence: { frequency: 'daily', interval: 1 },
      order: 2,
    };

    const entries = buildTaskChangeHistory(
      previousTask,
      nextTask,
      'User',
      buildTaskColumns({}, 'ws_1')
    );
    const entryTypes = entries.map((entry) => entry.type);

    expect(entryTypes).toEqual(
      expect.arrayContaining(['tags', 'dependencies', 'comment', 'subtasks', 'recurrence', 'order'])
    );
  });
});
