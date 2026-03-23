export interface UserProfile {
  role: string;
  company: string;
  timezone: string;
  googleEmail: string;
  phone: string;
  location: string;
  team: string;
  bio: string;
  avatarUrl: string;
  preferredInsights: string[];
  notifyDailyDigest: boolean;
  autoTaskCapture: boolean;
  preferredTaskView: "kanban" | "list";
}

export interface UserDraft extends Partial<UserProfile> {
  email: string;
  password?: string;
  name: string;
  workspaceMode?: "join" | "create";
  workspaceCode?: string;
  workspaceName?: string;
  // Google fields
  sub?: string;
  picture?: string;
  given_name?: string;
  workspaceId?: string;
}

export interface MeetingUpdates {
  title?: string;
  context?: string;
  needs?: any[];
  participants?: string[];
  tags?: string[];
  vocabulary?: string;
  transcriptReviewed?: boolean;
  analysisReviewed?: boolean;
  updatedAt?: string;
  // For queueing
  workspaceId?: string;
  meetingId?: string;
  contentType?: string;
}

export interface MediaAsset {
  id: string;
  workspace_id: string;
  meeting_id?: string;
  created_by_user_id: string;
  file_path: string;
  content_type: string;
  size_bytes: number;
  transcription_status: "queued" | "processing" | "completed" | "failed";
  transcript_json: string;
  diarization_json: string;
  created_at: string;
  updated_at: string;
}

export interface AudioQualityDiagnostics {
  codec?: string;
  sampleRateHz?: number;
  channels?: number;
  bitrateKbps?: number;
  durationSeconds?: number;
  meanVolumeDb?: number;
  maxVolumeDb?: number;
  silenceRatio?: number;
  qualityScore?: number;
  qualityLabel?: "good" | "fair" | "poor";
  enhancementRecommended?: boolean;
  enhancementApplied?: boolean;
  enhancementProfile?: "none" | "standard" | "enhanced";
}

export interface TranscriptionDiagnostics {
  usedChunking?: boolean;
  fileSizeBytes?: number;
  chunksAttempted?: number;
  chunksExtracted?: number;
  chunksDiscardedAsTooSmall?: number;
  chunksSentToStt?: number;
  chunksFailedAtStt?: number;
  chunksReturnedEmptyPayload?: number;
  chunksWithSegments?: number;
  chunksWithWords?: number;
  chunksWithText?: number;
  chunksFlaggedSilentByVad?: number;
  mergedSegmentsCount?: number;
  mergedWordsCount?: number;
  mergedTextLength?: number;
  lastChunkErrorMessage?: string;
  transcriptionProfileUsed?: "standard" | "enhanced";
  transcriptionAttemptCount?: 1 | 2;
  sttAttempts?: SttProviderAttempt[];
}

export interface SttProviderAttempt {
  providerId: string;
  providerLabel: string;
  model: string;
  success: boolean;
  durationMs?: number;
  errorMessage?: string;
}

export interface TranscriptionQualityMetrics {
  sttProviderId?: string;
  sttProviderLabel?: string;
  sttModel?: string;
  sttAttempts?: SttProviderAttempt[];
  werProxy?: number | null;
  diarizationConfidence?: number | null;
  attemptCount?: number;
  retryCount?: number;
  failureCount?: number;
  failureRate?: number;
}

export interface TranscriptionResult {
  pipelineStatus?: string;
  enhancementsPending?: boolean;
  postprocessStage?: "queued" | "running" | "done" | "failed" | "";
  transcriptOutcome?: "normal" | "empty";
  emptyReason?:
    | "no_segments_from_stt"
    | "segments_removed_by_vad"
    | "segments_removed_as_hallucinations"
    | "all_chunks_discarded_as_too_small";
  userMessage?: string;
  pipelineVersion?: string;
  pipelineGitSha?: string;
  pipelineBuildTime?: string;
  audioQuality?: AudioQualityDiagnostics | null;
  transcriptionDiagnostics?: TranscriptionDiagnostics;
  qualityMetrics?: TranscriptionQualityMetrics | null;
  segments?: any[];
  diarization?: any;
  reviewSummary?: string | null;
}

export interface WorkspaceState {
  meetings: any[];
  manualTasks: any[];
  taskState: any;
  taskBoards: any;
  calendarMeta: any;
  vocabulary: string[];
  updatedAt: string;
}
