export interface UserSession {
  user_id: string;
  email: string;
  name?: string;
  workspace_id?: string;
}

export interface WorkspaceMembership {
  id: string;
  user_id: string;
  workspace_id: string;
  member_role: 'owner' | 'admin' | 'member';
}

export interface TranscriptSegment {
  id?: string;
  timestamp: number;
  endTimestamp?: number;
  text: string;
  speakerId?: string | number;
  rawSpeakerLabel?: string;
  speakerName?: string;
}

export interface DiarizationResult {
  speakerCount: number;
  speakerNames: Record<string, string>;
  confidence?: number;
  reviewSummary?: string;
  errorMessage?: string;
  segments: TranscriptSegment[];
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
  qualityLabel?: 'good' | 'fair' | 'poor';
  enhancementRecommended?: boolean;
  enhancementApplied?: boolean;
  enhancementProfile?: 'none' | 'standard' | 'enhanced';
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
  transcriptionProfileUsed?: 'standard' | 'enhanced';
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

export interface TranscriptionStatusPayload {
  recordingId: string;
  pipelineStatus:
    | 'uploading'
    | 'queued'
    | 'processing'
    | 'diarization'
    | 'review'
    | 'done'
    | 'failed';
  enhancementsPending?: boolean;
  postprocessStage?: 'queued' | 'running' | 'done' | 'failed' | '';
  transcriptOutcome?: 'normal' | 'empty';
  emptyReason?:
    | 'no_segments_from_stt'
    | 'segments_removed_by_vad'
    | 'segments_removed_as_hallucinations'
    | 'all_chunks_discarded_as_too_small';
  userMessage?: string;
  pipelineVersion?: string;
  pipelineGitSha?: string;
  pipelineBuildTime?: string;
  audioQuality?: AudioQualityDiagnostics | null;
  transcriptionDiagnostics?: TranscriptionDiagnostics;
  qualityMetrics?: TranscriptionQualityMetrics | null;
  segments: TranscriptSegment[];
  diarization: Partial<DiarizationResult>;
  speakerNames: Record<string, string>;
  speakerCount: number;
  confidence: number;
  reviewSummary: string | null;
  errorMessage: string;
  updatedAt: string;
}

export interface MeetingAsset {
  id: string;
  workspace_id: string;
  meeting_id: string;
  file_path: string;
  content_type: string;
  size_bytes: number;
  transcription_status: string;
  transcript_json?: string;
  diarization_json?: string;
  created_at: string;
  updated_at: string;
}

export interface VoiceProfileSummary {
  id: string;
  speakerName: string;
  userId: string;
  createdAt: string;
  hasEmbedding?: boolean;
  sampleCount?: number;
  threshold?: number;
}

export interface VoiceProfilesListPayload {
  profiles: VoiceProfileSummary[];
}

export interface SpeakerAcousticMetrics {
  speakerId: string;
  speakerName: string;
  sampleDurationSeconds?: number | null;
  f0Hz?: number | null;
  jitterLocal?: number | null;
  shimmerLocalDb?: number | null;
  hnrDb?: number | null;
  formantsHz?: {
    f1?: number | null;
    f2?: number | null;
    f3?: number | null;
    f4?: number | null;
  };
}

export interface SpeakerAcousticMetricsPayload {
  speakers: SpeakerAcousticMetrics[];
}

export interface AiTask {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  owner?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  sourceType?: string;
  status?: string;
}

export interface MeetingTask {
  title: string;
  description?: string;
  owner?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  sourceQuote?: string;
}

export interface MeetingNeedAnswer {
  need: string;
  answer: string;
}

export interface MeetingRisk {
  risk: string;
  severity?: 'high' | 'medium' | 'low';
}

export interface MeetingTension {
  topic?: string;
  between?: string[];
  resolved?: boolean;
}

export interface MeetingQuote {
  quote: string;
  speaker?: string;
  why?: string;
}

export interface MeetingFeedbackCategoryScore {
  key: string;
  label: string;
  score: number;
  observation: string;
  improvementTip: string;
}

export interface MeetingFeedback {
  overallScore: number;
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  perceptionNotes: string[];
  communicationTips: string[];
  nextSteps: string[];
  whatWentWell: string[];
  whatCouldBeBetter: string[];
  categoryScores: MeetingFeedbackCategoryScore[];
}

export interface MeetingAIDebrief {
  meetingTitle?: string;
  summary: string;
  decisions: string[];
  risks: string[];
  followUps: string[];
  actionItems: string[];
  generatedAt: string;
}

export interface MeetingParticipantInsight {
  speaker: string;
  mainTopic?: string;
  stance?: string;
  talkRatio?: number;
  personality?: {
    D?: number;
    I?: number;
    S?: number;
    C?: number;
  };
  needs?: string[];
  concerns?: string[];
  sentimentScore?: number;
  discStyle?: string;
  discDescription?: string;
  communicationStyle?: string;
  decisionStyle?: string;
  stressResponse?: string;
  workingWithTips?: string[];
  meetingRole?: string;
  keyMoment?: string;
}

export interface MeetingAnalysis {
  mode?: string;
  speakerCount?: number;
  speakerLabels?: Record<string, string>;
  summary: string;
  decisions: string[];
  actionItems: string[];
  tasks: MeetingTask[];
  followUps: string[];
  answersToNeeds: MeetingNeedAnswer[];
  suggestedTags: string[];
  meetingType: string;
  energyLevel: string;
  risks: MeetingRisk[];
  blockers: string[];
  participantInsights: MeetingParticipantInsight[];
  tensions: MeetingTension[];
  keyQuotes: MeetingQuote[];
  suggestedAgenda: string[];
  feedback?: MeetingFeedback;
}
