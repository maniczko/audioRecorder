import { describe, expect, test } from 'vitest';
import {
  buildWorkspaceBackup,
  mergeWorkspaceBackup,
  parseWorkspaceBackup,
  previewWorkspaceBackupImport,
  stringifyWorkspaceBackup,
} from './workspaceBackup';

describe('workspaceBackup', () => {
  test('builds and parses a round-trip backup payload', () => {
    const backup = buildWorkspaceBackup('ws1', 'Team Space', {
      meetings: [{ id: 'm1', title: 'Demo' }],
      manualTasks: [{ id: 't1', title: 'Task' }],
      taskState: { t1: 'done' },
      taskBoards: { board: [] },
      calendarMeta: { 'meeting:m1': { googleEventId: 'g1' } },
      vocabulary: ['AI'],
    });

    const parsed = parseWorkspaceBackup(stringifyWorkspaceBackup(backup));

    expect(parsed.version).toBe(1);
    expect(parsed.workspaceId).toBe('ws1');
    expect(parsed.workspaceName).toBe('Team Space');
    expect(parsed.state.meetings).toEqual([{ id: 'm1', title: 'Demo' }]);
    expect(parsed.state.vocabulary).toEqual(['AI']);
  });

  test('previews only new items and changed state keys', () => {
    const preview = previewWorkspaceBackupImport(
      {
        meetings: [{ id: 'm1', title: 'Old' }],
        manualTasks: [{ id: 't1', title: 'Old task' }],
        taskState: { t1: 'todo' },
        taskBoards: { board: [] },
        calendarMeta: {},
        vocabulary: ['AI'],
      },
      {
        meetings: [
          { id: 'm1', title: 'New' },
          { id: 'm2', title: 'Added' },
        ],
        manualTasks: [
          { id: 't1', title: 'Changed' },
          { id: 't2', title: 'Added' },
        ],
        taskState: { t1: 'done', t2: 'todo' },
        taskBoards: { board: [1] },
        calendarMeta: { meta: { ok: true } },
        vocabulary: ['AI', 'Kubernetes'],
      }
    );

    expect(preview.meetingsToAdd).toBe(1);
    expect(preview.manualTasksToAdd).toBe(1);
    expect(preview.vocabularyToAdd).toBe(1);
    expect(preview.taskStateKeysToUpdate).toBeGreaterThan(0);
    expect(preview.taskBoardsToUpdate).toBeGreaterThan(0);
    expect(preview.calendarMetaToUpdate).toBeGreaterThan(0);
  });

  test('merges imported state into the current workspace state', () => {
    const merged = mergeWorkspaceBackup(
      {
        meetings: [{ id: 'm1', title: 'Old', tags: ['a'] }],
        manualTasks: [{ id: 't1', title: 'Task old' }],
        taskState: { t1: 'todo' },
        taskBoards: { board: ['x'] },
        calendarMeta: { 'meeting:m1': { googleEventId: 'g1' } },
        vocabulary: ['AI'],
      },
      {
        meetings: [
          { id: 'm1', title: 'New' },
          { id: 'm2', title: 'Added' },
        ],
        manualTasks: [
          { id: 't1', title: 'Task new' },
          { id: 't2', title: 'Task added' },
        ],
        taskState: { t1: 'done', t2: 'todo' },
        taskBoards: { board: ['y'], extra: [] },
        calendarMeta: { 'meeting:m1': { googleEventId: 'g2' } },
        vocabulary: ['AI', 'Product'],
      }
    );

    expect(merged.meetings).toEqual([
      { id: 'm1', title: 'New', tags: ['a'] },
      { id: 'm2', title: 'Added' },
    ]);
    expect(merged.manualTasks).toEqual([
      { id: 't1', title: 'Task new' },
      { id: 't2', title: 'Task added' },
    ]);
    expect(merged.taskState).toEqual({ t1: 'done', t2: 'todo' });
    expect(merged.taskBoards).toEqual({ board: ['y'], extra: [] });
    expect(merged.calendarMeta).toEqual({ 'meeting:m1': { googleEventId: 'g2' } });
    expect(merged.vocabulary).toEqual(['AI', 'Product']);
  });
});
