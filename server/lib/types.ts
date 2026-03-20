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

export interface TranscriptionResult {
  pipelineStatus?: string;
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
