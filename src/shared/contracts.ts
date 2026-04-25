import type {
  AudioQualityDiagnostics,
  DiarizationResult,
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
  recordingId?: string;
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
  updatedAt?: string;
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

type UnknownRecord = Record<string, unknown>;
type IdentifiedItem = { id?: unknown };
type DiarizationPayload = Partial<DiarizationResult> & UnknownRecord;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function itemId(item: unknown) {
  return String((isRecord(item) ? (item as IdentifiedItem).id : '') || '');
}

function parseJsonRecord(value: unknown): DiarizationPayload {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return isRecord(parsed) ? (parsed as DiarizationPayload) : {};
  } catch (_) {
    return {};
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (_) {
    return [];
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizePostprocessStage(value: unknown): TranscriptionStatusPayload['postprocessStage'] {
  if (value === 'queued' || value === 'running' || value === 'done' || value === 'failed') {
    return value;
  }
  return '';
}

function normalizeTranscriptOutcome(
  value: unknown
): TranscriptionStatusPayload['transcriptOutcome'] {
  return value === 'empty' ? 'empty' : 'normal';
}

function normalizeEmptyReason(value: unknown): TranscriptionStatusPayload['emptyReason'] {
  if (
    value === 'no_segments_from_stt' ||
    value === 'segments_removed_by_vad' ||
    value === 'segments_removed_as_hallucinations' ||
    value === 'all_chunks_discarded_as_too_small'
  ) {
    return value;
  }
  return undefined;
}

function optionalObject<T extends object>(value: unknown): T | undefined {
  return value && typeof value === 'object' ? (value as T) : undefined;
}

function nullableObject<T extends object>(value: unknown): T | null {
  return value && typeof value === 'object' ? (value as T) : null;
}

export function normalizeWorkspaceState(input: unknown = {}): WorkspaceState {
  const source = asRecord(input);
  const payload: WorkspaceState = {
    meetings: Array.isArray(source.meetings) ? source.meetings : [],
    manualTasks: Array.isArray(source.manualTasks) ? source.manualTasks : [],
    taskState: isRecord(source.taskState) ? source.taskState : {},
    taskBoards: isRecord(source.taskBoards) ? source.taskBoards : {},
    calendarMeta: isRecord(source.calendarMeta) ? source.calendarMeta : {},
    vocabulary: Array.isArray(source.vocabulary) ? source.vocabulary : [],
    updatedAt: String(source.updatedAt || ''),
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

  previous.forEach((item) => {
    const id = itemId(item);
    if (id) {
      previousById.set(id, item);
    }
  });

  next.forEach((item) => {
    const id = itemId(item);
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
  current.forEach((item, index) => {
    const id = itemId(item);
    if (id) {
      byId.set(id, index);
    }
  });

  const removeIds = Array.isArray(delta.removeIds) ? delta.removeIds : [];
  if (removeIds.length) {
    const removeSet = new Set(removeIds.map((id) => String(id)));
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const id = itemId(current[i]);
      if (id && removeSet.has(id)) {
        current.splice(i, 1);
      }
    }
  }

  (Array.isArray(delta.upsert) ? delta.upsert : []).forEach((item) => {
    const id = itemId(item);
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
  const diarization = parseJsonRecord(asset?.diarization_json);
  const segments = parseJsonArray<TranscriptSegment>(asset?.transcript_json);

  return {
    recordingId: String(asset?.id || ''),
    pipelineStatus: normalizePipelineStatus(String(asset?.transcription_status || '')),
    enhancementsPending: Boolean(diarization?.enhancementsPending),
    postprocessStage: normalizePostprocessStage(diarization.postprocessStage),
    transcriptOutcome: normalizeTranscriptOutcome(diarization.transcriptOutcome),
    emptyReason: normalizeEmptyReason(diarization.emptyReason),
    userMessage: stringValue(diarization.userMessage),
    pipelineVersion: stringValue(diarization.pipelineVersion),
    pipelineGitSha: stringValue(diarization.pipelineGitSha),
    pipelineBuildTime: stringValue(diarization.pipelineBuildTime),
    audioQuality: nullableObject<AudioQualityDiagnostics>(diarization.audioQuality),
    transcriptionDiagnostics: optionalObject<TranscriptionDiagnostics>(
      diarization.transcriptionDiagnostics
    ),
    qualityMetrics: nullableObject<TranscriptionQualityMetrics>(diarization.qualityMetrics),
    segments: Array.isArray(segments) ? segments : [],
    diarization,
    speakerNames: isRecord(diarization.speakerNames)
      ? (diarization.speakerNames as Record<string, string>)
      : {},
    speakerCount: Number(diarization.speakerCount || 0),
    confidence: Number(diarization.confidence || 0),
    reviewSummary: typeof diarization.reviewSummary === 'string' ? diarization.reviewSummary : null,
    errorMessage: stringValue(diarization.errorMessage),
    updatedAt: String(asset?.updated_at || ''),
  };
}

export function normalizeMediaTranscriptionResponse(
  response: MediaTranscriptionResponse | null | undefined
): TranscriptionStatusPayload {
  const diarization = isRecord(response?.diarization)
    ? (response.diarization as DiarizationPayload)
    : {};
  const segments = Array.isArray(response?.segments) ? response.segments : [];

  return {
    recordingId: String(response?.recordingId || ''),
    pipelineStatus: normalizePipelineStatus(String(response?.pipelineStatus || 'queued')),
    enhancementsPending: Boolean(diarization.enhancementsPending ?? response?.enhancementsPending),
    postprocessStage: normalizePostprocessStage(
      diarization.postprocessStage || response?.postprocessStage
    ),
    transcriptOutcome: normalizeTranscriptOutcome(
      diarization.transcriptOutcome || response?.transcriptOutcome
    ),
    emptyReason: normalizeEmptyReason(diarization.emptyReason || response?.emptyReason),
    userMessage: stringValue(diarization.userMessage || response?.userMessage),
    pipelineVersion: stringValue(diarization.pipelineVersion || response?.pipelineVersion),
    pipelineGitSha: stringValue(diarization.pipelineGitSha || response?.pipelineGitSha),
    pipelineBuildTime: stringValue(diarization.pipelineBuildTime || response?.pipelineBuildTime),
    audioQuality:
      nullableObject<AudioQualityDiagnostics>(diarization.audioQuality) ||
      response?.audioQuality ||
      null,
    transcriptionDiagnostics:
      optionalObject<TranscriptionDiagnostics>(diarization.transcriptionDiagnostics) ||
      response?.transcriptionDiagnostics ||
      undefined,
    qualityMetrics:
      nullableObject<TranscriptionQualityMetrics>(diarization.qualityMetrics) ||
      response?.qualityMetrics ||
      null,
    segments,
    diarization,
    speakerNames: isRecord(diarization.speakerNames)
      ? (diarization.speakerNames as Record<string, string>)
      : {},
    speakerCount: Number(diarization.speakerCount || 0),
    confidence: Number(diarization.confidence || 0),
    reviewSummary:
      typeof diarization.reviewSummary === 'string'
        ? diarization.reviewSummary
        : response?.reviewSummary || null,
    errorMessage: stringValue(diarization.errorMessage || response?.errorMessage),
    updatedAt: String(response?.updatedAt || ''),
  };
}
