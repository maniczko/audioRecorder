import './styles/recordings.css';
import React from 'react';
import { useToast } from './shared/Toast';
import Modal from './shared/Modal';
import { formatDateTime } from './lib/storage';
import { RecordingPipelineStatus } from './components/RecordingPipelineStatus';
import { ProgressBar } from './components/ProgressBar';
import './RecordingsTabStyles.css';

import { Input } from './ui/Input';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge from './shared/TagBadge';
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Grid2X2,
  Hourglass,
  List,
  Mic2,
  MoreVertical,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import {
  RECORDING_WORKSPACE_REQUIRED_MESSAGE,
  isWorkspaceMissingErrorMessage,
  type RecordingQueueItem,
  type RecordingQueueMeetingLike,
} from './lib/recordingQueue';

interface RecordingsTabRecording {
  id?: string;
  createdAt?: string;
  duration?: number;
  uploaded?: boolean;
  errorMessage?: string;
  pipelineStatus?: string;
  transcriptionStatus?: string;
  transcriptOutcome?: string;
  processingStartedAt?: string;
  processingEndedAt?: string;
  [key: string]: unknown;
}

interface RecordingsTabMeeting extends RecordingQueueMeetingLike {
  startsAt?: string;
  createdAt?: string;
  durationMinutes?: number;
  speakerCount?: number;
  tags?: string[];
  latestRecordingId?: string;
  isOptimisticImport?: boolean;
  processingStartedAt?: string;
  recordings?: RecordingsTabRecording[];
  owner?: string;
  guests?: string[];
  attendees?: string[];
  analysis?: {
    summary?: unknown;
    decisions?: unknown[];
  };
  [key: string]: unknown;
}

type PendingImportQueueItem = Partial<RecordingQueueItem> & {
  durationMinutes?: number;
  status?: string;
  transcriptOutcome?: string;
};

type RecordingListStatus = 'uploading' | 'uploaded' | 'transcribing' | 'ready' | 'empty' | 'failed';

type RecordingsSortKey =
  'startsAt' | 'title' | 'durationMinutes' | 'speakerCount' | 'status' | 'ai' | 'tags';

function positiveDurationSeconds(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRecordingDurationSeconds(recording: RecordingsTabRecording | null | undefined) {
  if (!recording || typeof recording !== 'object') return 0;
  const audioQuality = recording.audioQuality as { durationSeconds?: unknown } | undefined;
  const diagnostics = recording.transcriptionDiagnostics as
    { durationSeconds?: unknown } | undefined;
  return (
    positiveDurationSeconds(audioQuality?.durationSeconds) ||
    positiveDurationSeconds(diagnostics?.durationSeconds) ||
    positiveDurationSeconds(recording.duration)
  );
}

function getMeetingRecordingDurationSeconds(meeting: Partial<RecordingsTabMeeting>) {
  const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
  if (!recordings.length) return 0;
  const latestRecordingId = String(meeting?.latestRecordingId || '').trim();
  const latestRecording = latestRecordingId
    ? recordings.find(
        (recording) =>
          String(recording?.id || recording?.recordingId || '').trim() === latestRecordingId
      )
    : null;
  return getRecordingDurationSeconds(latestRecording || recordings[0]);
}

function getMeetingDisplayDurationMinutes(meeting: Partial<RecordingsTabMeeting>) {
  const recordingSeconds = getMeetingRecordingDurationSeconds(meeting);
  if (recordingSeconds > 0) {
    return Math.max(1, Math.round(recordingSeconds / 60));
  }
  return Math.max(0, Math.round(Number(meeting?.durationMinutes) || 0));
}

function formatMeetingDuration(meeting: Partial<RecordingsTabMeeting>) {
  const minutes = getMeetingDisplayDurationMinutes(meeting);
  return minutes > 0 ? `${minutes} min` : '—';
}

function formatSpeakerCount(value: unknown) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) {
    return 'Brak mówców';
  }
  if (count === 1) {
    return '1 mówca';
  }
  return `${count} mówców`;
}

function getMeetingSpeakerCount(meeting: Partial<RecordingsTabMeeting>) {
  const directCount = Number(meeting?.speakerCount);
  if (Number.isFinite(directCount) && directCount > 0) {
    return directCount;
  }

  const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
  const recordingCount = recordings.reduce((max, recording) => {
    const count = Number(recording?.speakerCount);
    return Number.isFinite(count) && count > max ? count : max;
  }, 0);

  return recordingCount;
}

function formatPipelineDiagnostics(item) {
  const details: string[] = [];
  const transcriptOutcome = String(item?.transcriptOutcome || '').trim();
  const gitSha = String(item?.pipelineGitSha || '').trim();
  const version = String(item?.pipelineVersion || '').trim();
  const emptyReason = String(item?.emptyReason || '').trim();
  const diagnostics =
    item?.transcriptionDiagnostics && typeof item.transcriptionDiagnostics === 'object'
      ? item.transcriptionDiagnostics
      : null;
  const audioQuality =
    item?.audioQuality && typeof item.audioQuality === 'object' ? item.audioQuality : null;

  if (transcriptOutcome === 'empty') {
    details.push('Pipeline: empty transcript');
  }
  if (emptyReason) {
    details.push(`Reason: ${emptyReason}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `Chunks sent to STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksFailedAtStt)) &&
    Number(diagnostics.chunksFailedAtStt) > 0
  ) {
    details.push(`Chunks failed at STT: ${Number(diagnostics.chunksFailedAtStt)}`);
  }
  if (diagnostics?.lastChunkErrorMessage) {
    details.push(`STT error: ${diagnostics.lastChunkErrorMessage}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksWithText)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `Chunks with text: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (gitSha) {
    details.push(`Build: ${gitSha.slice(0, 7)}`);
  } else if (version) {
    details.push(`Version: ${version}`);
  }
  if (audioQuality?.qualityLabel) {
    details.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }

  return details.join(' · ');
}

function getLatestMeetingRecording(meeting: Partial<RecordingsTabMeeting>) {
  const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
  if (!recordings.length) return null;
  const latestRecordingId = String(meeting?.latestRecordingId || '').trim();
  return latestRecordingId
    ? recordings.find(
        (recording) =>
          String(recording?.id || recording?.recordingId || '').trim() === latestRecordingId
      ) || recordings[0]
    : recordings[0];
}

function getRecordingListStatus(meeting: Partial<RecordingsTabMeeting>): RecordingListStatus {
  const latest = getLatestMeetingRecording(meeting);
  const hasAiSummary = Boolean(
    meeting.analysis &&
    (meeting.analysis.summary ||
      (Array.isArray(meeting.analysis.decisions) && meeting.analysis.decisions.length > 0))
  );

  if (!latest) return hasAiSummary ? 'ready' : 'uploaded';

  const pipelineStatus = String(latest.pipelineStatus || '').trim();
  const transcriptionStatus = String(latest.transcriptionStatus || '').trim();
  const transcriptOutcome = String(latest.transcriptOutcome || '').trim();
  const hasError = Boolean(String(latest.errorMessage || '').trim());

  if (hasError || pipelineStatus === 'failed' || pipelineStatus === 'failed_permanent') {
    return 'failed';
  }
  if (transcriptOutcome === 'empty') {
    return 'empty';
  }
  if (
    hasAiSummary ||
    pipelineStatus === 'done' ||
    transcriptionStatus === 'done' ||
    transcriptionStatus === 'completed' ||
    transcriptOutcome === 'normal'
  ) {
    return 'ready';
  }
  if (['processing', 'diarization', 'review'].includes(pipelineStatus)) {
    return 'transcribing';
  }
  if (pipelineStatus === 'queued' && latest.uploaded) {
    return 'uploaded';
  }
  if (pipelineStatus === 'uploading' || pipelineStatus === 'queued' || latest.uploaded === false) {
    return 'uploading';
  }
  return 'uploaded';
}

function getMeetingAiStatus(m) {
  if (
    m.analysis &&
    (m.analysis.summary || (m.analysis.decisions && m.analysis.decisions.length > 0))
  ) {
    return 'ai';
  }
  if (m.latestRecordingId || (Array.isArray(m.recordings) && m.recordings.length > 0)) {
    const latest = getLatestMeetingRecording(m);
    if (latest?.transcriptOutcome === 'empty') return 'empty';
    if (
      latest?.pipelineStatus === 'failed' ||
      latest?.pipelineStatus === 'failed_permanent' ||
      latest?.errorMessage
    )
      return 'failed';
    if (
      latest?.transcriptionStatus === 'done' ||
      latest?.transcriptionStatus === 'completed' ||
      latest?.transcriptOutcome === 'normal'
    )
      return 'transcript';
    return 'processing';
  }
  return 'none';
}

function getRecordingTableStatus(meeting: Partial<RecordingsTabMeeting>) {
  return getRecordingListStatus(meeting);
}

function RecordingStatusChip({ meeting }: { meeting: Partial<RecordingsTabMeeting> }) {
  const status = getRecordingTableStatus(meeting);
  const meta: Record<
    RecordingListStatus,
    { className: string; label: string; icon: React.ReactNode }
  > = {
    uploading: {
      className: 'uploading',
      label: 'Wgrywanie',
      icon: <Upload size={15} strokeWidth={2.2} />,
    },
    uploaded: {
      className: 'uploaded',
      label: 'Wgrane',
      icon: <Clock size={15} strokeWidth={2.2} />,
    },
    transcribing: {
      className: 'processing',
      label: 'Transkrypcja',
      icon: <Hourglass size={15} strokeWidth={2.2} />,
    },
    ready: {
      className: 'ready',
      label: 'Gotowe',
      icon: <CheckCircle2 size={15} strokeWidth={2.2} />,
    },
    empty: {
      className: 'empty',
      label: 'Brak mowy',
      icon: <Clock size={15} strokeWidth={2.2} />,
    },
    failed: {
      className: 'failed',
      label: 'Błąd',
      icon: <Clock size={15} strokeWidth={2.2} />,
    },
  };
  const current = meta[status];

  return (
    <span className={`recordings-status-chip ${current.className}`}>
      {current.icon}
      {current.label}
    </span>
  );
}

function AiInsightChip({ meeting }: { meeting: Partial<RecordingsTabMeeting> }) {
  const status = getMeetingAiStatus(meeting);
  const isReady = status === 'ai' || status === 'transcript';
  const isFailed = status === 'failed';
  const isEmpty = status === 'empty';

  return (
    <span
      className={`recordings-ai-chip ${
        isReady ? 'ready' : isFailed ? 'failed' : isEmpty ? 'empty' : 'waiting'
      }`}
    >
      {isReady ? (
        <Sparkles size={15} strokeWidth={2.2} />
      ) : isFailed ? (
        <Clock size={15} strokeWidth={2.2} />
      ) : (
        <Hourglass size={15} strokeWidth={2.2} />
      )}
      {isReady ? 'Transkrypcja' : isFailed ? 'Błąd' : isEmpty ? 'Pusto' : 'Oczekuje'}
    </span>
  );
}

function RecordingsStatsBar({ meetings }) {
  const stats = React.useMemo(() => {
    const totalMeetings = meetings.length;
    const totalMinutes = meetings.reduce((sum, m) => sum + getMeetingDisplayDurationMinutes(m), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const totalTime =
      hours > 0 ? `${hours}h ${minutes ? `${minutes}m` : ''}`.trim() : `${minutes}m`;
    const participantSet = new Set();
    meetings.forEach((m) => {
      if (m.owner) participantSet.add(m.owner.trim());
      (m.attendees || m.guests || m.participants || []).forEach((p) => {
        if (p && p.trim()) participantSet.add(p.trim());
      });
    });
    const withAi = meetings.filter((m) => {
      if (getMeetingAiStatus(m) === 'ai') return true;
      const recordings = Array.isArray(m.recordings) ? m.recordings : [];
      return recordings.some((recording) => {
        const hasCompletedTranscript =
          recording?.transcriptionStatus === 'completed' &&
          Array.isArray(recording?.transcript) &&
          recording.transcript.length > 0;
        return Boolean(recording?.analysis || hasCompletedTranscript);
      });
    }).length;
    return { totalMeetings, totalTime, participants: participantSet.size, withAi };
  }, [meetings]);

  if (stats.totalMeetings === 0) return null;

  const items = [
    {
      icon: <Mic2 size={28} />,
      value: stats.totalMeetings,
      label: 'spotka\u0144',
      caption: 'w tym miesi\u0105cu',
    },
    {
      icon: <Clock size={28} />,
      value: stats.totalTime,
      label: '\u0142\u0105cznie',
      caption: 'czas trwania',
    },
    {
      icon: <Users size={28} />,
      value: stats.participants,
      label: 'uczestnik\u00f3w',
      caption: 'unikalnych',
    },
    {
      icon: <Brain size={28} />,
      value: stats.withAi,
      label: 'z analiz\u0105 AI',
      caption: 'gotowych',
    },
  ];

  return (
    <div className="recordings-reference-stats" aria-label="Podsumowanie nagra\u0144">
      {items.map((item, i) => (
        <div key={i} className="recordings-reference-stat">
          <span className="recordings-reference-stat-icon">{item.icon}</span>
          <span className="recordings-reference-stat-value">{item.value}</span>
          <span className="recordings-reference-stat-label">{item.label}</span>
          <span className="recordings-reference-stat-caption">{item.caption}</span>
        </div>
      ))}
    </div>
  );
}
function getLatestRecording(selectedMeeting) {
  if (!selectedMeeting) return null;
  const recordings = Array.isArray(selectedMeeting.recordings) ? selectedMeeting.recordings : [];
  return (
    recordings.find((recording) => recording.id === selectedMeeting.latestRecordingId) ||
    recordings[0] ||
    null
  );
}

const PENDING_IMPORT_STALE_MS = 5 * 60 * 1000;
const REMOTE_RECORDING_MISSING_MESSAGE =
  'Nagranie nie jest juz dostepne na serwerze. Odswiez dane albo zaimportuj plik ponownie.';

function normalizePipelineMessage(value: unknown) {
  const message = String(value || '').trim();
  if (!message) return '';
  const separatorIndex = message.indexOf(':');
  if (separatorIndex > -1 && message.toLowerCase().includes('w kolejce')) {
    return message.slice(separatorIndex + 1).trim();
  }
  return message;
}

function getPendingImportDisplayState(
  item: PendingImportQueueItem,
  activeQueueItem: PendingImportQueueItem | null | undefined,
  recordingMessage: string
) {
  const itemStatus = String(item?.status || '').toLowerCase();
  const activeStatus = String(activeQueueItem?.status || '').toLowerCase();
  const isSameActiveRecording =
    Boolean(activeQueueItem?.recordingId) && activeQueueItem?.recordingId === item?.recordingId;
  const messages = [
    item?.errorMessage,
    item?.lastErrorMessage,
    isSameActiveRecording ? activeQueueItem?.errorMessage : '',
    isSameActiveRecording ? activeQueueItem?.lastErrorMessage : '',
    isSameActiveRecording ? recordingMessage : '',
  ];
  const normalizedMessages = messages.map(normalizePipelineMessage).filter(Boolean);
  const combinedMessage = normalizedMessages.join(' ').toLowerCase();
  const isWorkspaceMissing = normalizedMessages.some(isWorkspaceMissingErrorMessage);
  const isRemoteMissing =
    combinedMessage.includes('nagranie nie jest juz dostepne') ||
    String(item?.errorCode || activeQueueItem?.errorCode || '').toLowerCase() ===
      'audio_unavailable';
  const isPermanent =
    itemStatus === 'failed_permanent' ||
    activeStatus === 'failed_permanent' ||
    isRemoteMissing ||
    isWorkspaceMissing;

  if (!isPermanent) {
    return {
      status: item?.status || 'queued',
      errorMessage: item?.errorMessage || item?.lastErrorMessage || '',
      isPermanent: false,
    };
  }

  const remoteMissingMessage = normalizedMessages.find((message) =>
    message.toLowerCase().includes('nagranie nie jest juz dostepne')
  );

  return {
    status: 'failed_permanent',
    errorMessage:
      (isWorkspaceMissing ? RECORDING_WORKSPACE_REQUIRED_MESSAGE : '') ||
      remoteMissingMessage ||
      REMOTE_RECORDING_MISSING_MESSAGE,
    isPermanent: true,
  };
}

function getQueueItemLastActivityMs(item: PendingImportQueueItem) {
  const candidates = [item.updatedAt, item.processingStartedAt, item.createdAt]
    .map((value) => new Date(String(value || '')).valueOf())
    .filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.max(...candidates) : 0;
}

function isStalePendingImport(item: PendingImportQueueItem, nowMs = Date.now()) {
  const status = String(item?.status || '').toLowerCase();
  if (!['queued', 'uploading', 'processing'].includes(status)) return false;
  const lastActivityMs = getQueueItemLastActivityMs(item);
  if (!lastActivityMs) return false;
  return nowMs - lastActivityMs >= PENDING_IMPORT_STALE_MS;
}

function getPendingImportRetryLabel(item: PendingImportQueueItem) {
  const status = String(item?.status || '').toLowerCase();
  if (status === 'failed') return 'Spróbuj ponownie';
  if (isStalePendingImport(item)) return 'Odśwież status';
  return '';
}

function buildOptimisticMeetingFromQueueItem(item: PendingImportQueueItem): RecordingsTabMeeting {
  const snapshot =
    item?.meetingSnapshot && typeof item.meetingSnapshot === 'object'
      ? (item.meetingSnapshot as RecordingsTabMeeting)
      : null;
  return {
    id: item.meetingId || item.recordingId,
    workspaceId: snapshot?.workspaceId || item.workspaceId || '',
    title: item.meetingTitle || snapshot?.title || 'Nowy import',
    startsAt: item.createdAt || '',
    createdAt: item.createdAt || '',
    durationMinutes: Number(snapshot?.durationMinutes) || Number(item.durationMinutes) || 0,
    speakerCount: 0,
    tags: [],
    latestRecordingId: item.recordingId,
    isOptimisticImport: true,
    processingStartedAt: item.processingStartedAt || undefined,
    recordings: [
      {
        id: item.recordingId,
        createdAt: item.createdAt || '',
        duration: Number(item.duration) || 0,
        uploaded: Boolean(item.uploaded),
        errorMessage: item.errorMessage || item.lastErrorMessage || '',
        pipelineStatus: item.status || 'queued',
        transcriptionStatus: item.status || 'queued',
        transcriptOutcome: item.transcriptOutcome || '',
        processingStartedAt: item.processingStartedAt || undefined,
        processingEndedAt: item.status === 'done' ? new Date().toISOString() : undefined,
      },
    ],
  };
}

function collectRecordingIdsForMeeting(
  meeting: Partial<RecordingsTabMeeting> | null | undefined,
  queue: PendingImportQueueItem[] = []
) {
  const ids = new Set<string>();
  const meetingId = String(meeting?.id || '').trim();

  if (meeting?.latestRecordingId) {
    ids.add(String(meeting.latestRecordingId));
  }

  if (Array.isArray(meeting?.recordings)) {
    meeting.recordings.forEach((recording) => {
      const id = String(recording?.id || recording?.recordingId || '').trim();
      if (id) ids.add(id);
    });
  }

  queue.forEach((item) => {
    const itemMeetingId = String(item?.meetingId || '').trim();
    if (meetingId && itemMeetingId === meetingId && item?.recordingId) {
      ids.add(String(item.recordingId));
    }
  });

  return [...ids];
}

function mergeMeetingsWithPendingImports(
  userMeetings: RecordingsTabMeeting[] = [],
  recordingQueue: PendingImportQueueItem[] = [],
  selectedMeeting: RecordingsTabMeeting | null = null
): RecordingsTabMeeting[] {
  const meetings = Array.isArray(userMeetings) ? [...userMeetings] : [];
  const selectedId = String(selectedMeeting?.id || '').trim();
  if (selectedId && hasMeetingRecordingEvidence(selectedMeeting)) {
    const existingIndex = meetings.findIndex((meeting) => String(meeting?.id || '') === selectedId);
    if (existingIndex === -1) {
      meetings.unshift(selectedMeeting as RecordingsTabMeeting);
    } else if (isRicherMeetingSnapshot(selectedMeeting, meetings[existingIndex])) {
      meetings[existingIndex] = selectedMeeting as RecordingsTabMeeting;
    }
  }

  const queue = Array.isArray(recordingQueue) ? recordingQueue : [];
  const knownMeetingIds = new Set(meetings.map((meeting) => meeting?.id).filter(Boolean));
  const optimisticImports = queue
    .filter((item) => item?.meetingId && !knownMeetingIds.has(item.meetingId))
    .map((item) => buildOptimisticMeetingFromQueueItem(item));

  return [...optimisticImports, ...meetings];
}

function hasMeetingRecordingEvidence(meeting: Partial<RecordingsTabMeeting> | null | undefined) {
  if (!meeting) return false;
  if (String(meeting.latestRecordingId || '').trim()) return true;
  return Array.isArray(meeting.recordings) && meeting.recordings.length > 0;
}

function meetingRecordingRichness(meeting: Partial<RecordingsTabMeeting> | null | undefined) {
  const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
  const transcriptSegments = recordings.reduce((sum, recording) => {
    return sum + (Array.isArray(recording?.transcript) ? recording.transcript.length : 0);
  }, 0);
  const durationSeconds = recordings.reduce(
    (sum, recording) => sum + getRecordingDurationSeconds(recording),
    0
  );
  const latestUpdatedAt = Math.max(
    0,
    ...recordings.map((recording) =>
      new Date(String(recording?.updatedAt || recording?.createdAt || '')).valueOf()
    ),
    new Date(String(meeting?.updatedAt || meeting?.createdAt || '')).valueOf()
  );

  return {
    recordingCount: recordings.length,
    transcriptSegments,
    durationSeconds,
    latestUpdatedAt: Number.isFinite(latestUpdatedAt) ? latestUpdatedAt : 0,
  };
}

function isRicherMeetingSnapshot(
  candidate: Partial<RecordingsTabMeeting> | null | undefined,
  current: Partial<RecordingsTabMeeting> | null | undefined
) {
  const next = meetingRecordingRichness(candidate);
  const previous = meetingRecordingRichness(current);
  if (next.recordingCount !== previous.recordingCount) {
    return next.recordingCount > previous.recordingCount;
  }
  if (next.transcriptSegments !== previous.transcriptSegments) {
    return next.transcriptSegments > previous.transcriptSegments;
  }
  if (next.durationSeconds !== previous.durationSeconds) {
    return next.durationSeconds > previous.durationSeconds;
  }
  return next.latestUpdatedAt > previous.latestUpdatedAt;
}

function UnifiedLibrary({
  userMeetings,
  recordingQueue,
  selectedMeeting,
  selectMeeting,
  setActiveTab,
  onDeleteMeeting,
  onUploadClick,
  isUploading,
  uploadingFileName,
  uploadProgress,
  uploadErrorMessage,
  fileInputRef,
  handleFileUpload,
}) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState<string[]>([]);
  const [participantFilter, setParticipantFilter] = React.useState<string[]>([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const filterDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showFilters) return;
    function onOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target))
        setShowFilters(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showFilters]);

  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    const meetingsWithImports = mergeMeetingsWithPendingImports(
      userMeetings,
      recordingQueue,
      selectedMeeting
    );
    meetingsWithImports.forEach((m) => {
      if (Array.isArray(m.tags)) {
        m.tags.forEach((t) => {
          if (t && t.trim()) tags.add(t.trim());
        });
      }
    });
    return Array.from(tags).sort();
  }, [recordingQueue, selectedMeeting, userMeetings]);

  const allParticipants = React.useMemo(() => {
    const parts = new Set<string>();
    const meetingsWithImports = mergeMeetingsWithPendingImports(
      userMeetings,
      recordingQueue,
      selectedMeeting
    );
    meetingsWithImports.forEach((m) => {
      if (m.owner) parts.add(m.owner.trim());
      if (Array.isArray(m.guests)) {
        m.guests.forEach((g) => {
          if (g && g.trim()) parts.add(g.trim());
        });
      }
    });
    return Array.from(parts).sort();
  }, [recordingQueue, selectedMeeting, userMeetings]);

  const [sortConfig, setSortConfig] = React.useState<{
    key: RecordingsSortKey;
    direction: 'asc' | 'desc';
  }>({ key: 'startsAt', direction: 'desc' });
  const [meetingToDelete, setMeetingToDelete] = React.useState<{
    id: string;
    title: string;
    recordingIds: string[];
  } | null>(null);

  const handleSort = (key: RecordingsSortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortIndicator = (key: RecordingsSortKey) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const sortButtonLabel = (label: string, key: RecordingsSortKey) => {
    const direction =
      sortConfig.key !== key
        ? 'brak aktywnego sortowania'
        : sortConfig.direction === 'asc'
          ? 'rosnaco'
          : 'malejaco';
    return `Sortuj nagrania: ${label}, ${direction}`;
  };

  const ariaSort = (key: RecordingsSortKey) => {
    if (sortConfig.key !== key) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const sortedAndFiltered = React.useMemo(() => {
    const meetingsWithImports = mergeMeetingsWithPendingImports(
      userMeetings,
      recordingQueue,
      selectedMeeting
    );
    return [...meetingsWithImports]
      .filter((m) => {
        if (dateFilter) {
          const d = m.startsAt || m.createdAt;
          if (!d || !d.startsWith(dateFilter)) return false;
        }
        if (tagFilter && tagFilter.length > 0) {
          if (!Array.isArray(m.tags)) return false;
          const mt = m.tags.map((t) => t.trim());
          if (!tagFilter.every((tf) => mt.includes(tf))) return false;
        }
        if (participantFilter && participantFilter.length > 0) {
          const mParts = [m.owner, ...(m.guests || [])]
            .filter((participant): participant is string => Boolean(participant))
            .map((participant) => participant.trim());
          if (!participantFilter.every((pf) => mParts.includes(pf))) return false;
        }
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const titleMatch = (m.title || '').toLowerCase().includes(searchLower);
          const ownerMatch = (m.owner || '').toLowerCase().includes(searchLower);
          const guestMatch = (m.guests || []).some((g) => g.toLowerCase().includes(searchLower));
          if (!titleMatch && !ownerMatch && !guestMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'title':
            aVal = (a.title || '').toLowerCase();
            bVal = (b.title || '').toLowerCase();
            break;
          case 'durationMinutes':
            aVal = getMeetingDisplayDurationMinutes(a);
            bVal = getMeetingDisplayDurationMinutes(b);
            break;
          case 'speakerCount':
            aVal = getMeetingSpeakerCount(a);
            bVal = getMeetingSpeakerCount(b);
            break;
          case 'status':
            aVal = getRecordingTableStatus(a);
            bVal = getRecordingTableStatus(b);
            break;
          case 'ai':
            aVal = getMeetingAiStatus(a);
            bVal = getMeetingAiStatus(b);
            break;
          case 'tags':
            aVal = Array.isArray(a.tags) ? a.tags.join(',').toLowerCase() : '';
            bVal = Array.isArray(b.tags) ? b.tags.join(',').toLowerCase() : '';
            break;
          case 'startsAt':
          default:
            aVal = new Date(a.startsAt || a.createdAt || '').valueOf();
            bVal = new Date(b.startsAt || b.createdAt || '').valueOf();
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    recordingQueue,
    userMeetings,
    searchQuery,
    dateFilter,
    tagFilter,
    participantFilter,
    selectedMeeting,
    sortConfig,
  ]);

  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef?.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  const visibleMeetings = sortedAndFiltered.slice(0, 10);
  const selectedVisibleCount = visibleMeetings.filter((m) => m.id === selectedMeeting?.id).length;
  const allVisibleSelected =
    visibleMeetings.length > 0 && selectedVisibleCount === visibleMeetings.length;
  const setHeaderCheckboxState = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (node) {
        node.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
      }
    },
    [allVisibleSelected, selectedVisibleCount]
  );

  return (
    <section
      className="panel meetings-library recordings-library-panel"
      data-clarity-mask="true"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 'var(--inline-z-index-overlay)',
            background: 'rgba(117, 214, 196, 0.08)',
            border: '3px dashed var(--accent)',
            borderRadius: 'var(--inline-radius-2xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--inline-gap-3)',
              color: 'var(--accent)',
            }}
          >
            <Upload size={40} />
            <span
              style={{
                fontSize: 'var(--inline-font-2xl)',
                fontWeight: 'var(--inline-font-weight-semibold)',
              }}
            >
              Upuść plik audio/video tutaj
            </span>
          </div>
        </div>
      )}
      <div className="recordings-reference-header">
        <div className="ui-page-header__copy recordings-library-heading">
          <h2 className="ui-page-header__title" style={{ marginTop: 0 }}>
            {'Baza nagra\u0144'}
          </h2>
          <p className="recordings-reference-subtitle">
            {
              'Przegl\u0105daj, wyszukuj i analizuj nagrania spotka\u0144. Wgrywaj pliki, \u015Bled\u017A status przetwarzania i wracaj do rozm\u00F3w.'
            }
          </p>
        </div>

        <div className="recordings-reference-actions">
          {isUploading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minWidth: 160,
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-base)',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={uploadingFileName}
                >
                  {uploadingFileName || 'Wgrywanie...'}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--muted)',
                    whiteSpace: 'nowrap',
                    marginLeft: 'auto',
                  }}
                >
                  {uploadProgress}%
                </span>
              </div>
              <ProgressBar value={uploadProgress} variant="upload" />
            </div>
          ) : (
            <button
              type="button"
              className="primary-button recordings-upload-primary"
              onClick={onUploadClick}
              style={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.82rem',
                padding: '0 12px',
              }}
            >
              <Upload size={14} /> Wgraj nagranie
            </button>
          )}
          <input
            data-testid="recordings-file-input"
            type="file"
            ref={fileInputRef}
            accept="audio/*,video/*"
            className="recordings-hidden-input"
            onChange={handleFileUpload}
          />

          <div
            className="recordings-tab-filters-col"
            ref={filterDropdownRef}
            style={{ position: 'relative' }}
          >
            <button
              type="button"
              className="secondary-button recordings-filter-button"
              onClick={() => setShowFilters(!showFilters)}
              style={{
                height: 36,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                position: 'relative',
                fontSize: '0.82rem',
                padding: '0 12px',
              }}
            >
              <Filter size={14} /> Filtry
              {(dateFilter || tagFilter.length > 0 || participantFilter.length > 0) && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 10,
                    height: 10,
                    background: 'var(--accent)',
                    borderRadius: '50%',
                  }}
                />
              )}
            </button>

            {showFilters && (
              <div
                className="recordings-filters-dropdown"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  left: 0,
                  zIndex: 9999,
                  background: '#101c1a',
                  border: '1px solid rgba(117, 214, 196, 0.2)',
                  borderRadius: 12,
                  padding: 24,
                  width: 340,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Filtry</h3>
                  {(dateFilter || tagFilter.length > 0 || participantFilter.length > 0) && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setDateFilter('');
                        setTagFilter([]);
                        setParticipantFilter([]);
                      }}
                      style={{
                        padding: '4px 8px',
                        height: 'auto',
                        color: 'var(--text-3)',
                        fontSize: '0.8rem',
                      }}
                    >
                      Wyczyść wszystko
                    </button>
                  )}
                </div>
                <div className="filter-group">
                  <label
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: 8,
                      display: 'block',
                    }}
                  >
                    Data Spotkania
                  </label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface-1)' }}
                  />
                </div>
                <div className="filter-group">
                  <label
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: 8,
                      display: 'block',
                    }}
                  >
                    Tagi
                  </label>
                  <TagInput
                    tags={tagFilter}
                    suggestions={allTags}
                    onChange={setTagFilter}
                    placeholder="Filtruj wg tagów..."
                  />
                </div>
                <div className="filter-group">
                  <label
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: 8,
                      display: 'block',
                    }}
                  >
                    Uczestnicy
                  </label>
                  <TagInput
                    tags={participantFilter}
                    suggestions={allParticipants}
                    onChange={setParticipantFilter}
                    placeholder="Dodaj uczestników..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="recordings-tab-search-col" style={{ flex: 1 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-3)',
                }}
              />
              <Input
                type="search"
                placeholder="Szukaj nagrania, hosta lub tytułu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: 36,
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  height: 36,
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <RecordingsStatsBar
        meetings={mergeMeetingsWithPendingImports(userMeetings, recordingQueue, selectedMeeting)}
      />
      {uploadErrorMessage ? (
        <div
          role="alert"
          className="recordings-upload-alert"
          style={{
            margin: '12px 0',
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid rgba(248, 113, 113, 0.32)',
            background: 'rgba(127, 29, 29, 0.18)',
            color: '#fecaca',
            fontSize: '0.88rem',
            lineHeight: 1.5,
          }}
        >
          {uploadErrorMessage}
        </div>
      ) : null}
      <div className="studio-recordings-table-wrap">
        {sortedAndFiltered.length ? (
          <>
            <div className="recordings-reference-tablebar">
              <strong className="recordings-reference-count">
                {sortedAndFiltered.length} {'nagra\u0144'}
              </strong>
              <div className="recordings-reference-tablebar-actions">
                <div
                  className="recordings-reference-view-toggle"
                  aria-label={'Widok listy nagra\u0144'}
                >
                  <button type="button" className="active" aria-label="Widok listy">
                    <List size={16} strokeWidth={2.2} />
                  </button>
                  <button type="button" aria-label="Widok siatki">
                    <Grid2X2 size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
            <table className="studio-recordings-table">
              <thead>
                <tr>
                  <th className="recordings-reference-select-col">
                    <input
                      type="checkbox"
                      className="recordings-reference-select"
                      aria-label="Zaznacz wszystkie nagrania"
                      aria-checked={
                        selectedVisibleCount > 0 && !allVisibleSelected
                          ? 'mixed'
                          : allVisibleSelected
                      }
                      checked={allVisibleSelected}
                      ref={setHeaderCheckboxState}
                      readOnly
                      onClick={(event) => event.stopPropagation()}
                    />
                  </th>
                  <th
                    onClick={() => handleSort('title')}
                    className="sortable-th"
                    aria-sort={ariaSort('title')}
                    style={{ width: '25%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Spotkanie', 'title')}
                      data-action-id="recordings-sort-title"
                    >
                      Spotkanie <span>{sortIndicator('title')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('startsAt')}
                    className="sortable-th"
                    aria-sort={ariaSort('startsAt')}
                    style={{ width: '16%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Data i godzina', 'startsAt')}
                      data-action-id="recordings-sort-starts-at"
                    >
                      Data i godzina <span>{sortIndicator('startsAt')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('durationMinutes')}
                    className="sortable-th"
                    aria-sort={ariaSort('durationMinutes')}
                    style={{ width: '9%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Czas', 'durationMinutes')}
                      data-action-id="recordings-sort-duration"
                    >
                      Czas <span>{sortIndicator('durationMinutes')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('speakerCount')}
                    className="sortable-th"
                    aria-sort={ariaSort('speakerCount')}
                    style={{ width: '10%' }}
                    title="Liczba mówców"
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Mowcy', 'speakerCount')}
                      data-action-id="recordings-sort-speakers"
                    >
                      Mówcy <span>{sortIndicator('speakerCount')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="sortable-th"
                    aria-sort={ariaSort('status')}
                    style={{ width: '12%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Status', 'status')}
                      data-action-id="recordings-sort-status"
                    >
                      Status <span>{sortIndicator('status')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('ai')}
                    className="sortable-th"
                    aria-sort={ariaSort('ai')}
                    style={{ width: '12%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('AI', 'ai')}
                      data-action-id="recordings-sort-ai"
                    >
                      AI <span>{sortIndicator('ai')}</span>
                    </button>
                  </th>
                  <th
                    onClick={() => handleSort('tags')}
                    className="sortable-th"
                    aria-sort={ariaSort('tags')}
                    style={{ width: '14%' }}
                  >
                    <button
                      type="button"
                      className="recordings-sort-header"
                      aria-label={sortButtonLabel('Tagi', 'tags')}
                      data-action-id="recordings-sort-tags"
                    >
                      Tagi <span>{sortIndicator('tags')}</span>
                    </button>
                  </th>
                  <th className="recordings-library-actions-col" style={{ width: '5%' }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleMeetings.map((m) => (
                  <tr
                    key={m.id}
                    className={m.id === selectedMeeting?.id ? 'active' : ''}
                    tabIndex={0}
                    onClick={() => {
                      selectMeeting(m);
                      setActiveTab('studio');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectMeeting(m);
                        setActiveTab('studio');
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = e.currentTarget.nextElementSibling as HTMLElement;
                        if (next) next.focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = e.currentTarget.previousElementSibling as HTMLElement;
                        if (prev) prev.focus();
                      }
                    }}
                  >
                    <td className="recordings-reference-row-select">
                      <input
                        type="checkbox"
                        className="recordings-reference-check"
                        aria-label={`Zaznacz nagranie ${m.title || ''}`}
                        checked={m.id === selectedMeeting?.id}
                        readOnly
                        onClick={(event) => {
                          event.stopPropagation();
                          selectMeeting(m);
                        }}
                      />
                    </td>
                    <td className="recordings-library-meeting recordings-reference-title-cell">
                      <span className="recordings-reference-title-icon" aria-hidden="true">
                        <CalendarDays size={16} strokeWidth={2.2} />
                      </span>
                      <strong
                        className="recordings-clickable-title"
                        title="Kliknij, aby otworzyć spotkanie"
                      >
                        {m.title}
                      </strong>
                    </td>
                    <td>{formatDateTime(m.startsAt || m.createdAt)}</td>
                    <td>{formatMeetingDuration(m)}</td>
                    <td>
                      <span className="recordings-reference-speakers-pill">
                        <Users size={14} strokeWidth={2.2} />
                        {formatSpeakerCount(getMeetingSpeakerCount(m))}
                      </span>
                    </td>
                    <td>
                      <RecordingStatusChip meeting={m} />
                    </td>
                    <td>
                      <AiInsightChip meeting={m} />
                    </td>
                    <td>
                      <div
                        className="recordings-library-tags"
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minWidth: 0 }}
                      >
                        {(Array.isArray(m.tags) ? m.tags : []).map((t, idx) => {
                          if (!t.trim()) return null;
                          return <TagBadge key={idx} tag={t.trim()} />;
                        })}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        title="Usuń spotkanie i nagrania"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMeetingToDelete({
                            id: String(m.id || ''),
                            title: String(m.title || ''),
                            recordingIds: collectRecordingIdsForMeeting(m, recordingQueue),
                          });
                        }}
                        className="recordings-library-delete-btn"
                      >
                        <MoreVertical size={18} strokeWidth={2.4} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="recordings-reference-footer">
              <div className="recordings-reference-footer-meta">
                <span>
                  Wyświetlanie 1-{Math.min(sortedAndFiltered.length, 10)} z{' '}
                  {sortedAndFiltered.length}
                </span>
                <button type="button" className="recordings-reference-refresh">
                  <RefreshCw size={16} strokeWidth={2.2} />
                  Odśwież
                </button>
              </div>
              <div className="recordings-reference-pagination">
                <button type="button" aria-label="Poprzednia strona">
                  <ChevronLeft size={16} strokeWidth={2.2} />
                </button>
                <button type="button" className="active">
                  1
                </button>
                {sortedAndFiltered.length > 10 ? <button type="button">2</button> : null}
                <button type="button" aria-label="Następna strona">
                  <ChevronRight size={16} strokeWidth={2.2} />
                </button>
              </div>
              <button
                type="button"
                className="secondary-button small recordings-reference-page-size"
              >
                10 na stronę
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
            </div>
          </>
        ) : (
          <EmptyState
            mascotContext="recordings"
            title="Brak nagrań"
            message="Brak spotkań spełniających kryteria wyszukiwania."
          />
        )}
      </div>

      {meetingToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setMeetingToDelete(null)}
          title="Usuwanie spotkania"
          size="sm"
          danger
        >
          <p>
            Czy na pewno chcesz usunąć spotkanie <strong>"{meetingToDelete.title}"</strong> oraz
            wszystkie powiązane nagrania z archiwalnej bazy wektorowej? Zmian tych nie można cofnąć.
          </p>
          <div className="recordings-delete-modal-actions">
            <button type="button" className="ghost-button" onClick={() => setMeetingToDelete(null)}>
              Anuluj
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={async () => {
                const target = meetingToDelete;
                setMeetingToDelete(null);
                if (onDeleteMeeting) {
                  try {
                    await onDeleteMeeting(target.id, { recordingIds: target.recordingIds });
                    toast.success('Pomyślnie usunięto spotkanie i powiązane nagrania.');
                  } catch (_) {
                    toast.error('Nie udało się usunąć spotkania. Spróbuj ponownie.');
                  }
                }
              }}
            >
              Usuń powiązane nagrania do spotkania
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export default function RecordingsTab(props) {
  const {
    userMeetings,
    selectedMeeting,
    selectMeeting,
    setActiveTab,
    onCreateMeeting,
    queueRecording,
    recordingQueue = [],
    activeQueueItem = null,
    analysisStatus = 'idle',
    recordingMessage = '',
    pipelineProgressPercent = 0,
    pipelineStageLabel = '',
    retryRecordingQueueItem,
    retryStoredRecording,
    deleteRecordingAndMeeting,
  } = props;

  const toast = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadingFileName, setUploadingFileName] = React.useState('');
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadErrorMessage, setUploadErrorMessage] = React.useState('');
  const [retryingStoredRecordingId, setRetryingStoredRecordingId] = React.useState('');
  const [retryStoredRecordingError, setRetryStoredRecordingError] = React.useState('');
  const [deletedMeetingIds, setDeletedMeetingIds] = React.useState<Set<string>>(() => new Set());
  const [deletedRecordingIds, setDeletedRecordingIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const mainFileInputRef = React.useRef<HTMLInputElement>(null);
  const filteredUserMeetings = React.useMemo(
    () =>
      (Array.isArray(userMeetings) ? userMeetings : []).filter(
        (meeting) => !deletedMeetingIds.has(String(meeting?.id || ''))
      ),
    [deletedMeetingIds, userMeetings]
  );
  const filteredRecordingQueue = React.useMemo(
    () =>
      (Array.isArray(recordingQueue) ? recordingQueue : []).filter((item) => {
        if (deletedRecordingIds.has(String(item?.recordingId || ''))) {
          return false;
        }
        return !deletedMeetingIds.has(String(item?.meetingId || ''));
      }),
    [deletedMeetingIds, deletedRecordingIds, recordingQueue]
  );
  const handleDeleteMeeting = React.useCallback(
    async (meetingId: string, options: { recordingIds?: string[] } = {}) => {
      const recordingIds = collectRecordingIdsForMeeting(
        (Array.isArray(userMeetings) ? userMeetings : []).find(
          (meeting) => String(meeting?.id || '') === String(meetingId || '')
        ) || { id: meetingId },
        Array.isArray(recordingQueue) ? recordingQueue : []
      );
      const mergedRecordingIds = [...new Set([...recordingIds, ...(options.recordingIds || [])])];
      const normalizedMeetingId = String(meetingId || '');

      setDeletedMeetingIds((previous) => new Set([...previous, normalizedMeetingId]));
      setDeletedRecordingIds((previous) => new Set([...previous, ...mergedRecordingIds]));

      try {
        await deleteRecordingAndMeeting?.(meetingId, { recordingIds: mergedRecordingIds });
      } catch (error) {
        setDeletedMeetingIds((previous) => {
          const next = new Set(previous);
          next.delete(normalizedMeetingId);
          return next;
        });
        setDeletedRecordingIds((previous) => {
          const next = new Set(previous);
          mergedRecordingIds.forEach((recordingId) => next.delete(recordingId));
          return next;
        });
        throw error;
      }
    },
    [deleteRecordingAndMeeting, recordingQueue, userMeetings]
  );
  const showPipelineStatus =
    Boolean(recordingMessage) ||
    ['queued', 'uploading', 'processing', 'diarization', 'review', 'failed', 'done'].includes(
      String(analysisStatus || '')
    );
  const pendingImports = React.useMemo(
    () =>
      [...filteredRecordingQueue].sort(
        (left, right) =>
          new Date(right.createdAt || 0).valueOf() - new Date(left.createdAt || 0).valueOf()
      ),
    [filteredRecordingQueue]
  );
  const activeQueueItemShownInPendingList = React.useMemo(
    () =>
      Boolean(
        activeQueueItem?.recordingId &&
        pendingImports.some((item) => item?.recordingId === activeQueueItem.recordingId)
      ),
    [activeQueueItem?.recordingId, pendingImports]
  );
  const showStandalonePipelineStatus = showPipelineStatus && !pendingImports.length;
  const activeDiagnostics = React.useMemo(
    () => formatPipelineDiagnostics(activeQueueItem),
    [activeQueueItem]
  );
  const latestSelectedRecording = React.useMemo(
    () => getLatestRecording(selectedMeeting),
    [selectedMeeting]
  );
  const latestSelectedRecordingId = String(
    latestSelectedRecording?.id || latestSelectedRecording?.recordingId || ''
  );
  const isRetryingLatestSelectedRecording =
    Boolean(latestSelectedRecordingId) && retryingStoredRecordingId === latestSelectedRecordingId;
  const selectedMeetingHasEmptyTranscript = latestSelectedRecording?.transcriptOutcome === 'empty';
  const selectedMeetingEmptyDiagnostics = React.useMemo(() => {
    if (!selectedMeetingHasEmptyTranscript) return '';
    const diagnostics = latestSelectedRecording?.transcriptionDiagnostics || {};
    const parts: string[] = [];
    if (latestSelectedRecording?.emptyReason) {
      parts.push(`Powod: ${latestSelectedRecording.emptyReason}`);
    }
    if (
      Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(
        `Chunki wyslane do STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`
      );
    }
    if (
      Number.isFinite(Number(diagnostics.chunksWithText)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(
        `Chunki z tekstem: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`
      );
    }
    if (latestSelectedRecording?.pipelineGitSha) {
      parts.push(`Build: ${String(latestSelectedRecording.pipelineGitSha).slice(0, 7)}`);
    }
    if (latestSelectedRecording?.audioQuality?.qualityLabel) {
      parts.push(`Jakosc audio: ${latestSelectedRecording.audioQuality.qualityLabel}`);
    }
    return parts.join(' · ');
  }, [latestSelectedRecording, selectedMeetingHasEmptyTranscript]);

  const handleRetryStoredRecording = React.useCallback(
    async (meeting, recording) => {
      if (!retryStoredRecording || !meeting || !recording) return;
      const recordingId = String(recording?.id || recording?.recordingId || '');
      if (recordingId && retryingStoredRecordingId === recordingId) return;

      setRetryingStoredRecordingId(recordingId);
      setRetryStoredRecordingError('');

      try {
        await Promise.resolve(retryStoredRecording(meeting, recording));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Nie udalo sie ponowic transkrypcji. Sprobuj jeszcze raz.';
        setRetryStoredRecordingError(message);
        toast.error(message);
      } finally {
        setRetryingStoredRecordingId('');
      }
    },
    [retryStoredRecording, retryingStoredRecordingId, toast]
  );

  const handleMainFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      toast.error('Rozmiar pliku przekracza limit 200MB.');
      if (e.target) e.target.value = '';
      return;
    }

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      if (onCreateMeeting && queueRecording) {
        setIsUploading(true);
        setUploadingFileName(file.name);
        setUploadProgress(5);
        setUploadErrorMessage('');

        let progress = 5;
        progressInterval = setInterval(() => {
          progress += Math.floor(Math.random() * 15) + 5;
          if (progress > 90) progress = 90;
          setUploadProgress(progress);
        }, 300);

        const newMeeting = await onCreateMeeting({
          title: `Import: ${file.name.replace(/\.[^/.]+$/, '')}`,
          context: 'Zaimportowane nagranie audio z pliku.',
          startsAt: new Date().toISOString(),
        });

        if (!newMeeting?.id) {
          throw new Error('Nie udało się utworzyć spotkania dla importu.');
        }

        if (!String(newMeeting.workspaceId || '').trim()) {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          setIsUploading(false);
          setUploadingFileName('');
          setUploadProgress(0);
          setUploadErrorMessage(RECORDING_WORKSPACE_REQUIRED_MESSAGE);
          toast.error(RECORDING_WORKSPACE_REQUIRED_MESSAGE);
          if (e.target) e.target.value = '';
          return;
        }

        const queuedId = await queueRecording(newMeeting.id, file, newMeeting);

        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
        setUploadProgress(queuedId ? 100 : 0);
        setTimeout(
          () => {
            setIsUploading(false);
            setUploadingFileName('');
            setUploadProgress(0);
            setUploadErrorMessage('');
            if (queuedId) {
              selectMeeting(newMeeting);
              toast.success(
                'Pomyślnie rozpoczęto wgrywanie pliku i dodano do kolejki tranyskrypcji.'
              );
            }
          },
          queuedId ? 350 : 0
        );
      }
    } catch (_) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setIsUploading(false);
      setUploadProgress(0);
      setUploadErrorMessage('Wystąpił błąd przy wgrywaniu pliku.');
      toast.error('Wystąpił błąd przy wgrywaniu pliku.');
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="recordings-tab-container recordings-tab-shell">
      {showStandalonePipelineStatus && !activeQueueItemShownInPendingList ? (
        <section className="panel recordings-status-panel">
          <div className="panel-header compact recordings-panel-header-flat">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="recordings-section-title">Status przetwarzania nagrania</h2>
              <p className="soft-copy recordings-copy-md">
                {recordingMessage || 'Nagranie jest aktualnie przetwarzane przez pipeline audio.'}
              </p>
            </div>
          </div>
          <div className="panel-body recordings-panel-body-top">
            <RecordingPipelineStatus
              status={analysisStatus}
              progressMessage={recordingMessage}
              progressPercent={pipelineProgressPercent}
              stageLabel={pipelineStageLabel}
              errorMessage={recordingMessage}
            />
            {activeDiagnostics ? (
              <div className="recordings-diagnostics-copy recordings-diagnostics-top">
                {activeDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {selectedMeetingHasEmptyTranscript ? (
        <section className="panel recordings-section-panel">
          <div className="panel-header compact recordings-panel-header-flat">
            <div>
              <div className="eyebrow">Diagnostyka</div>
              <h2>Brak wykrytej mowy</h2>
              <p className="soft-copy recordings-copy-md">
                Nie wykryto wypowiedzi w nagraniu. Sprawdz audio albo ponow transkrypcje dla
                wybranego pliku.
              </p>
            </div>
          </div>
          <div className="panel-body recordings-panel-actions">
            {retryStoredRecording ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => handleRetryStoredRecording(selectedMeeting, latestSelectedRecording)}
                disabled={isRetryingLatestSelectedRecording}
                aria-busy={isRetryingLatestSelectedRecording ? 'true' : 'false'}
              >
                {isRetryingLatestSelectedRecording
                  ? 'Ponawiam transkrypcje...'
                  : 'Ponow transkrypcje'}
              </button>
            ) : null}
            {retryStoredRecordingError ? (
              <div
                className="recordings-diagnostics-copy recordings-diagnostics-md recordings-diagnostics-error"
                role="alert"
              >
                {retryStoredRecordingError}
              </div>
            ) : null}
            {selectedMeetingEmptyDiagnostics ? (
              <div className="recordings-diagnostics-copy recordings-diagnostics-md">
                {selectedMeetingEmptyDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {pendingImports.length ? (
        <section className="panel recordings-section-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Import</div>
              <h2>Pliki wgrywane i przetwarzane</h2>
              <p className="soft-copy recordings-copy-md">
                Nowo dodane pliki pojawiaja sie tutaj od razu, zanim trafia do finalnej listy
                nagran.
              </p>
            </div>
          </div>
          <div className="panel-body recordings-pending-list">
            {pendingImports.map((item) => {
              const isActive = activeQueueItem?.recordingId === item.recordingId;
              const pendingDisplay = getPendingImportDisplayState(
                item,
                isActive ? activeQueueItem : null,
                recordingMessage
              );
              const displayStatus = pendingDisplay.status;
              const progressPercent = isActive
                ? pipelineProgressPercent
                : displayStatus === 'queued'
                  ? 8
                  : 0;
              const progressMessage = pendingDisplay.isPermanent
                ? pendingDisplay.errorMessage
                : isActive
                  ? recordingMessage
                  : displayStatus === 'failed'
                    ? item.errorMessage
                    : isStalePendingImport(item)
                      ? 'Status nie zmienil sie od kilku minut. Odswiez albo ponow przetwarzanie.'
                      : 'Oczekiwanie na rozpoczecie przetwarzania...';
              const stageLabel = pendingDisplay.isPermanent
                ? 'Wymaga ponownego importu'
                : isActive
                  ? pipelineStageLabel
                  : isStalePendingImport(item)
                    ? 'Wymaga sprawdzenia statusu'
                    : 'Plik dodany do kolejki';
              const diagnostics = formatPipelineDiagnostics(item);
              const retryLabel = getPendingImportRetryLabel({
                ...item,
                status: displayStatus,
              });

              return (
                <div key={item.recordingId} className="pending-import-card recordings-pending-card">
                  <div className="recordings-pending-meta">
                    <div className="recordings-pending-title">
                      {item.meetingTitle || 'Nowy import'}
                    </div>
                    <div className="recordings-pending-date">
                      Dodano {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                  <RecordingPipelineStatus
                    status={displayStatus}
                    progressMessage={progressMessage}
                    progressPercent={progressPercent}
                    stageLabel={stageLabel}
                    errorMessage={pendingDisplay.errorMessage}
                    processingStartedAt={item.processingStartedAt}
                    onRetry={
                      retryLabel && retryRecordingQueueItem
                        ? () => retryRecordingQueueItem(item.recordingId)
                        : undefined
                    }
                    retryLabel={retryLabel || undefined}
                    allowInProgressRetry={Boolean(retryLabel && displayStatus !== 'failed')}
                    className="recordings-tab-pending-status"
                  />
                  {diagnostics ? (
                    <div className="recordings-pending-diagnostics">{diagnostics}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <main className="recordings-tab-content">
        <UnifiedLibrary
          userMeetings={filteredUserMeetings}
          recordingQueue={filteredRecordingQueue}
          selectedMeeting={selectedMeeting}
          selectMeeting={selectMeeting}
          setActiveTab={setActiveTab}
          onDeleteMeeting={handleDeleteMeeting}
          onUploadClick={() => mainFileInputRef.current?.click()}
          isUploading={isUploading}
          uploadingFileName={uploadingFileName}
          uploadProgress={uploadProgress}
          uploadErrorMessage={uploadErrorMessage}
          fileInputRef={mainFileInputRef}
          handleFileUpload={handleMainFileUpload}
        />
      </main>
    </div>
  );
}
