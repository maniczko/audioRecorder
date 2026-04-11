import type {
  AudioQualityDiagnostics,
  MeetingAsset,
  TranscriptionQualityMetrics,
  TranscriptSegment,
  TranscriptionDiagnostics,
  TranscriptionStatusPayload,
  WorkspaceState,
} from './types.js';

export interface WorkspaceStatePayload {
  meetings: unknown[];
  manualTasks: unknown[];
  taskState: Record<string, unknown>;
  taskBoards: Record<string, unknown>;
  calendarMeta: Record<string, unknown>;
  vocabulary: string[];
}

export interface WorkspaceCollectionDelta {
  upsert?: unknown[];
  removeIds?: string[];
}

export interface WorkspaceStateDeltaPayload {
  meetings?: WorkspaceCollectionDelta | unknown[];
  manualTasks?: WorkspaceCollectionDelta | unknown[];
  taskState?: Record<string, unknown>;
  taskBoards?: Record<string, unknown>;
  calendarMeta?: Record<string, unknown>;
  vocabulary?: string[];
}

export interface SessionPayload<TState = WorkspaceState> {
  user: Record<string, unknown>;
  users: unknown[];
  workspaces: unknown[];
  workspaceId: string;
  state: TState;
}

export interface WorkspaceStateResponse extends WorkspaceStatePayload {
  updatedAt: string;
}

export interface MediaTranscriptionResponse {
  diarization?: unknown;
  segments?: TranscriptSegment[];
  providerId?: string;
  providerLabel?: string;
  pipelineStatus?: TranscriptionStatusPayload['pipelineStatus'] | 'completed';
  enhancementsPending?: boolean;
  postprocessStage?: TranscriptionStatusPayload['postprocessStage'];
  transcriptOutcome?: TranscriptionStatusPayload['transcriptOutcome'];
  emptyReason?: TranscriptionStatusPayload['emptyReason'];
  userMessage?: string;
  pipelineVersion?: string;
  pipelineGitSha?: string;
  pipelineBuildTime?: string;
  audioQuality?: AudioQualityDiagnostics | null;
  transcriptionDiagnostics?: TranscriptionDiagnostics | null;
  qualityMetrics?: TranscriptionQualityMetrics | null;
  reviewSummary?: string | null;
  errorMessage?: string;
}

// ─── AI proxy endpoint contracts ─────────────────────────────────────────────

export interface AiSuggestedTask {
  title: string;
  description?: string;
  owner?: string | null;
  dueDate?: string | null;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

export interface AiSuggestTasksRequest {
  transcript: Array<{ speakerName?: string; speakerId?: number; text: string }>;
  people?: Array<{ name?: string; email?: string }>;
}

export interface AiSuggestTasksResponse {
  tasks: AiSuggestedTask[];
}

export interface AiSearchItem {
  id: string;
  title: string;
  subtitle?: string;
  type?: string;
  group?: string;
}

export interface AiSearchRequest {
  query: string;
  items: AiSearchItem[];
}

export interface AiSearchMatch extends AiSearchItem {
  reason?: string;
  score?: number;
}

export interface AiSearchResponse {
  mode: 'anthropic' | 'no-key';
  matches: AiSearchMatch[];
}

export interface AiPersonProfileRequest {
  personName: string;
  meetings: unknown[];
  allSegments: Array<{ text: string; meetingTitle?: string }>;
}

export interface AiPersonProfileResponse {
  mode: 'anthropic' | 'no-key';
  disc?: { D: number; I: number; S: number; C: number };
  discStyle?: string;
  discDescription?: string;
  values?: Array<{ value: string; icon?: string; quote?: string }>;
  communicationStyle?: string;
  decisionStyle?: string;
  conflictStyle?: string;
  listeningStyle?: string;
  stressResponse?: string;
  workingWithTips?: string[];
  communicationDos?: string[];
  communicationDonts?: string[];
  redFlags?: string[];
  coachingNote?: string;
  meetingsAnalyzed?: number;
  generatedAt?: string;
}

export function normalizeWorkspaceState(input: any = {}): WorkspaceState {
  const payload: WorkspaceState = {
    meetings: Array.isArray(input.meetings) ? input.meetings : [],
    manualTasks: Array.isArray(input.manualTasks) ? input.manualTasks : [],
    taskState: input.taskState && typeof input.taskState === 'object' ? input.taskState : {},
    taskBoards: input.taskBoards && typeof input.taskBoards === 'object' ? input.taskBoards : {},
    calendarMeta:
      input.calendarMeta && typeof input.calendarMeta === 'object' ? input.calendarMeta : {},
    vocabulary: Array.isArray(input.vocabulary) ? input.vocabulary : [],
    updatedAt: String(input.updatedAt || ''),
  };

  return payload;
}

export function serializeWorkspaceState(input: Partial<WorkspaceStatePayload> = {}) {
  return JSON.stringify(normalizeWorkspaceState(input));
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function buildCollectionDelta(
  previous: unknown[] = [],
  next: unknown[] = []
): WorkspaceCollectionDelta | null {
  const previousById = new Map<string, unknown>();
  const nextById = new Map<string, unknown>();

  previous.forEach((item: any) => {
    const id = String(item?.id || '');
    if (id) {
      previousById.set(id, item);
    }
  });

  next.forEach((item: any) => {
    const id = String(item?.id || '');
    if (id) {
      nextById.set(id, item);
    }
  });

  const upsert: unknown[] = [];
  nextById.forEach((item, id) => {
    if (!previousById.has(id) || stableJson(previousById.get(id)) !== stableJson(item)) {
      upsert.push(item);
    }
  });

  const removeIds = [...previousById.keys()].filter((id) => !nextById.has(id));

  if (!upsert.length && !removeIds.length) {
    return null;
  }

  return {
    ...(upsert.length ? { upsert } : {}),
    ...(removeIds.length ? { removeIds } : {}),
  };
}

function buildObjectDelta(
  previous: Record<string, unknown> = {},
  next: Record<string, unknown> = {}
) {
  const delta: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);

  keys.forEach((key) => {
    if (!(key in next)) {
      delta[key] = null;
      return;
    }

    if (stableJson(previous[key]) !== stableJson(next[key])) {
      delta[key] = next[key];
    }
  });

  return delta;
}

export function buildWorkspaceStateDelta(
  previous: Partial<WorkspaceStatePayload> = {},
  next: Partial<WorkspaceStatePayload> = {}
) {
  const prevState = normalizeWorkspaceState(previous);
  const nextState = normalizeWorkspaceState(next);
  const delta: WorkspaceStateDeltaPayload = {};

  const meetingsDelta = buildCollectionDelta(prevState.meetings, nextState.meetings);
  if (meetingsDelta) {
    delta.meetings = meetingsDelta;
  }

  const manualTasksDelta = buildCollectionDelta(prevState.manualTasks, nextState.manualTasks);
  if (manualTasksDelta) {
    delta.manualTasks = manualTasksDelta;
  }

  const taskStateDelta = buildObjectDelta(
    prevState.taskState as Record<string, unknown>,
    nextState.taskState as Record<string, unknown>
  );
  if (Object.keys(taskStateDelta).length) {
    delta.taskState = taskStateDelta;
  }

  const taskBoardsDelta = buildObjectDelta(
    prevState.taskBoards as Record<string, unknown>,
    nextState.taskBoards as Record<string, unknown>
  );
  if (Object.keys(taskBoardsDelta).length) {
    delta.taskBoards = taskBoardsDelta;
  }

  const calendarMetaDelta = buildObjectDelta(
    prevState.calendarMeta as Record<string, unknown>,
    nextState.calendarMeta as Record<string, unknown>
  );
  if (Object.keys(calendarMetaDelta).length) {
    delta.calendarMeta = calendarMetaDelta;
  }

  if (stableJson(prevState.vocabulary) !== stableJson(nextState.vocabulary)) {
    delta.vocabulary = Array.isArray(nextState.vocabulary) ? nextState.vocabulary : [];
  }

  return delta;
}

function applyCollectionDelta(
  previous: unknown[] = [],
  delta: WorkspaceCollectionDelta | unknown[] | undefined
) {
  if (!delta) {
    return previous;
  }

  if (Array.isArray(delta)) {
    return delta;
  }

  const current = [...previous];
  const byId = new Map<string, number>();
  current.forEach((item: any, index) => {
    const id = String(item?.id || '');
    if (id) {
      byId.set(id, index);
    }
  });

  const removeIds = Array.isArray(delta.removeIds) ? delta.removeIds : [];
  if (removeIds.length) {
    const removeSet = new Set(removeIds.map((id) => String(id)));
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const id = String((current[i] as any)?.id || '');
      if (id && removeSet.has(id)) {
        current.splice(i, 1);
      }
    }
  }

  (Array.isArray(delta.upsert) ? delta.upsert : []).forEach((item: any) => {
    const id = String(item?.id || '');
    if (!id) {
      current.push(item);
      return;
    }

    const existingIndex = byId.get(id);
    if (existingIndex === undefined) {
      byId.set(id, current.length);
      current.push(item);
      return;
    }

    current[existingIndex] = item;
  });

  return current;
}

function applyObjectDelta(
  previous: Record<string, unknown> = {},
  delta: Record<string, unknown> | undefined
) {
  if (!delta) {
    return previous;
  }

  const next = { ...previous };
  Object.entries(delta).forEach(([key, value]) => {
    if (value === null) {
      delete next[key];
      return;
    }
    next[key] = value;
  });
  return next;
}

export function applyWorkspaceStateDelta(
  previous: Partial<WorkspaceStatePayload> = {},
  delta: WorkspaceStateDeltaPayload = {}
) {
  const current = normalizeWorkspaceState(previous);

  return normalizeWorkspaceState({
    meetings: applyCollectionDelta(current.meetings, delta.meetings),
    manualTasks: applyCollectionDelta(current.manualTasks, delta.manualTasks),
    taskState: applyObjectDelta(current.taskState as Record<string, unknown>, delta.taskState),
    taskBoards: applyObjectDelta(current.taskBoards as Record<string, unknown>, delta.taskBoards),
    calendarMeta: applyObjectDelta(
      current.calendarMeta as Record<string, unknown>,
      delta.calendarMeta
    ),
    vocabulary: Array.isArray(delta.vocabulary) ? delta.vocabulary : current.vocabulary,
    updatedAt: current.updatedAt,
  });
}

export function normalizePipelineStatus(
  value: string | undefined
): TranscriptionStatusPayload['pipelineStatus'] {
  if (value === 'completed') return 'done';
  if (
    value === 'uploading' ||
    value === 'queued' ||
    value === 'processing' ||
    value === 'diarization' ||
    value === 'review' ||
    value === 'failed' ||
    value === 'done'
  ) {
    return value;
  }
  return 'queued';
}

export function normalizeTranscriptionStatusPayload(
  asset: Partial<MeetingAsset> | null | undefined
): TranscriptionStatusPayload {
  let diarization: any = {};
  let segments: TranscriptSegment[] = [];

  try {
    diarization = JSON.parse(String(asset?.diarization_json || '{}'));
  } catch (_) {}
  try {
    segments = JSON.parse(String(asset?.transcript_json || '[]'));
  } catch (_) {}

  return {
    recordingId: String(asset?.id || ''),
    pipelineStatus: normalizePipelineStatus(String(asset?.transcription_status || '')),
    enhancementsPending: Boolean(diarization?.enhancementsPending),
    postprocessStage: String(
      diarization?.postprocessStage || ''
    ) as TranscriptionStatusPayload['postprocessStage'],
    transcriptOutcome: diarization?.transcriptOutcome || 'normal',
    emptyReason: diarization?.emptyReason || '',
    userMessage: diarization?.userMessage || '',
    pipelineVersion: diarization?.pipelineVersion || '',
    pipelineGitSha: diarization?.pipelineGitSha || '',
    pipelineBuildTime: diarization?.pipelineBuildTime || '',
    audioQuality:
      diarization?.audioQuality && typeof diarization.audioQuality === 'object'
        ? diarization.audioQuality
        : null,
    transcriptionDiagnostics:
      diarization?.transcriptionDiagnostics &&
      typeof diarization.transcriptionDiagnostics === 'object'
        ? diarization.transcriptionDiagnostics
        : null,
    qualityMetrics:
      diarization?.qualityMetrics && typeof diarization.qualityMetrics === 'object'
        ? diarization.qualityMetrics
        : null,
    segments: Array.isArray(segments) ? segments : [],
    diarization: diarization && typeof diarization === 'object' ? diarization : {},
    speakerNames: diarization?.speakerNames || {},
    speakerCount: diarization?.speakerCount || 0,
    confidence: diarization?.confidence || 0,
    reviewSummary: diarization?.reviewSummary || null,
    errorMessage: diarization?.errorMessage || '',
    updatedAt: String(asset?.updated_at || ''),
  };
}

export function normalizeMediaTranscriptionResponse(
  response: MediaTranscriptionResponse | null | undefined
): TranscriptionStatusPayload {
  const diarization =
    response?.diarization && typeof response.diarization === 'object' ? response.diarization : {};
  const segments = Array.isArray(response?.segments) ? response.segments : [];

  return {
    recordingId: String((response as any)?.recordingId || ''),
    pipelineStatus: normalizePipelineStatus(String(response?.pipelineStatus || 'queued')),
    enhancementsPending: Boolean(
      (diarization as any)?.enhancementsPending ?? response?.enhancementsPending
    ),
    postprocessStage: String(
      (diarization as any)?.postprocessStage || response?.postprocessStage || ''
    ) as TranscriptionStatusPayload['postprocessStage'],
    transcriptOutcome:
      (diarization as any)?.transcriptOutcome || response?.transcriptOutcome || 'normal',
    emptyReason: (diarization as any)?.emptyReason || response?.emptyReason || '',
    userMessage: (diarization as any)?.userMessage || response?.userMessage || '',
    pipelineVersion: (diarization as any)?.pipelineVersion || response?.pipelineVersion || '',
    pipelineGitSha: (diarization as any)?.pipelineGitSha || response?.pipelineGitSha || '',
    pipelineBuildTime: (diarization as any)?.pipelineBuildTime || response?.pipelineBuildTime || '',
    audioQuality:
      (diarization as any)?.audioQuality && typeof (diarization as any).audioQuality === 'object'
        ? (diarization as any).audioQuality
        : response?.audioQuality || null,
    transcriptionDiagnostics:
      (diarization as any)?.transcriptionDiagnostics &&
      typeof (diarization as any).transcriptionDiagnostics === 'object'
        ? (diarization as any).transcriptionDiagnostics
        : response?.transcriptionDiagnostics || null,
    qualityMetrics:
      (diarization as any)?.qualityMetrics &&
      typeof (diarization as any).qualityMetrics === 'object'
        ? (diarization as any).qualityMetrics
        : response?.qualityMetrics || null,
    segments,
    diarization,
    speakerNames: (diarization as any)?.speakerNames || {},
    speakerCount: (diarization as any)?.speakerCount || 0,
    confidence: (diarization as any)?.confidence || 0,
    reviewSummary: (diarization as any)?.reviewSummary || response?.reviewSummary || null,
    errorMessage: (diarization as any)?.errorMessage || response?.errorMessage || '',
    updatedAt: String((response as any)?.updatedAt || ''),
  };
}
