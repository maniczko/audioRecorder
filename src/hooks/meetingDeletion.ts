import type { WorkspaceStatePayload } from '../shared/contracts';
import type { TaskRecord, TaskStateOverlay, TaskStatePatch } from '../shared/types';

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

function collectRecordingIdsFromMeeting(meeting: unknown) {
  if (!meeting || typeof meeting !== 'object') return [];
  const source = meeting as Record<string, any>;
  const ids = new Set<string>();
  const latestRecordingId = String(source.latestRecordingId || '').trim();
  if (latestRecordingId) ids.add(latestRecordingId);

  const recordings = Array.isArray(source.recordings) ? source.recordings : [];
  recordings.forEach((recording) => {
    const id = String(
      recording && typeof recording === 'object'
        ? (recording as any).id || (recording as any).recordingId || ''
        : ''
    ).trim();
    if (id) ids.add(id);
  });

  return [...ids];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeTaskRecords(value: unknown): TaskRecord[] {
  return Array.isArray(value)
    ? value.filter(isRecord).map((item) => item as unknown as TaskRecord)
    : [];
}

function normalizeTaskStatePatch(value: unknown): TaskStatePatch | null {
  if (isRecord(value)) {
    return value as TaskStatePatch;
  }
  if (typeof value === 'string' && value.trim()) {
    return { status: value.trim() };
  }
  return null;
}

function normalizeTaskState(value: unknown): TaskStateOverlay {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, patch]) => [key, normalizeTaskStatePatch(patch)] as const)
      .filter((entry): entry is [string, TaskStatePatch] => Boolean(entry[1]))
  );
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
  const safeMeetings = Array.isArray(meetings) ? meetings : [];
  const deletedMeeting = safeMeetings.find(
    (meeting: any) => String(meeting?.id || '').trim() === normalizedMeetingId
  );
  const uniqueRecordingIds = [
    ...new Set(
      [...recordingIds, ...collectRecordingIdsFromMeeting(deletedMeeting)].map((id) =>
        String(id || '').trim()
      )
    ),
  ].filter(Boolean);
  const meta = calendarMeta && typeof calendarMeta === 'object' ? calendarMeta : {};

  return {
    meetings: safeMeetings.filter(
      (meeting: any) => String(meeting?.id || '').trim() !== normalizedMeetingId
    ),
    manualTasks: normalizeTaskRecords(manualTasks),
    taskState: normalizeTaskState(taskState),
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
