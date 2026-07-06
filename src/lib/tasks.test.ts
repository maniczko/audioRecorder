import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TASK_COLUMNS, buildTaskDiagnosticsReport } from './tasks';

describe('task diagnostics report', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a healthy current workspace task set', () => {
    vi.setSystemTime(new Date('2026-07-06T12:00:00.000Z'));

    const report = buildTaskDiagnosticsReport(
      [
        {
          id: 'task-1',
          title: 'Prepare brief',
          workspaceId: 'ws-1',
          sourceType: 'manual',
          status: 'todo',
          dependencies: [],
          recurrence: null,
        },
        {
          id: 'task-2',
          title: 'Send summary',
          workspaceId: 'ws-1',
          sourceType: 'google',
          status: 'done',
          dependencies: ['task-1'],
          recurrenceGeneratedFromTaskId: 'task-1',
        },
      ],
      { workspaceId: 'ws-1', columns: DEFAULT_TASK_COLUMNS }
    );

    expect(report.healthy).toBe(true);
    expect(report.counts).toMatchObject({
      totalTasks: 2,
      manualTasks: 1,
      archivedTasks: 0,
      deletePendingTasks: 0,
      conflicts: 0,
      missingWorkspaceId: 0,
      missingTitle: 0,
      invalidStatus: 0,
      brokenDependencies: 0,
      recurringTasks: 1,
      duplicateIds: 0,
      excludedOtherWorkspace: 0,
    });
    expect(report.generatedAt).toBe('2026-07-06T12:00:00.000Z');
  });

  it('identifies invalid task data without exposing other workspace tasks', () => {
    const report = buildTaskDiagnosticsReport(
      [
        {
          id: 'dup',
          title: '',
          workspaceId: 'ws-1',
          sourceType: 'manual',
          status: 'stuck',
          dependencies: ['missing-task'],
          archived: true,
          googleSyncStatus: 'conflict',
        },
        {
          id: 'dup',
          title: 'Duplicate',
          workspaceId: 'ws-1',
          sourceType: 'manual',
          status: 'todo',
          dependencies: [],
          deletePending: true,
        },
        {
          id: 'missing-workspace',
          title: 'Legacy task',
          sourceType: 'manual',
          status: 'todo',
          dependencies: [],
        },
        {
          id: 'other-workspace-secret-id',
          title: 'Other workspace title',
          workspaceId: 'ws-2',
          sourceType: 'manual',
          status: 'not-a-column',
          dependencies: ['also-secret'],
        },
      ],
      { workspaceId: 'ws-1', columns: DEFAULT_TASK_COLUMNS }
    );

    expect(report.healthy).toBe(false);
    expect(report.counts).toMatchObject({
      totalTasks: 3,
      manualTasks: 3,
      archivedTasks: 1,
      deletePendingTasks: 1,
      conflicts: 1,
      missingWorkspaceId: 1,
      missingTitle: 1,
      invalidStatus: 1,
      brokenDependencies: 1,
      duplicateIds: 1,
      excludedOtherWorkspace: 1,
    });
    expect(report.issues.duplicateIds).toEqual([{ id: 'dup', count: 2 }]);
    expect(report.issues.invalidStatus).toEqual([{ id: 'dup', status: 'stuck' }]);
    expect(report.issues.brokenDependencies).toEqual([{ id: 'dup', dependencyId: 'missing-task' }]);
    expect(JSON.stringify(report)).not.toContain('other-workspace-secret-id');
    expect(JSON.stringify(report)).not.toContain('Other workspace title');
  });
});
