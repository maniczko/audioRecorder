import type {
  AudioQualityDiagnostics,
  DiarizationResult,
  MeetingAsset,
  TranscriptionQualityMetrics,
  TranscriptSegment,
  TranscriptionDiagnostics,
  TranscriptionStatusPayload,
  VoiceProfileLabelingDiagnostics,
  WorkspaceFeatureFlags,
  WorkspaceState,
  WorkspaceSttProvider,
  TaskRecord,
  TaskStatePatch,
  TaskStateOverlay,
} from './types.js';

export interface WorkspaceStatePayload {
  meetings: unknown[];
  manualTasks: TaskRecord[];
  manualPeople?: unknown[];
  taskState: TaskStateOverlay;
  taskBoards: Record<string, unknown>;
  calendarMeta: Record<string, unknown>;
  vocabulary: string[];
  retentionDays?: number;
  featureFlags?: Partial<WorkspaceFeatureFlags>;
}

export interface WorkspaceCollectionDelta {
  upsert?: unknown[];
  removeIds?: string[];
}

export interface WorkspaceStateDeltaPayload {
  meetings?: WorkspaceCollectionDelta | unknown[];
  manualTasks?: WorkspaceCollectionDelta | unknown[];
  manualPeople?: WorkspaceCollectionDelta | unknown[];
  taskState?: Record<string, TaskStatePatch | null>;
  taskBoards?: Record<string, unknown>;
  calendarMeta?: Record<string, unknown>;
  vocabulary?: string[];
  retentionDays?: number;
  featureFlags?: Partial<WorkspaceFeatureFlags>;
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
  verifiedSegments?: TranscriptSegment[];
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
  activeJob?: boolean;
  queuedPosition?: number | null;
  processingAgeMs?: number | null;
  retryAfterMs?: number | null;
  errorCode?: string;
  retryable?: boolean;
  audioValidation?: Record<string, unknown> | null;
  sttAttempts?: TranscriptionDiagnostics['sttAttempts'];
  voiceProfileLabeling?: VoiceProfileLabelingDiagnostics;
  durationMs?: number;
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
type TranscriptionRuntimeFields = Pick<
  TranscriptionStatusPayload,
  'activeJob' | 'queuedPosition' | 'processingAgeMs' | 'retryAfterMs' | 'durationMs'
>;
type MediaAssetWithRuntime = Partial<MeetingAsset> & Partial<TranscriptionRuntimeFields>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
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

function itemId(item: unknown) {
  return String((isRecord(item) ? (item as IdentifiedItem).id : '') || '');
}

function itemUpdatedAtMs(item: unknown) {
  const raw = isRecord(item) ? String(item.updatedAt || item.createdAt || '') : '';
  const parsed = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function extractTombstoneIds(calendarMeta: unknown, key: string, legacyKey = '') {
  const meta = asRecord(calendarMeta);
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = String(
      isRecord(value) ? value.id || value.recordingId || value.meetingId || '' : value || ''
    ).trim();
    if (id) ids.add(id);
  };

  if (Array.isArray(meta[key])) {
    meta[key].forEach(add);
  }
  if (legacyKey && Array.isArray(meta[legacyKey])) {
    meta[legacyKey].forEach(add);
  }
  return ids;
}

function normalizeMeetingCollection(meetings: unknown[], calendarMeta: unknown) {
  const meetingTombstones = extractTombstoneIds(
    calendarMeta,
    'meetingTombstones',
    'deletedMeetingIds'
  );
  const byId = new Map<string, unknown>();

  meetings.forEach((meeting) => {
    const id = itemId(meeting).trim();
    if (!id || meetingTombstones.has(id)) {
      return;
    }

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, meeting);
      return;
    }

    const existingUpdatedAt = itemUpdatedAtMs(existing);
    const nextUpdatedAt = itemUpdatedAtMs(meeting);
    if (!Number.isFinite(existingUpdatedAt) || nextUpdatedAt >= existingUpdatedAt) {
      byId.set(id, meeting);
    }
  });

  return [...byId.values()];
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

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function maxTranscriptEndMs(segments: TranscriptSegment[]) {
  return segments.reduce((max, segment) => {
    const endSeconds = positiveNumber(segment.endTimestamp) || positiveNumber(segment.timestamp);
    return Math.max(max, endSeconds * 1000);
  }, 0);
}

function resolveTranscriptionDurationMs(
  asset: MediaAssetWithRuntime | null | undefined,
  diarization: DiarizationPayload,
  segments: TranscriptSegment[]
) {
  const manifest = parseJsonRecord(asset?.media_manifest_json);
  const audioQuality = nullableObject<AudioQualityDiagnostics>(diarization.audioQuality);
  const candidates = [
    positiveNumber(asset?.durationMs),
    positiveNumber(manifest.durationMs),
    positiveNumber(audioQuality?.durationSeconds) * 1000,
    maxTranscriptEndMs(segments),
  ];

  return candidates.find((durationMs) => durationMs > 0) || undefined;
}

function resolveRemoteTranscriptionDurationMs(
  response: MediaTranscriptionResponse | null | undefined,
  diarization: DiarizationPayload,
  segments: TranscriptSegment[]
) {
  const audioQuality = nullableObject<AudioQualityDiagnostics>(diarization.audioQuality);
  const candidates = [
    positiveNumber(response?.durationMs),
    positiveNumber(audioQuality?.durationSeconds) * 1000,
    maxTranscriptEndMs(segments),
  ];

  return candidates.find((durationMs) => durationMs > 0) || undefined;
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

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function resolveRetryAfterMs(primary: unknown, fallback: unknown = null): number | null {
  const value = Number(primary);
  if (Number.isFinite(value) && value > 0) return value;
  const fallbackValue = Number(fallback);
  return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : null;
}

function resolveVoiceProfileLabeling(
  diagnostics: TranscriptionDiagnostics | undefined,
  fallback: unknown = null
): VoiceProfileLabelingDiagnostics | undefined {
  return (
    optionalObject<VoiceProfileLabelingDiagnostics>(diagnostics?.voiceProfileLabeling) ||
    optionalObject<VoiceProfileLabelingDiagnostics>(fallback)
  );
}

function normalizeRetentionDays(value: unknown, fallback = 365): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

const WORKSPACE_STT_PROVIDERS = ['auto', 'openai', 'groq', 'local-whisper', 'disabled'] as const;

export const DEFAULT_WORKSPACE_FEATURE_FLAGS: WorkspaceFeatureFlags = {
  sttProvider: 'auto',
  diarization: true,
  meetingAnalysis: true,
  embeddings: true,
  imageGeneration: true,
  liveTranscription: true,
  retentionFeatures: true,
  experimentalUi: false,
};

function normalizeBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

export function normalizeWorkspaceFeatureFlags(input: unknown = {}): WorkspaceFeatureFlags {
  const source = asRecord(input);
  const sttProvider = String(source.sttProvider || DEFAULT_WORKSPACE_FEATURE_FLAGS.sttProvider)
    .trim()
    .toLowerCase();

  return {
    sttProvider: WORKSPACE_STT_PROVIDERS.includes(sttProvider as WorkspaceSttProvider)
      ? (sttProvider as WorkspaceSttProvider)
      : DEFAULT_WORKSPACE_FEATURE_FLAGS.sttProvider,
    diarization: normalizeBooleanFlag(
      source.diarization,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.diarization
    ),
    meetingAnalysis: normalizeBooleanFlag(
      source.meetingAnalysis,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.meetingAnalysis
    ),
    embeddings: normalizeBooleanFlag(source.embeddings, DEFAULT_WORKSPACE_FEATURE_FLAGS.embeddings),
    imageGeneration: normalizeBooleanFlag(
      source.imageGeneration,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.imageGeneration
    ),
    liveTranscription: normalizeBooleanFlag(
      source.liveTranscription,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.liveTranscription
    ),
    retentionFeatures: normalizeBooleanFlag(
      source.retentionFeatures,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.retentionFeatures
    ),
    experimentalUi: normalizeBooleanFlag(
      source.experimentalUi,
      DEFAULT_WORKSPACE_FEATURE_FLAGS.experimentalUi
    ),
  };
}

export function normalizeWorkspaceState(input: unknown = {}): WorkspaceState {
  const source = asRecord(input);
  const calendarMeta = isRecord(source.calendarMeta) ? source.calendarMeta : {};
  const payload: WorkspaceState = {
    meetings: normalizeMeetingCollection(
      Array.isArray(source.meetings) ? source.meetings : [],
      calendarMeta
    ),
    manualTasks: normalizeTaskRecords(source.manualTasks),
    manualPeople: Array.isArray(source.manualPeople) ? source.manualPeople : [],
    taskState: normalizeTaskState(source.taskState),
    taskBoards: isRecord(source.taskBoards) ? source.taskBoards : {},
    calendarMeta,
    vocabulary: Array.isArray(source.vocabulary) ? source.vocabulary : [],
    retentionDays: normalizeRetentionDays(source.retentionDays),
    featureFlags: normalizeWorkspaceFeatureFlags(source.featureFlags),
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

  const manualPeopleDelta = buildCollectionDelta(
    prevState.manualPeople ?? [],
    nextState.manualPeople ?? []
  );
  if (manualPeopleDelta) {
    delta.manualPeople = manualPeopleDelta;
  }

  const taskStateDelta = buildObjectDelta(
    prevState.taskState as Record<string, unknown>,
    nextState.taskState as Record<string, unknown>
  ) as Record<string, TaskStatePatch | null>;
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

  if (prevState.retentionDays !== nextState.retentionDays) {
    delta.retentionDays = nextState.retentionDays;
  }
  if (stableJson(prevState.featureFlags) !== stableJson(nextState.featureFlags)) {
    delta.featureFlags = nextState.featureFlags;
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

function tombstoneEntry(id: string, source: string) {
  return { id, deletedAt: new Date().toISOString(), source };
}

function appendTombstones(
  calendarMeta: Record<string, unknown>,
  key: 'meetingTombstones' | 'recordingTombstones',
  ids: string[],
  source: string
) {
  if (!ids.length) return calendarMeta;

  const byId = new Map<string, unknown>();
  const existing = Array.isArray(calendarMeta[key]) ? calendarMeta[key] : [];
  existing.forEach((item) => {
    const id = String(
      isRecord(item) ? item.id || item.recordingId || item.meetingId || '' : item || ''
    ).trim();
    if (id) byId.set(id, item);
  });

  ids.forEach((rawId) => {
    const id = String(rawId || '').trim();
    if (!id || byId.has(id)) return;
    byId.set(id, tombstoneEntry(id, source));
  });

  return {
    ...calendarMeta,
    [key]: [...byId.values()],
  };
}

function recordingIdsFromMeeting(meeting: unknown) {
  if (!isRecord(meeting)) return [];
  const ids = new Set<string>();
  const latestRecordingId = String(meeting.latestRecordingId || '').trim();
  if (latestRecordingId) ids.add(latestRecordingId);

  const recordings = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  recordings.forEach((recording) => {
    const id = String(
      isRecord(recording) ? recording.id || recording.recordingId || '' : ''
    ).trim();
    if (id) ids.add(id);
  });

  return [...ids];
}

function calendarMetaWithMeetingDeleteTombstones(
  currentMeetings: unknown[],
  calendarMeta: Record<string, unknown>,
  meetingDelta: WorkspaceCollectionDelta | unknown[] | undefined
) {
  if (!meetingDelta || Array.isArray(meetingDelta) || !Array.isArray(meetingDelta.removeIds)) {
    return calendarMeta;
  }

  const removeSet = new Set(meetingDelta.removeIds.map((id) => String(id || '').trim()));
  const removedMeetings = currentMeetings.filter((meeting) => removeSet.has(itemId(meeting)));
  const removedMeetingIds = removedMeetings.map(itemId).filter(Boolean);
  const removedRecordingIds = [
    ...new Set(removedMeetings.flatMap((meeting) => recordingIdsFromMeeting(meeting))),
  ];

  return appendTombstones(
    appendTombstones(calendarMeta, 'meetingTombstones', removedMeetingIds, 'meeting-delete'),
    'recordingTombstones',
    removedRecordingIds,
    'meeting-delete'
  );
}

export function applyWorkspaceStateDelta(
  previous: Partial<WorkspaceStatePayload> = {},
  delta: WorkspaceStateDeltaPayload = {}
) {
  const current = normalizeWorkspaceState(previous);
  const calendarMeta = calendarMetaWithMeetingDeleteTombstones(
    current.meetings,
    applyObjectDelta(current.calendarMeta as Record<string, unknown>, delta.calendarMeta),
    delta.meetings
  );

  return normalizeWorkspaceState({
    meetings: applyCollectionDelta(current.meetings, delta.meetings),
    manualTasks: applyCollectionDelta(current.manualTasks, delta.manualTasks),
    manualPeople: applyCollectionDelta(current.manualPeople ?? [], delta.manualPeople),
    taskState: applyObjectDelta(current.taskState as Record<string, unknown>, delta.taskState),
    taskBoards: applyObjectDelta(current.taskBoards as Record<string, unknown>, delta.taskBoards),
    calendarMeta,
    vocabulary: Array.isArray(delta.vocabulary) ? delta.vocabulary : current.vocabulary,
    retentionDays:
      typeof delta.retentionDays === 'number' ? delta.retentionDays : current.retentionDays,
    featureFlags: normalizeWorkspaceFeatureFlags(delta.featureFlags || current.featureFlags),
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
  asset: MediaAssetWithRuntime | null | undefined
): TranscriptionStatusPayload {
  const diarization = parseJsonRecord(asset?.diarization_json);
  const diagnostics = optionalObject<TranscriptionDiagnostics>(
    diarization.transcriptionDiagnostics
  );
  const segments = parseJsonArray<TranscriptSegment>(asset?.transcript_json);
  const durationMs = resolveTranscriptionDurationMs(asset, diarization, segments);
  const transcriptionDiagnostics = optionalObject<TranscriptionDiagnostics>(
    diarization.transcriptionDiagnostics
  );

  return {
    recordingId: String(asset?.id || ''),
    pipelineStatus: normalizePipelineStatus(String(asset?.transcription_status || '')),
    durationMs,
    enhancementsPending: Boolean(diarization?.enhancementsPending),
    postprocessStage: normalizePostprocessStage(diarization.postprocessStage),
    transcriptOutcome: normalizeTranscriptOutcome(diarization.transcriptOutcome),
    emptyReason: normalizeEmptyReason(diarization.emptyReason),
    userMessage: stringValue(diarization.userMessage),
    pipelineVersion: stringValue(diarization.pipelineVersion),
    pipelineGitSha: stringValue(diarization.pipelineGitSha),
    pipelineBuildTime: stringValue(diarization.pipelineBuildTime),
    audioQuality: nullableObject<AudioQualityDiagnostics>(diarization.audioQuality),
    transcriptionDiagnostics,
    voiceProfileLabeling: resolveVoiceProfileLabeling(
      transcriptionDiagnostics,
      diarization.voiceProfileLabeling
    ),
    qualityMetrics: nullableObject<TranscriptionQualityMetrics>(diarization.qualityMetrics),
    activeJob: Boolean(asset?.activeJob),
    queuedPosition: typeof asset?.queuedPosition === 'number' ? asset.queuedPosition : null,
    processingAgeMs: typeof asset?.processingAgeMs === 'number' ? asset.processingAgeMs : null,
    retryAfterMs: resolveRetryAfterMs(asset?.retryAfterMs, diarization.retryAfterMs),
    errorCode: stringValue(diarization.errorCode || diagnostics?.errorCode),
    retryable: optionalBoolean(diarization.retryable ?? diagnostics?.retryable),
    audioValidation:
      nullableObject<Record<string, unknown>>(diarization.audioValidation) ||
      nullableObject<Record<string, unknown>>(diagnostics?.audioValidation),
    sttAttempts: Array.isArray(diagnostics?.sttAttempts) ? diagnostics.sttAttempts : [],
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
  const diagnostics = optionalObject<TranscriptionDiagnostics>(
    diarization.transcriptionDiagnostics
  );
  const segments = Array.isArray(response?.segments) ? response.segments : [];
  const durationMs = resolveRemoteTranscriptionDurationMs(response, diarization, segments);
  const transcriptionDiagnostics =
    optionalObject<TranscriptionDiagnostics>(diarization.transcriptionDiagnostics) ||
    response?.transcriptionDiagnostics ||
    undefined;

  return {
    recordingId: String(response?.recordingId || ''),
    pipelineStatus: normalizePipelineStatus(String(response?.pipelineStatus || 'queued')),
    durationMs,
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
    transcriptionDiagnostics,
    voiceProfileLabeling: resolveVoiceProfileLabeling(
      transcriptionDiagnostics,
      response?.voiceProfileLabeling || diarization.voiceProfileLabeling
    ),
    qualityMetrics:
      nullableObject<TranscriptionQualityMetrics>(diarization.qualityMetrics) ||
      response?.qualityMetrics ||
      null,
    activeJob: Boolean(response?.activeJob),
    queuedPosition: typeof response?.queuedPosition === 'number' ? response.queuedPosition : null,
    processingAgeMs:
      typeof response?.processingAgeMs === 'number' ? response.processingAgeMs : null,
    retryAfterMs: resolveRetryAfterMs(response?.retryAfterMs, diarization.retryAfterMs),
    errorCode: stringValue(response?.errorCode || diarization.errorCode || diagnostics?.errorCode),
    retryable: optionalBoolean(
      response?.retryable ?? diarization.retryable ?? diagnostics?.retryable
    ),
    audioValidation:
      nullableObject<Record<string, unknown>>(response?.audioValidation) ||
      nullableObject<Record<string, unknown>>(diarization.audioValidation) ||
      nullableObject<Record<string, unknown>>(diagnostics?.audioValidation),
    sttAttempts: Array.isArray(response?.sttAttempts)
      ? response.sttAttempts
      : Array.isArray(diagnostics?.sttAttempts)
        ? diagnostics.sttAttempts
        : [],
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
