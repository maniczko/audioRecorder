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
  member_role: "owner" | "admin" | "member";
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

export interface TranscriptionStatusPayload {
  recordingId: string;
  pipelineStatus: "queued" | "processing" | "done" | "failed";
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

export interface AiTask {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  owner?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  tags?: string[];
  sourceType?: string;
  status?: string;
}
