import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import useWorkspaceBackup from './useWorkspaceBackup';

const {
  mockWorkspaceSelectors,
  mockMeetingsStore,
  mockBuildWorkspaceBackup,
  mockStringifyWorkspaceBackup,
  mockParseWorkspaceBackup,
  mockPreviewWorkspaceBackupImport,
  mockMergeWorkspaceBackup,
  mockDownloadTextFile,
  mockSlugifyExportTitle,
} = vi.hoisted(() => ({
  mockWorkspaceSelectors: {
    currentWorkspaceId: 'ws-1',
    currentWorkspace: { name: 'My Workspace' },
  },
  mockMeetingsStore: {
    meetings: [{ id: 'm1' }],
    manualTasks: [],
    taskState: {},
    taskBoards: {},
    calendarMeta: {},
    vocabulary: [],
    setMeetings: vi.fn(),
    setManualTasks: vi.fn(),
    setTaskState: vi.fn(),
    setTaskBoards: vi.fn(),
    setCalendarMeta: vi.fn(),
    setVocabulary: vi.fn(),
    setWorkspaceMessage: vi.fn(),
  },
  mockBuildWorkspaceBackup: vi.fn(),
  mockStringifyWorkspaceBackup: vi.fn(),
  mockParseWorkspaceBackup: vi.fn(),
  mockPreviewWorkspaceBackupImport: vi.fn(),
  mockMergeWorkspaceBackup: vi.fn(),
  mockDownloadTextFile: vi.fn(),
  mockSlugifyExportTitle: vi.fn(),
}));

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceSelectors: () => mockWorkspaceSelectors,
}));

vi.mock('../store/meetingsStore', () => ({
  useMeetingsStore: () => mockMeetingsStore,
}));

vi.mock('../lib/storage', () => ({
  downloadTextFile: (...args: any[]) => mockDownloadTextFile(...args),
}));

vi.mock('../lib/export', () => ({
  slugifyExportTitle: (...args: any[]) => mockSlugifyExportTitle(...args),
}));

vi.mock('../lib/workspaceBackup', () => ({
  buildWorkspaceBackup: (...args: any[]) => mockBuildWorkspaceBackup(...args),
  stringifyWorkspaceBackup: (...args: any[]) => mockStringifyWorkspaceBackup(...args),
  parseWorkspaceBackup: (...args: any[]) => mockParseWorkspaceBackup(...args),
  previewWorkspaceBackupImport: (...args: any[]) => mockPreviewWorkspaceBackupImport(...args),
  mergeWorkspaceBackup: (...args: any[]) => mockMergeWorkspaceBackup(...args),
}));

describe('useWorkspaceBackup', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    mockWorkspaceSelectors.currentWorkspaceId = 'ws-1';
    mockWorkspaceSelectors.currentWorkspace = { name: 'My Workspace' } as any;

    mockMeetingsStore.meetings = [{ id: 'm1' }] as any[];
    mockMeetingsStore.manualTasks = [];
    mockMeetingsStore.taskState = {};
    mockMeetingsStore.taskBoards = {};
    mockMeetingsStore.calendarMeta = {};
    mockMeetingsStore.vocabulary = [];

    mockSlugifyExportTitle.mockReturnValue('my-workspace');
    mockBuildWorkspaceBackup.mockReturnValue({ version: 1, state: {} });
    mockStringifyWorkspaceBackup.mockReturnValue('{"version":1}');
    mockParseWorkspaceBackup.mockReturnValue({
      version: 1,
      workspaceId: 'ws-1',
      workspaceName: 'My Workspace',
      state: { meetings: [], manualTasks: [] },
    });
    mockPreviewWorkspaceBackupImport.mockReturnValue({
      meetingsToAdd: 2,
      manualTasksToAdd: 1,
      meetingsTotal: 3,
      manualTasksTotal: 1,
    });
    mockMergeWorkspaceBackup.mockReturnValue({
      meetings: [{ id: 'm1' }, { id: 'm2' }],
      manualTasks: [{ id: 't1' }],
      taskState: { done: true },
      taskBoards: { board1: {} },
      calendarMeta: { key: 'val' },
      vocabulary: ['word1'],
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useWorkspaceBackup());
    expect(result.current.preview).toBeNull();
    expect(result.current.statusMessage).toBe('');
    expect(result.current.isImporting).toBe(false);
    expect(result.current.hasPendingImport).toBe(false);
  });

  it('exportWorkspace builds backup and downloads file', async () => {
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      result.current.exportWorkspace();
    });

    expect(mockBuildWorkspaceBackup).toHaveBeenCalledWith(
      'ws-1',
      'My Workspace',
      expect.objectContaining({ meetings: [{ id: 'm1' }] })
    );
    expect(mockSlugifyExportTitle).toHaveBeenCalledWith('My Workspace');
    expect(mockStringifyWorkspaceBackup).toHaveBeenCalledWith({ version: 1, state: {} });
    expect(mockDownloadTextFile).toHaveBeenCalledWith(
      'my-workspace-backup.json',
      '{"version":1}',
      'application/json;charset=utf-8'
    );
  });

  it('importWorkspaceFile parses file and sets preview', async () => {
    const file = new File(['{"version":1}'], 'backup.json', { type: 'application/json' });
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importWorkspaceFile(file);
    });

    expect(mockParseWorkspaceBackup).toHaveBeenCalledWith('{"version":1}');
    expect(mockPreviewWorkspaceBackupImport).toHaveBeenCalled();
    expect(result.current.preview).toEqual(
      expect.objectContaining({ meetingsToAdd: 2, manualTasksToAdd: 1 })
    );
    expect(result.current.statusMessage).toBe('Backup gotowy do importu.');
    expect(result.current.hasPendingImport).toBe(true);
  });

  it('importWorkspaceFile shows warning for different workspace', async () => {
    mockParseWorkspaceBackup.mockReturnValue({
      version: 1,
      workspaceId: 'ws-different',
      workspaceName: 'Other',
      state: { meetings: [] },
    });
    const file = new File(['{}'], 'backup.json');
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importWorkspaceFile(file);
    });

    expect(result.current.statusMessage).toBe(
      'Backup pochodzi z innego workspace. Zostanie scalony z bieżącym stanem.'
    );
  });

  it('importWorkspaceFile does nothing for null file', async () => {
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importWorkspaceFile(null);
    });

    expect(mockParseWorkspaceBackup).not.toHaveBeenCalled();
    expect(result.current.preview).toBeNull();
  });

  it('applyWorkspaceImport merges and sets all store fields', async () => {
    const file = new File(['{"version":1}'], 'backup.json');
    const { result } = renderHook(() => useWorkspaceBackup());

    // First import to set pendingBackupRef
    await act(async () => {
      await result.current.importWorkspaceFile(file);
    });

    // Then apply
    await act(async () => {
      await result.current.applyWorkspaceImport();
    });

    expect(mockMergeWorkspaceBackup).toHaveBeenCalled();
    expect(mockMeetingsStore.setMeetings).toHaveBeenCalledWith([{ id: 'm1' }, { id: 'm2' }]);
    expect(mockMeetingsStore.setManualTasks).toHaveBeenCalledWith([{ id: 't1' }]);
    expect(mockMeetingsStore.setTaskState).toHaveBeenCalledWith({ done: true });
    expect(mockMeetingsStore.setTaskBoards).toHaveBeenCalledWith({ board1: {} });
    expect(mockMeetingsStore.setCalendarMeta).toHaveBeenCalledWith({ key: 'val' });
    expect(mockMeetingsStore.setVocabulary).toHaveBeenCalledWith(['word1']);
    expect(mockMeetingsStore.setWorkspaceMessage).toHaveBeenCalledWith(
      'Backup workspace zaimportowany.'
    );
    expect(result.current.hasPendingImport).toBe(false);
  });

  it('applyWorkspaceImport shows error if no pending backup', async () => {
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.applyWorkspaceImport();
    });

    expect(mockMergeWorkspaceBackup).not.toHaveBeenCalled();
    expect(result.current.statusMessage).toBe('Najpierw wczytaj plik backupu.');
  });

  it('clearImportState resets preview and status', async () => {
    const file = new File(['{"version":1}'], 'backup.json');
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importWorkspaceFile(file);
    });
    expect(result.current.preview).not.toBeNull();

    await act(async () => {
      result.current.clearImportState();
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.statusMessage).toBe('');
    expect(result.current.hasPendingImport).toBe(false);
  });

  it('isImporting is true during applyWorkspaceImport', async () => {
    let capturedIsImporting = false;
    mockMergeWorkspaceBackup.mockImplementation(() => {
      capturedIsImporting = true;
      return {
        meetings: [],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      };
    });

    const file = new File(['{"version":1}'], 'backup.json');
    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      await result.current.importWorkspaceFile(file);
    });
    await act(async () => {
      await result.current.applyWorkspaceImport();
    });

    expect(capturedIsImporting).toBe(true);
    expect(result.current.isImporting).toBe(false);
  });

  it('exportWorkspace uses fallback when workspace name is empty', async () => {
    mockWorkspaceSelectors.currentWorkspace = null as any;
    mockWorkspaceSelectors.currentWorkspaceId = '';

    const { result } = renderHook(() => useWorkspaceBackup());

    await act(async () => {
      result.current.exportWorkspace();
    });

    expect(mockBuildWorkspaceBackup).toHaveBeenCalledWith('', 'Workspace', expect.any(Object));
    expect(mockSlugifyExportTitle).toHaveBeenCalledWith('workspace');
  });
});
