import type { WorkspaceStatePayload } from '../shared/contracts';

interface PersistDeletedMeetingRemoteStateOptions {
  stateService: {
    mode?: string;
    syncWorkspaceState?: (workspaceId: string, payload: WorkspaceStatePayload) => Promise<unknown>;
  };
  currentWorkspaceId: string;
  payload: WorkspaceStatePayload;
  setWorkspaceMessage: (message: string) => void;
}

interface BuildDeletedMeetingRemotePayloadOptions {
  meetingId: string;
  recordingIds?: string[];
  meetings: unknown[];
  manualTasks: unknown[];
  taskState: Record<string, unknown>;
  taskBoards: Record<string, unknown>;
  calendarMeta: Record<string, unknown>;
  vocabulary: string[];
  now?: string;
}

function mergeTombstoneList(
  existing: unknown,
  ids: string[] = [],
  source: string,
  deletedAt: string
) {
  const byId = new Map<string, Record<string, unknown>>();
  const add = (value: unknown) => {
    const id = String(
      value && typeof value === 'object'
        ? (value as any).id || (value as any).recordingId || (value as any).meetingId || ''
        : value || ''
    ).trim();
    if (!id || byId.has(id)) return;
    byId.set(
      id,
      value && typeof value === 'object'
        ? { ...(value as Record<string, unknown>), id }
        : { id, deletedAt, source }
    );
  };

  if (Array.isArray(existing)) {
    existing.forEach(add);
  }
  ids.forEach(add);

  return [...byId.values()].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

export function buildDeletedMeetingRemotePayload({
  meetingId,
  recordingIds = [],
  meetings,
  manualTasks,
  taskState,
  taskBoards,
  calendarMeta,
  vocabulary,
  now = new Date().toISOString(),
}: BuildDeletedMeetingRemotePayloadOptions): WorkspaceStatePayload {
  const normalizedMeetingId = String(meetingId || '').trim();
  const uniqueRecordingIds = [...new Set(recordingIds.map((id) => String(id || '').trim()))].filter(
    Boolean
  );
  const meta = calendarMeta && typeof calendarMeta === 'object' ? calendarMeta : {};

  return {
    meetings: (Array.isArray(meetings) ? meetings : []).filter(
      (meeting: any) => String(meeting?.id || '').trim() !== normalizedMeetingId
    ),
    manualTasks: Array.isArray(manualTasks) ? manualTasks : [],
    taskState: taskState && typeof taskState === 'object' ? taskState : {},
    taskBoards: taskBoards && typeof taskBoards === 'object' ? taskBoards : {},
    calendarMeta: {
      ...meta,
      meetingTombstones: mergeTombstoneList(
        (meta as any).meetingTombstones,
        normalizedMeetingId ? [normalizedMeetingId] : [],
        'meeting-delete',
        now
      ),
      recordingTombstones: mergeTombstoneList(
        (meta as any).recordingTombstones,
        uniqueRecordingIds,
        'meeting-delete',
        now
      ),
    },
    vocabulary: Array.isArray(vocabulary) ? vocabulary : [],
  };
}

export async function persistDeletedMeetingRemoteState({
  stateService,
  currentWorkspaceId,
  payload,
  setWorkspaceMessage,
}: PersistDeletedMeetingRemoteStateOptions) {
  if (stateService?.mode !== 'remote' || !currentWorkspaceId) {
    return;
  }

  try {
    await stateService.syncWorkspaceState?.(currentWorkspaceId, payload);
  } catch (error: any) {
    console.warn('Immediate workspace sync after delete failed:', error);
    const message = error?.message || 'Nie udalo sie zapisac usuniecia spotkania na backendzie.';
    setWorkspaceMessage(message);
    throw error;
  }
}
