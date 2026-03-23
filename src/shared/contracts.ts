import type {
  AudioQualityDiagnostics,
  MeetingAsset,
  TranscriptSegment,
  TranscriptionDiagnostics,
  TranscriptionStatusPayload,
  WorkspaceState,
} from "./types";

export interface WorkspaceStatePayload {
  meetings: unknown[];
  manualTasks: unknown[];
  taskState: Record<string, unknown>;
  taskBoards: Record<string, unknown>;
  calendarMeta: Record<string, unknown>;
  vocabulary: string[];
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
  pipelineStatus?: TranscriptionStatusPayload["pipelineStatus"] | "completed";
  transcriptOutcome?: TranscriptionStatusPayload["transcriptOutcome"];
  emptyReason?: TranscriptionStatusPayload["emptyReason"];
  userMessage?: string;
  pipelineVersion?: string;
  pipelineGitSha?: string;
  pipelineBuildTime?: string;
  audioQuality?: AudioQualityDiagnostics | null;
  transcriptionDiagnostics?: TranscriptionDiagnostics | null;
  reviewSummary?: string | null;
  errorMessage?: string;
}

// ─── AI proxy endpoint contracts ─────────────────────────────────────────────

export interface AiSuggestedTask {
  title: string;
  description?: string;
  owner?: string | null;
  dueDate?: string | null;
  priority?: "high" | "medium" | "low";
  tags?: string[];
}

export interface AiSuggestTasksRequest {
  transcript: Array<{ speakerName?: string; speakerId?: number; text: string }>;
  people?: Array<{ name?: string; email?: string }>;
}

export interface AiSuggestTasksResponse {
  tasks: AiSuggestedTask[];
}

export interface AiPersonProfileRequest {
  personName: string;
  meetings: unknown[];
  allSegments: Array<{ text: string; meetingTitle?: string }>;
}

export interface AiPersonProfileResponse {
  mode: "anthropic" | "no-key";
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
    taskState: input.taskState && typeof input.taskState === "object" ? input.taskState : {},
    taskBoards: input.taskBoards && typeof input.taskBoards === "object" ? input.taskBoards : {},
    calendarMeta: input.calendarMeta && typeof input.calendarMeta === "object" ? input.calendarMeta : {},
    vocabulary: Array.isArray(input.vocabulary) ? input.vocabulary : [],
    updatedAt: String(input.updatedAt || ""),
  };

  return payload;
}

export function serializeWorkspaceState(input: Partial<WorkspaceStatePayload> = {}) {
  return JSON.stringify(normalizeWorkspaceState(input));
}

export function normalizePipelineStatus(value: string | undefined): TranscriptionStatusPayload["pipelineStatus"] {
  if (value === "completed") return "done";
  if (
    value === "uploading" ||
    value === "queued" ||
    value === "processing" ||
    value === "diarization" ||
    value === "review" ||
    value === "failed" ||
    value === "done"
  ) {
    return value;
  }
  return "queued";
}

export function normalizeTranscriptionStatusPayload(asset: Partial<MeetingAsset> | null | undefined): TranscriptionStatusPayload {
  let diarization: any = {};
  let segments: TranscriptSegment[] = [];

  try {
    diarization = JSON.parse(String(asset?.diarization_json || "{}"));
  } catch (_) {}
  try {
    segments = JSON.parse(String(asset?.transcript_json || "[]"));
  } catch (_) {}

  return {
    recordingId: String(asset?.id || ""),
    pipelineStatus: normalizePipelineStatus(String(asset?.transcription_status || "")),
    transcriptOutcome: diarization?.transcriptOutcome || "normal",
    emptyReason: diarization?.emptyReason || "",
    userMessage: diarization?.userMessage || "",
    pipelineVersion: diarization?.pipelineVersion || "",
    pipelineGitSha: diarization?.pipelineGitSha || "",
    pipelineBuildTime: diarization?.pipelineBuildTime || "",
    audioQuality:
      diarization?.audioQuality && typeof diarization.audioQuality === "object"
        ? diarization.audioQuality
        : null,
    transcriptionDiagnostics:
      diarization?.transcriptionDiagnostics && typeof diarization.transcriptionDiagnostics === "object"
        ? diarization.transcriptionDiagnostics
        : null,
    segments: Array.isArray(segments) ? segments : [],
    diarization: diarization && typeof diarization === "object" ? diarization : {},
    speakerNames: diarization?.speakerNames || {},
    speakerCount: diarization?.speakerCount || 0,
    confidence: diarization?.confidence || 0,
    reviewSummary: diarization?.reviewSummary || null,
    errorMessage: diarization?.errorMessage || "",
    updatedAt: String(asset?.updated_at || ""),
  };
}

export function normalizeMediaTranscriptionResponse(response: MediaTranscriptionResponse | null | undefined): TranscriptionStatusPayload {
  const diarization = response?.diarization && typeof response.diarization === "object" ? response.diarization : {};
  const segments = Array.isArray(response?.segments) ? response.segments : [];

  return {
    recordingId: String((response as any)?.recordingId || ""),
    pipelineStatus: normalizePipelineStatus(String(response?.pipelineStatus || "queued")),
    transcriptOutcome: (diarization as any)?.transcriptOutcome || response?.transcriptOutcome || "normal",
    emptyReason: (diarization as any)?.emptyReason || response?.emptyReason || "",
    userMessage: (diarization as any)?.userMessage || response?.userMessage || "",
    pipelineVersion: (diarization as any)?.pipelineVersion || response?.pipelineVersion || "",
    pipelineGitSha: (diarization as any)?.pipelineGitSha || response?.pipelineGitSha || "",
    pipelineBuildTime: (diarization as any)?.pipelineBuildTime || response?.pipelineBuildTime || "",
    audioQuality:
      (diarization as any)?.audioQuality && typeof (diarization as any).audioQuality === "object"
        ? (diarization as any).audioQuality
        : response?.audioQuality || null,
    transcriptionDiagnostics:
      (diarization as any)?.transcriptionDiagnostics && typeof (diarization as any).transcriptionDiagnostics === "object"
        ? (diarization as any).transcriptionDiagnostics
        : response?.transcriptionDiagnostics || null,
    segments,
    diarization,
    speakerNames: (diarization as any)?.speakerNames || {},
    speakerCount: (diarization as any)?.speakerCount || 0,
    confidence: (diarization as any)?.confidence || 0,
    reviewSummary: (diarization as any)?.reviewSummary || response?.reviewSummary || null,
    errorMessage: (diarization as any)?.errorMessage || response?.errorMessage || "",
    updatedAt: String((response as any)?.updatedAt || ""),
  };
}
