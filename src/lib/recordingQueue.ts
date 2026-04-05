import type { TranscriptSegment } from '../shared/types';

export type RecordingPipelineStatus =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'diarization'
  | 'review'
  | 'failed'
  | 'failed_permanent'
  | 'done';

export interface RecordingQueueMeetingLike {
  id?: string;
  workspaceId?: string;
  title?: string;
}

export interface RecordingQueueItem {
  id: string;
  recordingId: string;
  meetingId: string;
  workspaceId: string;
  meetingTitle: string;
  meetingSnapshot: RecordingQueueMeetingLike | null;
  mimeType: string;
  rawSegments: TranscriptSegment[];
  duration: number;
  status: RecordingPipelineStatus;
  uploaded: boolean;
  attempts: number;
  retryCount: number;
  backoffUntil: number;
  lastErrorMessage: string;
  errorMessage: string;
  createdAt: string;
  updatedAt: string;
  pipelineGitSha?: string;
  pipelineVersion?: string;
  pipelineBuildTime?: string;
  audioQuality?: unknown;
  transcriptionDiagnostics?: unknown;
}

interface CreateRecordingQueueItemInput {
  recordingId: string;
  meeting?: RecordingQueueMeetingLike;
  meetingId?: string;
  mimeType?: string;
  rawSegments?: TranscriptSegment[];
  duration?: number;
  createdAt?: string;
}

export function normalizeRecordingPipelineStatus(value) {
  if (value === 'completed') {
    return 'done';
  }
  if (
    [
      'uploading',
      'queued',
      'processing',
      'diarization',
      'review',
      'failed',
      'failed_permanent',
      'done',
    ].includes(String(value || ''))
  ) {
    return value as RecordingPipelineStatus;
  }
  return 'queued';
}

export function createRecordingQueueItem({
  recordingId,
  meeting,
  meetingId,
  mimeType,
  rawSegments = [],
  duration = 0,
  createdAt = new Date().toISOString(),
}: CreateRecordingQueueItemInput): RecordingQueueItem {
  return {
    id: recordingId,
    recordingId,
    meetingId: meetingId || meeting?.id || '',
    workspaceId: meeting?.workspaceId || '',
    meetingTitle: meeting?.title || 'Spotkanie',
    meetingSnapshot: meeting || null,
    mimeType: mimeType || 'audio/webm',
    rawSegments: Array.isArray(rawSegments) ? rawSegments : [],
    duration: Number(duration) || 0,
    status: 'queued',
    uploaded: false,
    attempts: 0,
    retryCount: 0,
    backoffUntil: 0,
    lastErrorMessage: '',
    errorMessage: '',
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeRecordingQueue(queue: unknown[] = []): RecordingQueueItem[] {
  return (Array.isArray(queue) ? queue : [])
    .map((item): RecordingQueueItem | null => {
      const current = item as Partial<RecordingQueueItem> | null | undefined;
      if (!current?.recordingId) {
        return null;
      }

      return {
        id: current.id || current.recordingId,
        recordingId: current.recordingId,
        meetingId: current.meetingId || '',
        workspaceId: current.workspaceId || '',
        meetingTitle: current.meetingTitle || 'Spotkanie',
        meetingSnapshot: current.meetingSnapshot || null,
        mimeType: current.mimeType || 'audio/webm',
        status: normalizeRecordingPipelineStatus(current.status) as RecordingPipelineStatus,
        uploaded: Boolean(current.uploaded),
        attempts: Math.max(0, Number(current.attempts) || 0),
        retryCount: Math.max(0, Number(current.retryCount) || 0),
        backoffUntil: Math.max(0, Number(current.backoffUntil) || 0),
        lastErrorMessage: String(current.lastErrorMessage || ''),
        errorMessage: String(current.errorMessage || ''),
        rawSegments: Array.isArray(current.rawSegments) ? current.rawSegments : [],
        duration: Math.max(0, Number(current.duration) || 0),
        createdAt: current.createdAt || new Date().toISOString(),
        updatedAt: current.updatedAt || current.createdAt || new Date().toISOString(),
        pipelineGitSha: current.pipelineGitSha || '',
        pipelineVersion: current.pipelineVersion || '',
        pipelineBuildTime: current.pipelineBuildTime || '',
        audioQuality: current.audioQuality || null,
        transcriptionDiagnostics: current.transcriptionDiagnostics || null,
      };
    })
    .filter((item): item is RecordingQueueItem => Boolean(item))
    .sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
}

export function upsertRecordingQueueItem(
  queue: unknown[],
  nextItem: Partial<RecordingQueueItem> | null
): RecordingQueueItem[] {
  const normalizedQueue = normalizeRecordingQueue(queue);
  const next = nextItem ? { ...nextItem, updatedAt: new Date().toISOString() } : null;
  if (!next?.recordingId) {
    return normalizedQueue;
  }

  const index = normalizedQueue.findIndex((item) => item.recordingId === next.recordingId);
  if (index === -1) {
    return normalizeRecordingQueue([...normalizedQueue, next]);
  }

  const updated = [...normalizedQueue];
  updated[index] = {
    ...updated[index],
    ...next,
  };
  return normalizeRecordingQueue(updated);
}

export function removeRecordingQueueItem(
  queue: unknown[],
  recordingId: string
): RecordingQueueItem[] {
  return normalizeRecordingQueue(queue).filter((item) => item.recordingId !== recordingId);
}

export function updateRecordingQueueItem(
  queue: unknown[],
  recordingId: string,
  updates: Partial<RecordingQueueItem>
): RecordingQueueItem[] {
  const existing = normalizeRecordingQueue(queue).find((item) => item.recordingId === recordingId);
  if (!existing) {
    return normalizeRecordingQueue(queue);
  }

  return upsertRecordingQueueItem(queue, {
    ...existing,
    ...updates,
  });
}

export function getRecordingQueueForMeeting(
  queue: unknown[],
  meetingId: string
): RecordingQueueItem[] {
  return normalizeRecordingQueue(queue).filter((item) => item.meetingId === meetingId);
}

export function getNextPendingRecordingQueueItem(queue: unknown[]): RecordingQueueItem | undefined {
  return normalizeRecordingQueue(queue).find((item) =>
    ['queued', 'uploading', 'processing'].includes(item.status)
  );
}

export function getNextProcessableRecordingQueueItem(
  queue: unknown[],
  canProcess: (item: RecordingQueueItem) => boolean = () => true
): RecordingQueueItem | undefined {
  const now = Date.now();
  return normalizeRecordingQueue(queue).find(
    (item) =>
      ['uploading', 'queued', 'processing', 'diarization'].includes(item.status) &&
      now >= (item.backoffUntil || 0) &&
      canProcess(item)
  );
}

export function buildRecordingQueueSummary(queue: unknown[]) {
  return normalizeRecordingQueue(queue).reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    {
      total: 0,
      queued: 0,
      uploading: 0,
      processing: 0,
      failed: 0,
      done: 0,
    }
  );
}
