import type { WorkspaceStatePayload } from '../shared/contracts';
import { normalizeWorkspaceState } from '../shared/contracts';

export interface WorkspaceBackupPayload {
  version: 1;
  exportedAt: string;
  workspaceId: string;
  workspaceName: string;
  state: WorkspaceStatePayload;
}

export interface WorkspaceBackupPreview {
  meetingsToAdd: number;
  manualTasksToAdd: number;
  vocabularyToAdd: number;
  taskStateKeysToUpdate: number;
  taskBoardsToUpdate: number;
  calendarMetaToUpdate: number;
  meetingsTotal: number;
  manualTasksTotal: number;
}

function nowIso() {
  return new Date().toISOString();
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function mergeCollectionById(current: unknown[] = [], incoming: unknown[] = []) {
  const merged = [...current];
  const indexById = new Map<string, number>();

  merged.forEach((item: any, index) => {
    const id = clean(item?.id);
    if (id) {
      indexById.set(id, index);
    }
  });

  incoming.forEach((item: any) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const id = clean(item.id);
    if (!id) {
      merged.push(item);
      return;
    }

    const index = indexById.get(id);
    if (index === undefined) {
      indexById.set(id, merged.length);
      merged.push(item);
      return;
    }

    merged[index] = { ...(merged[index] as object), ...(item as object) };
  });

  return merged;
}

function diffCountById(current: unknown[] = [], incoming: unknown[] = []) {
  const currentIds = new Set(current.map((item: any) => clean(item?.id)).filter(Boolean));
  return incoming.reduce(
    (count: number, item: any) => count + (currentIds.has(clean(item?.id)) ? 0 : 1),
    0
  );
}

function diffObjectCount(
  current: Record<string, unknown> = {},
  incoming: Record<string, unknown> = {}
) {
  let count = 0;
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(incoming || {})]);
  keys.forEach((key) => {
    if (!(key in incoming)) {
      count += 1;
      return;
    }
    if (stableJson(current[key]) !== stableJson(incoming[key])) {
      count += 1;
    }
  });
  return count;
}

export function buildWorkspaceBackup(
  workspaceId: string,
  workspaceName: string,
  state: Partial<WorkspaceStatePayload> = {}
): WorkspaceBackupPayload {
  return {
    version: 1,
    exportedAt: nowIso(),
    workspaceId: clean(workspaceId),
    workspaceName: clean(workspaceName) || 'Workspace',
    state: normalizeWorkspaceState(state),
  };
}

export function stringifyWorkspaceBackup(payload: WorkspaceBackupPayload) {
  return JSON.stringify(payload, null, 2);
}

export function parseWorkspaceBackup(raw: string) {
  if (!raw) {
    throw new Error('Plik backupu jest pusty.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Plik backupu nie jest poprawnym JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Nieprawidlowy format backupu.');
  }

  if (Number(parsed.version) !== 1) {
    throw new Error('Nieobslugiwany format backupu.');
  }

  const state = normalizeWorkspaceState(parsed.state || {});

  return {
    version: 1 as const,
    exportedAt: clean(parsed.exportedAt),
    workspaceId: clean(parsed.workspaceId),
    workspaceName: clean(parsed.workspaceName) || 'Workspace',
    state,
  };
}

export function previewWorkspaceBackupImport(
  currentState: Partial<WorkspaceStatePayload>,
  backupState: Partial<WorkspaceStatePayload>
): WorkspaceBackupPreview {
  const current = normalizeWorkspaceState(currentState);
  const incoming = normalizeWorkspaceState(backupState);

  return {
    meetingsToAdd: diffCountById(current.meetings, incoming.meetings),
    manualTasksToAdd: diffCountById(current.manualTasks, incoming.manualTasks),
    vocabularyToAdd: Array.isArray(incoming.vocabulary)
      ? incoming.vocabulary.filter((item) => !current.vocabulary.includes(item)).length
      : 0,
    taskStateKeysToUpdate: diffObjectCount(
      current.taskState as Record<string, unknown>,
      incoming.taskState as Record<string, unknown>
    ),
    taskBoardsToUpdate: diffObjectCount(
      current.taskBoards as Record<string, unknown>,
      incoming.taskBoards as Record<string, unknown>
    ),
    calendarMetaToUpdate: diffObjectCount(
      current.calendarMeta as Record<string, unknown>,
      incoming.calendarMeta as Record<string, unknown>
    ),
    meetingsTotal: incoming.meetings.length,
    manualTasksTotal: incoming.manualTasks.length,
  };
}

export function mergeWorkspaceBackup(
  currentState: Partial<WorkspaceStatePayload>,
  backupState: Partial<WorkspaceStatePayload>
) {
  const current = normalizeWorkspaceState(currentState);
  const incoming = normalizeWorkspaceState(backupState);

  return normalizeWorkspaceState({
    meetings: mergeCollectionById(current.meetings, incoming.meetings),
    manualTasks: mergeCollectionById(current.manualTasks, incoming.manualTasks),
    taskState: {
      ...(current.taskState as Record<string, unknown>),
      ...(incoming.taskState as Record<string, unknown>),
    },
    taskBoards: {
      ...(current.taskBoards as Record<string, unknown>),
      ...(incoming.taskBoards as Record<string, unknown>),
    },
    calendarMeta: {
      ...(current.calendarMeta as Record<string, unknown>),
      ...(incoming.calendarMeta as Record<string, unknown>),
    },
    vocabulary: Array.from(
      new Set([...(current.vocabulary || []), ...(incoming.vocabulary || [])])
    ),
    updatedAt: current.updatedAt,
  });
}
