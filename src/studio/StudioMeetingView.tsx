import { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from 'react';
import TagBadge from '../shared/TagBadge';
import TagInput from '../shared/TagInput';
import { Virtuoso } from 'react-virtuoso';
import { useMeetingsCtx } from '../context/MeetingsContext';

import PropTypes from 'prop-types';
import { formatDateTime, formatDuration } from '../lib/storage';
import { getSpeakerColor } from '../lib/speakerColors';
import { labelSpeaker } from '../lib/recording';
import { analyzeSpeakingStyle } from '../lib/speakerAnalysis';
import { buildSketchnoteDataUrl, buildSketchnoteSvg } from '../lib/sketchnote';
import { normalizeMeetingFeedback } from '../shared/meetingFeedback';
import { apiRequest } from '../services/httpClient';
import { remoteApiEnabled } from '../services/config';
import { RecordingPipelineStatus } from '../components/RecordingPipelineStatus';
import './StudioMeetingViewStyles.css';

// Lazy load AI Task Suggestions Panel for code splitting
const AiTaskSuggestionsPanel = lazy(() => import('./AiTaskSuggestionsPanel'));

/**
 * Fireflies-style speaker picker dropdown for a single transcript segment.
 * Shows all existing speakers (checkmark on current), option to rename,
 * and option to add a new speaker slot.
 */
function SpeakerDropdown({
  seg,
  currentSpeakerId,
  speakers,
  nextSpeakerId,
  displaySpeakerNames,
  onReassign,
  onRename,
  onClose,
}) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="ff-speaker-dropdown" ref={ref} role="menu">
      {speakers.map((sp) => {
        const isCurrent = sp.id === currentSpeakerId;
        return (
          <button
            key={sp.id}
            type="button"
            role="menuitem"
            className={`ff-speaker-dropdown-item${isCurrent ? ' current' : ''}`}
            onClick={() => {
              if (!isCurrent) onReassign(sp.id);
            }}
          >
            <span className="ff-spk-dot" style={{ background: getSpeakerColor(sp.id) }} />
            <span className="ff-spk-label">{sp.name}</span>
            {isCurrent ? (
              <svg
                className="ff-spk-check"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                className="ff-spk-arrow"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 5h4M5 3l2 2-2 2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        );
      })}
      <div className="ff-speaker-dropdown-divider" />
      <button
        type="button"
        role="menuitem"
        className="ff-speaker-dropdown-item"
        onClick={() => onReassign(nextSpeakerId)}
      >
        <span className="ff-spk-dot" style={{ background: getSpeakerColor(nextSpeakerId) }} />
        <span className="ff-spk-label">+ Nowy mówca</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="ff-speaker-dropdown-item rename"
        onClick={() => onRename(currentSpeakerId)}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path
            d="M1 8.5l1.5-1.5 5-5 1.5 1.5-5 5L1 10l.5-1.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="ff-spk-label">Zmień nazwę</span>
      </button>
    </div>
  );
}

SpeakerDropdown.propTypes = {
  seg: PropTypes.object,
  currentSpeakerId: PropTypes.string,
  speakers: PropTypes.array,
  nextSpeakerId: PropTypes.string,
  displaySpeakerNames: PropTypes.object,
  onReassign: PropTypes.func,
  onRename: PropTypes.func,
  onClose: PropTypes.func,
};

/**
 * Per-speaker voice stats + GPT-4o audio coaching panel.
 * Shows text-based metrics immediately; coaching fetched on demand.
 */
function VoiceSpeakerStats({ transcript, displaySpeakerNames, recordingId }) {
  const stats = useMemo(
    () => analyzeSpeakingStyle(transcript, displaySpeakerNames),
    [transcript, displaySpeakerNames]
  );
  const [coaching, setCoaching] = useState({});
  const [loading, setLoading] = useState({});
  const [coachingError, setCoachingError] = useState({});
  const [acousticMetrics, setAcousticMetrics] = useState({});
  const [acousticLoading, setAcousticLoading] = useState(false);
  const [acousticError, setAcousticError] = useState('');

  async function fetchCoaching(speakerId) {
    if (!recordingId || loading[speakerId]) return;
    setLoading((p) => ({ ...p, [speakerId]: true }));
    setCoachingError((p) => ({ ...p, [speakerId]: '' }));
    try {
      const speakerSegs = transcript.filter((s) => String(s.speakerId ?? '') === String(speakerId));
      const res = await apiRequest(`/media/recordings/${recordingId}/voice-coaching`, {
        method: 'POST',
        body: { speakerId, segments: speakerSegs },
      });
      setCoaching((p) => ({ ...p, [speakerId]: res?.coaching || '' }));
    } catch (err) {
      setCoachingError((p) => ({ ...p, [speakerId]: err.message || 'Błąd analizy głosu.' }));
    } finally {
      setLoading((p) => ({ ...p, [speakerId]: false }));
    }
  }

  async function fetchAcousticMetrics() {
    if (!recordingId || acousticLoading || Object.keys(acousticMetrics).length > 0) return;
    setAcousticLoading(true);
    setAcousticError('');
    try {
      const response = await apiRequest(`/media/recordings/${recordingId}/acoustic-features`, {
        method: 'POST',
      });
      setAcousticMetrics(
        Object.fromEntries(
          (Array.isArray(response?.speakers) ? response.speakers : []).map((speaker) => [
            String(speaker.speakerId),
            speaker,
          ])
        )
      );
    } catch (err) {
      setAcousticError(err.message || 'Nie udalo sie pobrac metryk akustycznych.');
    } finally {
      setAcousticLoading(false);
    }
  }

  function formatMetricValue(value, suffix = '') {
    if (!Number.isFinite(Number(value))) return '-';
    return `${Number(value).toFixed(Number(value) >= 100 ? 0 : 1)}${suffix}`;
  }

  if (!stats.length) return null;

  return (
    <div className="ff-voice-stats-list">
      {stats.map((stat) => {
        const metrics = acousticMetrics[stat.speakerId];
        return (
          <div key={stat.speakerId} className="ff-voice-stat-card">
            <div className="ff-voice-stat-header">
              <span
                className="ff-speaker-avatar"
                style={{ background: getSpeakerColor(stat.speakerId) }}
              >
                {(stat.speakerName || 'S')[0].toUpperCase()}
              </span>
              <strong className="ff-voice-stat-name">{stat.speakerName}</strong>
            </div>
            <div className="ff-voice-stat-metrics">
              <span className="ff-voice-metric">
                <strong>{stat.wpm || '—'}</strong>
                <small>słów/min</small>
              </span>
              <span className="ff-voice-metric">
                <strong>{formatDuration(stat.speakingSeconds)}</strong>
                <small>czas mówienia</small>
              </span>
              <span className="ff-voice-metric">
                <strong>{stat.turnCount}</strong>
                <small>wypowiedzi</small>
              </span>
              {stat.fillerCount > 0 && (
                <span className="ff-voice-metric warn">
                  <strong>{stat.fillerRate}%</strong>
                  <small>wypełniacze</small>
                </span>
              )}
            </div>
            {metrics ? (
              <div className="ff-voice-acoustic-grid">
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics.f0Hz, ' Hz')}</strong>
                  <small>F0</small>
                </span>
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics.jitterLocal, '%')}</strong>
                  <small>jitter</small>
                </span>
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics.shimmerLocalDb, ' dB')}</strong>
                  <small>shimmer</small>
                </span>
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics.hnrDb, ' dB')}</strong>
                  <small>HNR</small>
                </span>
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics?.formantsHz?.f1, ' Hz')}</strong>
                  <small>F1</small>
                </span>
                <span className="ff-voice-metric">
                  <strong>{formatMetricValue(metrics?.formantsHz?.f2, ' Hz')}</strong>
                  <small>F2</small>
                </span>
              </div>
            ) : null}
            {coaching[stat.speakerId] ? (
              <div className="ff-voice-coaching-text">{coaching[stat.speakerId]}</div>
            ) : null}
            {coachingError[stat.speakerId] ? (
              <div className="ff-voice-coaching-error">{coachingError[stat.speakerId]}</div>
            ) : null}
            {acousticError ? <div className="ff-voice-coaching-error">{acousticError}</div> : null}
            {recordingId && remoteApiEnabled() ? (
              <button
                type="button"
                className="ff-voice-coaching-btn"
                onClick={() => fetchCoaching(stat.speakerId)}
                disabled={loading[stat.speakerId]}
              >
                {loading[stat.speakerId]
                  ? 'Analizuję głos…'
                  : coaching[stat.speakerId]
                    ? 'Odśwież analizę głosu'
                    : 'Analiza głosu AI'}
              </button>
            ) : null}
            {recordingId && remoteApiEnabled() ? (
              <button
                type="button"
                className="ff-voice-coaching-btn secondary"
                onClick={fetchAcousticMetrics}
                disabled={acousticLoading}
              >
                {acousticLoading
                  ? 'Licze cechy akustyczne...'
                  : metrics
                    ? 'Metryki akustyczne gotowe'
                    : 'Cechy akustyczne'}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

VoiceSpeakerStats.propTypes = {
  transcript: PropTypes.array,
  displaySpeakerNames: PropTypes.object,
  recordingId: PropTypes.string,
};

function formatEmptyTranscriptDiagnostics(recording) {
  const transcript = Array.isArray(recording?.transcript) ? recording.transcript : [];
  const treatedAsEmpty =
    recording?.transcriptOutcome === 'empty' ||
    (recording?.pipelineStatus === 'done' && transcript.length === 0);
  if (!recording || !treatedAsEmpty) return '';
  const details = [];
  const diagnostics = recording.transcriptionDiagnostics || {};
  const audioQuality = recording.audioQuality || null;

  if (recording.pipelineGitSha) {
    details.push(`Build: ${String(recording.pipelineGitSha).slice(0, 7)}`);
  }
  if (diagnostics.transcriptionProfileUsed) {
    details.push(`Profil STT: ${diagnostics.transcriptionProfileUsed}`);
  }
  if (diagnostics.usedChunking) {
    details.push('Chunking: tak');
  }
  if (
    Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `Chunks sent to STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (
    Number.isFinite(Number(diagnostics.chunksFailedAtStt)) &&
    Number(diagnostics.chunksFailedAtStt) > 0
  ) {
    details.push(`Chunks failed at STT: ${Number(diagnostics.chunksFailedAtStt)}`);
  }
  if (diagnostics.lastChunkErrorMessage) {
    details.push(`STT error: ${diagnostics.lastChunkErrorMessage}`);
  }
  if (
    Number.isFinite(Number(diagnostics.chunksWithText)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `STT chunks with text: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (recording.emptyReason) {
    details.push(`Reason: ${recording.emptyReason}`);
  }
  if (audioQuality?.qualityLabel) {
    details.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }

  return details.join(' · ');
}

function formatAudioQualityPanel(audioQuality) {
  if (!audioQuality || typeof audioQuality !== 'object') return '';
  const parts = [];

  if (audioQuality.qualityLabel) {
    parts.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }
  if (Number.isFinite(Number(audioQuality.meanVolumeDb))) {
    parts.push(`Srednia glosnosc: ${Number(audioQuality.meanVolumeDb).toFixed(1)} dB`);
  }
  if (typeof audioQuality.enhancementApplied === 'boolean') {
    parts.push(`Uzyto poprawy audio: ${audioQuality.enhancementApplied ? 'tak' : 'nie'}`);
  }

  return parts.join(' | ');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeAnalysisTask(task) {
  if (!task) return null;
  const title = String(task.title || task.text || task.sourceQuote || '').trim();
  if (!title) return null;
  return {
    title,
    description: String(task.description || task.sourceQuote || '').trim(),
    owner: String(task.owner || task.assignee || '').trim(),
    dueDate: String(task.dueDate || '').trim(),
    priority: String(task.priority || 'medium').trim() || 'medium',
    tags: safeArray(task.tags)
      .map((tag) => String(tag).trim())
      .filter(Boolean),
    sourceQuote: String(task.sourceQuote || task.text || title).trim(),
  };
}

// ── DISC Radar Chart ─────────────────────────────────────────────────────────
const DISC_AXES = [
  { key: 'D' as const, label: 'D', angle: -90, color: '#f17d72' },
  { key: 'I' as const, label: 'I', angle: 0, color: '#f3ca72' },
  { key: 'S' as const, label: 'S', angle: 90, color: '#67d59f' },
  { key: 'C' as const, label: 'C', angle: 180, color: '#8db4ff' },
];

function DiscRadarChart({
  D = 0,
  I = 0,
  S = 0,
  C = 0,
}: {
  D?: number;
  I?: number;
  S?: number;
  C?: number;
}) {
  const cx = 60,
    cy = 60,
    maxR = 44;
  const vals: Record<string, number> = { D, I, S, C };
  const pt = (angle: number, val: number) => {
    const r = (val / 100) * maxR;
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const polygon =
    DISC_AXES.map((ax, i) => {
      const p = pt(ax.angle, vals[ax.key]);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + ' Z';
  const gridPath = (pct: number) =>
    DISC_AXES.map((ax, i) => {
      const p = pt(ax.angle, pct * 100);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + ' Z';
  return (
    <svg
      viewBox="0 0 120 120"
      width="120"
      height="120"
      className="disc-radar-svg"
      aria-label="DISC Radar"
    >
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <path key={p} d={gridPath(p)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {DISC_AXES.map((ax) => {
        const tip = pt(ax.angle, 100);
        return (
          <line
            key={ax.key}
            x1={cx}
            y1={cy}
            x2={tip.x}
            y2={tip.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        );
      })}
      <path
        d={polygon}
        fill="rgba(117,214,196,0.15)"
        stroke="rgba(117,214,196,0.6)"
        strokeWidth="1.5"
      />
      {DISC_AXES.map((ax) => {
        const p = pt(ax.angle, vals[ax.key]);
        return <circle key={ax.key} cx={p.x} cy={p.y} r="3" fill={ax.color} />;
      })}
      {DISC_AXES.map((ax) => {
        const p = pt(ax.angle, 110);
        return (
          <text
            key={ax.key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={ax.color}
            fontSize="11"
            fontWeight="700"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
}

const COMM_LABELS: Record<string, string> = {
  analytical: 'analityczny',
  expressive: 'ekspresyjny',
  diplomatic: 'dyplomatyczny',
  direct: 'bezpośredni',
};
const DECISION_LABELS: Record<string, string> = {
  'data-driven': 'oparty na danych',
  intuitive: 'intuicyjny',
  consensual: 'konsensualny',
  authoritative: 'autorytatywny',
};
const DISC_COLORS: Record<string, string> = {
  D: '#f17d72',
  I: '#f3ca72',
  S: '#67d59f',
  C: '#8db4ff',
};
void DiscRadarChart;
void COMM_LABELS;
void DECISION_LABELS;
void DISC_COLORS;

export default function StudioMeetingView({
  selectedMeeting,
  displayRecording,
  studioAnalysis,
  isRecording,
  activeQueueItem,
  selectedMeetingQueue,
  elapsed,
  visualBars,
  voiceActivityStatus,
  isPaused,
  stopRecording,
  startRecording,
  pauseRecording,
  resumeRecording,
  retryRecordingQueueItem,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  liveTranscriptEnabled,
  setLiveTranscriptEnabled,
  recordingMessage,
  pipelineProgressPercent,
  pipelineStageLabel,
  setRecordingMessage,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  selectedRecordingAudioError,
  selectedRecordingAudioStatus,
  hydrateRecordingAudio,
  clearAudioHydrationError,
  selectedRecordingId,
  setSelectedRecordingId,
  exportTranscript,
  exportMeetingNotes,
  exportMeetingPdfFile,
  startNewMeetingDraft,
  selectMeeting,
  currentWorkspacePermissions,
  currentWorkspaceRole,
  currentWorkspace,
  currentUser,
  currentWorkspaceMembers,
  userMeetings,
  meetingTasks,
  onCreateTask,
  peopleProfiles,
  addMeetingComment,
  currentUserName,
  meetingDraft,
  setMeetingDraft,
  saveMeeting,
  renameSpeaker,
  autoCreateVoiceProfile,
  updateTranscriptSegment,
  retryStoredRecording,
  onOpenTask,
  onOpenPerson,
  briefOpen,
  setBriefOpen,
  setActiveTab,
  silenceCountdown,
  resetSilenceTimer,
}) {
  const [addNeedOpen, setAddNeedOpen] = useState(false);
  const [needDraft, setNeedDraft] = useState('');
  const [addConcernOpen, setAddConcernOpen] = useState(false);
  const [concernDraft, setConcernDraft] = useState('');
  const [debriefCopyMessage, setDebriefCopyMessage] = useState('');

  const { meetings } = useMeetingsCtx();
  const updateMeeting = meetings?.updateMeeting;

  const allParticipants = useMemo(() => {
    const pSet = new Set();
    
    // Dodaj uczestników z istniejących spotkań (guests)
    (userMeetings || []).forEach((m) => {
      (m.guests || []).forEach((g) => {
        if (g && typeof g === 'string' && g.trim()) pSet.add(g.trim());
      });
    });
    
    // Dodaj osoby z profili (główny źródło sugestii)
    (peopleProfiles || []).forEach((p) => {
      if (p?.name && typeof p.name === 'string' && p.name.trim() && p.name !== 'Nieprzypisane') {
        pSet.add(p.name.trim());
      }
    });
    
    // Dodaj członków workspace (fallback)
    (currentWorkspaceMembers || []).forEach((member) => {
      if (member?.name && typeof member.name === 'string' && member.name.trim() && member.name !== 'Nieprzypisane') {
        pSet.add(member.name.trim());
      }
      if (member?.email && typeof member.email === 'string' && member.email.trim()) {
        pSet.add(member.email.trim());
      }
    });
    
    return Array.from(pSet).sort();
  }, [userMeetings, peopleProfiles, currentWorkspaceMembers]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraftValue, setTitleDraftValue] = useState('');

  const [studioAnalysisTab, setStudioAnalysisTab] = useState('summary'); // default to summary based on user preference
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadTab, setDownloadTab] = useState('transcript'); // 'transcript', 'summary', 'audio'
  const [downloadFormat, setDownloadFormat] = useState('PDF');
  const [includeTimestamp, setIncludeTimestamp] = useState(true);
  const [showSpeakerName, setShowSpeakerName] = useState(true);
  const [removeBranding, setRemoveBranding] = useState(false);

  const handleDownload = () => {
    const toSrtTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
        .toString()
        .padStart(2, '0');
      const m = Math.floor((seconds % 3600) / 60)
        .toString()
        .padStart(2, '0');
      const s = Math.floor(seconds % 60)
        .toString()
        .padStart(2, '0');
      const ms = Math.floor((seconds % 1) * 1000)
        .toString()
        .padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };

    if (downloadTab === 'audio') {
      if (!selectedRecordingAudioUrl) return;
      fetch(selectedRecordingAudioUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const safeTitle = (
            selectedMeeting?.title ||
            displayRecording?.title ||
            'nagranie'
          ).replace(/[^a-z0-9_-]/gi, '_');
          a.download = `${safeTitle}.mp3`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        });
      setIsDownloadModalOpen(false);
      return;
    }

    if (downloadFormat === 'PDF' && exportMeetingPdfFile) {
      exportMeetingPdfFile();
      setIsDownloadModalOpen(false);
      return;
    }

    let content = '';
    let filename = (selectedMeeting?.title || displayRecording?.title || 'nagranie').replace(
      /[^a-z0-9_-]/gi,
      '_'
    );
    const fullTranscript = displayRecording?.transcript || selectedMeeting?.transcript || [];

    if (downloadTab === 'transcript') {
      if (downloadFormat === 'SRT') {
        content = fullTranscript
          .map((s, i) => {
            const start = toSrtTime(s.timestamp);
            const end = toSrtTime(s.endTimestamp || s.timestamp + 2);
            let text = s.text;
            if (showSpeakerName)
              text = `${labelSpeaker(displaySpeakerNames, s.speakerId)}: ${text}`;
            return `${i + 1}\n${start} --> ${end}\n${text}\n`;
          })
          .join('\n');
      } else {
        content = fullTranscript
          .map((s) => {
            let line = '';
            if (includeTimestamp) line += `[${formatDuration(Math.floor(s.timestamp))}] `;
            if (showSpeakerName) line += `${labelSpeaker(displaySpeakerNames, s.speakerId)}: `;
            line += s.text;
            return line;
          })
          .join('\n');
      }
      filename += '_transcript';
    } else {
      content = selectedMeeting?.summary || 'Brak podsumowania.';
      filename += '_summary';
    }

    const blobType = downloadFormat === 'JSON' ? 'application/json' : 'text/plain;charset=utf-8';
    const ext = downloadFormat.toLowerCase();
    const finalContent =
      downloadFormat === 'JSON' ? JSON.stringify({ title: filename, content }, null, 2) : content;

    const blob = new Blob([finalContent], { type: blobType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    setIsDownloadModalOpen(false);
  };

  const [transcriptSearch, setTranscriptSearch] = useState('');
  // Speaker picker dropdown — tracks which segment's dropdown is open
  const [speakerDropdownSegId, setSpeakerDropdownSegId] = useState(null);
  // Rename flow (triggered from within the dropdown)
  const [renamingSpeakerId, setRenamingSpeakerId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [voiceProfileToast, setVoiceProfileToast] = useState<string | null>(null);
  const [pendingVoiceProfileEnrollment, setPendingVoiceProfileEnrollment] = useState<any>(null);
  const [voiceStatsOpen, setVoiceStatsOpen] = useState(false);
  const [rediarizing, setRediarizing] = useState(false);
  const [rediarizeMsg, setRediarizeMsg] = useState(null);
  const [sketchnoteUrl, setSketchnoteUrl] = useState('');
  const [sketchnoteFallbackSvg, setSketchnoteFallbackSvg] = useState('');
  const [sketchnoteIsLocal, setSketchnoteIsLocal] = useState(false);
  const [isGeneratingSketchnote, setIsGeneratingSketchnote] = useState(false);
  const [sketchnoteError, setSketchnoteError] = useState('');
  const autoTaskSyncKeyRef = useRef('');

  const audioRef = useRef(null);
  const virtuosoRef = useRef(null);
  const autoLearnSpeakerProfiles = Boolean(currentUser?.autoLearnSpeakerProfiles);

  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const analysisStatus = selectedMeetingQueue?.status;
  const isQueued = ['queued', 'uploading', 'processing'].includes(analysisStatus) && !isRecording;
  const selectedTranscript = Array.isArray(selectedRecording?.transcript)
    ? selectedRecording.transcript
    : [];
  const isEmptyTranscript =
    selectedRecording?.transcriptOutcome === 'empty' ||
    (selectedRecording?.pipelineStatus === 'done' && selectedTranscript.length === 0);
  const emptyTranscriptDiagnostics = useMemo(
    () => formatEmptyTranscriptDiagnostics(selectedRecording),
    [selectedRecording]
  );
  const selectedRecordingAudioQualitySummary = useMemo(
    () => formatAudioQualityPanel(selectedRecording?.audioQuality),
    [selectedRecording?.audioQuality]
  );
  const autoTaskDrafts = useMemo(() => {
    const analysisTasks = safeArray(studioAnalysis?.tasks)
      .map(normalizeAnalysisTask)
      .filter(Boolean);
    if (analysisTasks.length) {
      return analysisTasks;
    }

    return safeArray(studioAnalysis?.actionItems)
      .map((item) => normalizeAnalysisTask({ title: item, sourceQuote: item }))
      .filter(Boolean);
  }, [studioAnalysis?.actionItems, studioAnalysis?.tasks]);

  const followUps = useMemo(
    () => safeArray(studioAnalysis?.followUps).slice(0, 4),
    [studioAnalysis?.followUps]
  );
  const risks = useMemo(
    () => safeArray(studioAnalysis?.risks).slice(0, 3),
    [studioAnalysis?.risks]
  );
  const blockers = useMemo(
    () => safeArray(studioAnalysis?.blockers).slice(0, 3),
    [studioAnalysis?.blockers]
  );
  const tensions = useMemo(
    () => safeArray(studioAnalysis?.tensions).slice(0, 3),
    [studioAnalysis?.tensions]
  );
  const aiDebrief = selectedMeeting?.aiDebrief || displayRecording?.aiDebrief || null;
  const feedbackTranscript = useMemo(() => {
    if (Array.isArray(displayRecording?.transcript) && displayRecording.transcript.length) {
      return displayRecording.transcript;
    }
    return safeArray(selectedRecording?.transcript);
  }, [displayRecording?.transcript, selectedRecording?.transcript]);
  const feedbackSpeakerStats = useMemo(
    () => analyzeSpeakingStyle(feedbackTranscript, displaySpeakerNames),
    [feedbackTranscript, displaySpeakerNames]
  );
  const feedbackView = useMemo(
    () =>
      normalizeMeetingFeedback(studioAnalysis?.feedback, {
        summary: studioAnalysis?.summary,
        decisions: studioAnalysis?.decisions,
        actionItems: studioAnalysis?.actionItems,
        tasks: studioAnalysis?.tasks,
        followUps: studioAnalysis?.followUps,
        answersToNeeds: studioAnalysis?.answersToNeeds,
        risks: studioAnalysis?.risks,
        blockers: studioAnalysis?.blockers,
        participantInsights: studioAnalysis?.participantInsights,
        tensions: studioAnalysis?.tensions,
        keyQuotes: studioAnalysis?.keyQuotes,
        speakerStats: feedbackSpeakerStats,
        transcriptLength: feedbackTranscript.length,
        meetingTitle: selectedMeeting?.title,
      }),
    [
      feedbackSpeakerStats,
      feedbackTranscript.length,
      selectedMeeting?.title,
      studioAnalysis?.actionItems,
      studioAnalysis?.answersToNeeds,
      studioAnalysis?.blockers,
      studioAnalysis?.decisions,
      studioAnalysis?.feedback,
      studioAnalysis?.followUps,
      studioAnalysis?.keyQuotes,
      studioAnalysis?.participantInsights,
      studioAnalysis?.risks,
      studioAnalysis?.summary,
      studioAnalysis?.tasks,
      studioAnalysis?.tensions,
    ]
  );
  const feedbackIsSparse =
    feedbackTranscript.length < 5 ||
    (!safeArray(studioAnalysis?.decisions).length &&
      !safeArray(studioAnalysis?.tasks).length &&
      !safeArray(studioAnalysis?.participantInsights).length);
  const copyAIDebrief = useCallback(async () => {
    if (!aiDebrief) {
      return;
    }

    const lines = [
      `Debrief AI: ${selectedMeeting?.title || 'Spotkanie'}`,
      '',
      aiDebrief.summary,
      '',
      `Decyzje: ${(aiDebrief.decisions || []).join(' | ') || 'Brak'}`,
      `Ryzyka: ${(aiDebrief.risks || []).join(' | ') || 'Brak'}`,
      `Następne kroki: ${(aiDebrief.followUps || []).join(' | ') || 'Brak'}`,
    ];

    const text = lines.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setDebriefCopyMessage('Skopiowano debrief do schowka.');
      } else {
        setDebriefCopyMessage('Schowek nie jest dostępny w tej przeglądarce.');
      }
    } catch (error) {
      setDebriefCopyMessage(String(error?.message || 'Nie udało się skopiować debriefu.'));
    }
  }, [aiDebrief, selectedMeeting?.title]);
  const meetingTaskEntries = useMemo(() => {
    const meetingId = String(selectedMeeting?.id || '').trim();
    const recordingId = String(selectedRecording?.id || '').trim();

    if (!meetingId && !recordingId) {
      return [];
    }

    return safeArray(meetingTasks)
      .filter((task) => {
        const taskMeetingId = String(task?.sourceMeetingId || '').trim();
        const taskRecordingId = String(task?.sourceRecordingId || '').trim();
        const taskSourceType = String(task?.sourceType || '').trim();

        return Boolean(
          (meetingId && taskMeetingId === meetingId) ||
          (recordingId && taskRecordingId === recordingId) ||
          (meetingId && taskSourceType === 'meeting' && !taskMeetingId)
        );
      })
      .sort((a, b) => {
        const left = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const right = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return right - left;
      });
  }, [meetingTasks, selectedMeeting?.id, selectedRecording?.id]);

  function openMeetingTaskDetails(taskId) {
    if (!taskId || typeof onOpenTask !== 'function') {
      return;
    }

    onOpenTask({ taskId, mode: 'detail' });
  }

  function goToTasksTab(taskId) {
    if (typeof onOpenTask === 'function') {
      onOpenTask({ taskId, mode: 'tab' });
      return;
    }

    if (typeof setActiveTab === 'function') {
      setActiveTab('tasks');
    }
  }
  const summaryBullets = useMemo(() => {
    const bullets = [];

    const summaryText = String(studioAnalysis?.summary || '').trim();
    if (summaryText) {
      bullets.push({
        icon: '🧾',
        label: 'Podsumowanie',
        value: summaryText,
      });
    }

    const decisionsText = safeArray(studioAnalysis?.decisions).slice(0, 3);
    if (decisionsText.length) {
      bullets.push({
        icon: '✅',
        label: 'Decyzje',
        value: decisionsText.length === 1 ? decisionsText[0] : decisionsText.join('; '),
      });
    }

    const actionText = autoTaskDrafts.slice(0, 3).map((task) => task.title);
    if (actionText.length) {
      bullets.push({
        icon: '📌',
        label: 'Action items',
        value: actionText.length === 1 ? actionText[0] : actionText.join('; '),
      });
    }

    const followUpText = followUps.slice(0, 3);
    if (followUpText.length) {
      bullets.push({
        icon: '➡️',
        label: 'Następne kroki',
        value: followUpText.length === 1 ? followUpText[0] : followUpText.join('; '),
      });
    }

    const riskItems = [...risks.map((item) => item.risk), ...blockers];
    if (riskItems.length) {
      bullets.push({
        icon: '⚠️',
        label: 'Ryzyka / blokery',
        value: riskItems.slice(0, 3).join('; '),
      });
    }

    return bullets.slice(0, 5);
  }, [
    autoTaskDrafts,
    blockers,
    followUps,
    risks,
    studioAnalysis?.decisions,
    studioAnalysis?.summary,
  ]);

  const sketchnoteSummaryText = useMemo(() => {
    return String(
      studioAnalysis?.summary ||
        displayRecording?.diarization?.reviewSummary?.summary ||
        displayRecording?.diarization?.summary ||
        ''
    ).trim();
  }, [
    displayRecording?.diarization?.reviewSummary?.summary,
    displayRecording?.diarization?.summary,
    studioAnalysis?.summary,
  ]);

  useEffect(() => {
    if (!selectedRecording?.id || typeof onCreateTask !== 'function' || !autoTaskDrafts.length) {
      return;
    }

    const batchKey = [
      selectedRecording.id,
      autoTaskDrafts
        .map((task) =>
          [
            task.title,
            task.owner,
            task.dueDate,
            task.priority,
            task.tags.join(','),
            task.sourceQuote,
          ].join('|')
        )
        .join('||'),
    ].join('::');

    if (autoTaskSyncKeyRef.current === batchKey) {
      return;
    }

    const existing = new Set(
      safeArray(meetingTasks)
        .filter(
          (task) =>
            task.sourceRecordingId === selectedRecording.id ||
            task.sourceMeetingId === selectedMeeting?.id
        )
        .map(
          (task) =>
            `${String(task.title || '')
              .trim()
              .toLowerCase()}|${String(task.sourceQuote || '')
              .trim()
              .toLowerCase()}`
        )
    );

    autoTaskDrafts.forEach((task) => {
      const key = `${task.title.trim().toLowerCase()}|${task.sourceQuote.trim().toLowerCase()}`;
      if (!task.title || existing.has(key)) {
        return;
      }

      onCreateTask({
        title: task.title,
        description: task.description,
        owner: task.owner,
        assignedTo: task.owner ? [task.owner] : [],
        dueDate: task.dueDate,
        priority: task.priority,
        tags: task.tags,
        notes: task.sourceQuote,
        sourceType: 'meeting',
        sourceMeetingId: selectedMeeting?.id || '',
        sourceMeetingTitle: selectedMeeting?.title || '',
        sourceMeetingDate: selectedMeeting?.startsAt || selectedMeeting?.createdAt || '',
        sourceRecordingId: selectedRecording?.id || '',
      });
      existing.add(key);
    });

    autoTaskSyncKeyRef.current = batchKey;
  }, [
    autoTaskDrafts,
    meetingTasks,
    onCreateTask,
    selectedMeeting?.createdAt,
    selectedMeeting?.id,
    selectedMeeting?.startsAt,
    selectedMeeting?.title,
    selectedRecording?.id,
  ]);
  const queueLabel =
    analysisStatus === 'uploading'
      ? 'Wysyłanie audio…'
      : analysisStatus === 'processing'
        ? 'Transkrypcja w toku…'
        : 'Nagranie w kolejce…';

  const transcript = useMemo(
    () => displayRecording?.transcript || [],
    [displayRecording?.transcript]
  );

  const speakerStats = useMemo(
    () => analyzeSpeakingStyle(transcript, displaySpeakerNames),
    [transcript, displaySpeakerNames]
  );

  const totalSpeakingSeconds = useMemo(
    () => speakerStats.reduce((acc, s) => acc + s.speakingSeconds, 0),
    [speakerStats]
  );

  const activeSeg = useMemo(
    () =>
      transcript.length && currentTime > 0
        ? transcript.find((s) => s.timestamp <= currentTime && s.endTimestamp > currentTime) || null
        : null,
    [transcript, currentTime]
  );

  const filteredTranscript = useMemo(() => {
    const q = transcriptSearch.trim().toLowerCase();
    if (!q) return transcript;
    return transcript.filter((s) => s.text?.toLowerCase().includes(q));
  }, [transcript, transcriptSearch]);

  // All unique speaker IDs in the current recording's transcript
  const uniqueSpeakers = useMemo(() => {
    const seen = new Map();
    for (const seg of transcript) {
      const sid = String(seg.speakerId ?? '');
      if (sid && !seen.has(sid)) seen.set(sid, labelSpeaker(displaySpeakerNames, sid));
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [transcript, displaySpeakerNames]);

  // Reassign a single segment to a different speaker
  const reassignSegmentSpeaker = useCallback(
    (segId, newSpeakerId) => {
      if (typeof updateTranscriptSegment === 'function') {
        updateTranscriptSegment(segId, { speakerId: newSpeakerId });
      }
      setSpeakerDropdownSegId(null);
    },
    [updateTranscriptSegment]
  );

  const showVoiceProfileToast = useCallback((speakerName) => {
    setVoiceProfileToast(speakerName);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setVoiceProfileToast(null), 3500);
    }
  }, []);

  const enrollSpeakerProfile = useCallback(
    async (speakerId, speakerName) => {
      if (typeof autoCreateVoiceProfile !== 'function') return false;
      const enrolled = await autoCreateVoiceProfile(speakerId, speakerName);
      if (enrolled) {
        showVoiceProfileToast(speakerName);
      }
      return enrolled;
    },
    [autoCreateVoiceProfile, showVoiceProfileToast]
  );

  const commitSpeakerRename = useCallback(
    (speakerId, speakerName) => {
      const nextName = String(speakerName || '').trim();
      if (!nextName || typeof renameSpeaker !== 'function') return;

      renameSpeaker(speakerId, nextName);
      if (!autoCreateVoiceProfile || /^speaker\s*\d+$/i.test(nextName)) return;

      if (autoLearnSpeakerProfiles) {
        enrollSpeakerProfile(speakerId, nextName).catch(() => undefined);
        return;
      }

      setPendingVoiceProfileEnrollment({
        speakerId,
        speakerName: nextName,
      });
    },
    [autoCreateVoiceProfile, autoLearnSpeakerProfiles, enrollSpeakerProfile, renameSpeaker]
  );

  // Re-run GPT-4o-mini speaker detection on stored transcript
  const handleRediarize = useCallback(async () => {
    if (!selectedRecording?.id || !remoteApiEnabled()) return;
    setRediarizing(true);
    setRediarizeMsg(null);
    try {
      const result = await apiRequest(`/media/recordings/${selectedRecording.id}/rediarize`, {
        method: 'POST',
      });
      if (result?.segments && typeof updateTranscriptSegment === 'function') {
        for (const seg of result.segments) {
          if (seg.id)
            updateTranscriptSegment(seg.id, {
              speakerId: seg.speakerId,
              rawSpeakerLabel: seg.rawSpeakerLabel,
            });
        }
        setRediarizeMsg(`Wykryto ${result.speakerCount} mówcę/mówców.`);
      }
    } catch (err) {
      setRediarizeMsg(`Błąd: ${err.message}`);
    } finally {
      setRediarizing(false);
    }
  }, [selectedRecording?.id, updateTranscriptSegment]);

  const handleGenerateSketchnote = useCallback(async () => {
    if (!selectedRecording?.id) return;
    setIsGeneratingSketchnote(true);
    setSketchnoteError('');
    const fallbackSvg = buildSketchnoteSvg(
      sketchnoteSummaryText || 'Podsumowanie spotkania',
      summaryBullets
    );
    const fallbackSketchnoteUrl = buildSketchnoteDataUrl(
      sketchnoteSummaryText || 'Podsumowanie spotkania',
      summaryBullets
    );
    setSketchnoteFallbackSvg(fallbackSvg);
    setSketchnoteIsLocal(true);
    setSketchnoteUrl(fallbackSketchnoteUrl);
    try {
      const res = await apiRequest(`/media/recordings/${selectedRecording.id}/sketchnote`, {
        method: 'POST',
        body: {
          summary: sketchnoteSummaryText,
          decisions: safeArray(studioAnalysis?.decisions)
            .map((d) =>
              String(
                typeof d === 'object' ? (d as any)?.title || (d as any)?.text || '' : d || ''
              ).trim()
            )
            .filter(Boolean),
          actionItems: autoTaskDrafts
            .slice(0, 6)
            .map((t) => t.title)
            .filter(Boolean),
          followUps: followUps.slice(0, 4),
          risks: risks
            .slice(0, 3)
            .map((r: any) =>
              typeof r === 'object' ? r?.risk || r?.title || String(r) : String(r)
            ),
          blockers: blockers.slice(0, 3),
          keyQuotes: safeArray(studioAnalysis?.keyQuotes)
            .slice(0, 2)
            .map((q: any) =>
              typeof q === 'object' ? q?.text || q?.quote || String(q) : String(q)
            ),
        },
      });
      if (res?.sketchnoteUrl) {
        setSketchnoteUrl(res.sketchnoteUrl);
        setSketchnoteIsLocal(false);
        setSketchnoteFallbackSvg('');
        return;
      }
      setSketchnoteError('Backend sketchnotki nie zwrócił obrazu. Pokazuję lokalny podgląd.');
    } catch (err) {
      setSketchnoteError(
        err?.message
          ? `Nie udało się pobrać sketchnotki z backendu. Pokazuję lokalny podgląd: ${err.message}`
          : 'Nie udało się pobrać sketchnotki z backendu. Pokazuję lokalny podgląd.'
      );
    } finally {
      setIsGeneratingSketchnote(false);
    }
  }, [
    selectedRecording?.id,
    sketchnoteSummaryText,
    summaryBullets,
    autoTaskDrafts,
    blockers,
    followUps,
    risks,
    studioAnalysis?.decisions,
    studioAnalysis?.keyQuotes,
  ]);

  useEffect(() => {
    if (displayRecording?.diarization?.sketchnoteUrl) {
      setSketchnoteUrl(displayRecording.diarization.sketchnoteUrl);
      setSketchnoteIsLocal(false);
      setSketchnoteFallbackSvg('');
    } else if (!sketchnoteIsLocal) {
      setSketchnoteUrl('');
    }
  }, [displayRecording?.diarization?.sketchnoteUrl, displayRecording?.id, sketchnoteIsLocal]);

  // Next unused speaker ID for "Add speaker" action
  const nextSpeakerId = useMemo(() => {
    const nums = uniqueSpeakers
      .map((s) => parseInt(String(s.id).replace(/\D/g, ''), 10))
      .filter(Number.isFinite);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [uniqueSpeakers]);
  void handleGenerateSketchnote;

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }

  function cyclePlaybackRate() {
    const a = audioRef.current;
    if (!a) return;
    const rates = [1, 1.25, 1.5, 1.75, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    a.playbackRate = next;
    setPlaybackRate(next);
  }

  useEffect(() => {
    if (virtuosoRef.current && activeSeg?.id) {
      const index = filteredTranscript.findIndex((s) => s.id === activeSeg.id);
      if (index !== -1) {
        virtuosoRef.current.scrollToIndex({
          index,
          align: 'center',
          behavior: 'smooth',
        });
      }
    }
  }, [activeSeg?.id, filteredTranscript]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    function onTimeUpdate() {
      setCurrentTime(audio.currentTime || 0);
    }
    function onDuration() {
      setAudioDuration(isFinite(audio.duration) ? audio.duration : 0);
    }
    function onPlayPause() {
      setIsPlaying(!audio.paused);
    }
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('play', onPlayPause);
    audio.addEventListener('pause', onPlayPause);
    audio.addEventListener('ended', onPlayPause);
    if (isFinite(audio.duration) && audio.duration > 0) setAudioDuration(audio.duration);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('play', onPlayPause);
      audio.removeEventListener('pause', onPlayPause);
      audio.removeEventListener('ended', onPlayPause);
    };
  }, [selectedRecordingAudioUrl]);

  useEffect(() => {
    if (!selectedRecording?.id || !hydrateRecordingAudio) return;
    if (selectedRecordingAudioUrl) return;
    if (selectedRecordingAudioStatus === 'loading') return;
    hydrateRecordingAudio(selectedRecording.id, { priority: true }).catch(() => {});
  }, [
    hydrateRecordingAudio,
    selectedRecording?.id,
    selectedRecordingAudioStatus,
    selectedRecordingAudioUrl,
  ]);

  const shouldShowPlayerBar =
    isRecording ||
    Boolean(selectedRecording) ||
    isQueued ||
    analysisStatus === 'error' ||
    analysisStatus === 'failed';
  const playerState = isRecording
    ? 'recording'
    : selectedRecording && !selectedRecordingAudioUrl
      ? selectedRecordingAudioStatus === 'error'
        ? 'audio-error'
        : 'loading-audio'
      : (isQueued || analysisStatus === 'error' || analysisStatus === 'failed') &&
          !selectedRecordingAudioUrl
        ? 'queued'
        : 'playback-ready';
  const playbackDuration = Math.max(0, Number(audioDuration || displayRecording?.duration || 0));
  const scrubberMax = Math.max(playbackDuration, 1);
  const scrubberValue = Math.min(scrubberMax, Math.max(0, Number(currentTime || 0)));
  const scrubberProgress =
    scrubberMax > 0 ? Math.min(100, Math.max(0, (scrubberValue / scrubberMax) * 100)) : 0;

  if (!selectedMeeting && !isRecording && !isQueued && !displayRecording && !selectedRecording) {
    return (
      <section className="hero-panel empty-workspace">
        <div className="empty-workspace-inner">
          <div className="eyebrow">Studio</div>
          <h2>Brak aktywnego spotkania</h2>
          <p>
            Przejdź do zakładki <strong>Nagrania</strong>, aby wybrać nagranie do analizy lub
            uruchom nagranie ad hoc.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => startRecording({ adHoc: true })}
              disabled={!currentWorkspacePermissions?.canRecordAudio}
            >
              ⬤ Nagraj ad hoc
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                startNewMeetingDraft();
                setBriefOpen(true);
              }}
              disabled={!currentWorkspacePermissions?.canEditWorkspace}
            >
              Przygotuj brief
            </button>
          </div>
          {recordingMessage && (
            <div
              className={`ff-status-banner ff-status-banner-spaced${analysisStatus === 'error' ? ' ff-status-error' : ''}`}
            >
              <div style={{ flex: 1 }}>
                <span>{recordingMessage}</span>
                {pipelineProgressPercent > 0 &&
                  pipelineProgressPercent < 100 &&
                  analysisStatus !== 'error' && (
                    <div
                      style={{
                        height: 4,
                        background: 'rgba(255,255,255,0.1)',
                        marginTop: 8,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pipelineProgressPercent}%`,
                          background: 'var(--accent, #3b82f6)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}
              </div>
              <button
                type="button"
                className="ff-status-dismiss-btn"
                onClick={() => setRecordingMessage('')}
                aria-label="Zamknij powiadomienie"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      {selectedRecordingAudioUrl ? (
        <audio
          ref={audioRef}
          src={selectedRecordingAudioUrl}
          preload="metadata"
          className="ff-audio-hidden"
        >
          <track kind="captions" />
        </audio>
      ) : null}

      <div className="ff-studio-split-view">
        {/* LEFT COLUMN: Actions, Briefs, Panels */}
        <div className="ff-studio-left-col">
          {/* ═══════════════════════════════════════════
           HEADER — title + subtitle
          ═══════════════════════════════════════════ */}
          <div className="ff-header">
            {isEditingTitle ? (
              <input
                autoFocus
                className="ff-header-title-input ff-header-title-input-editing"
                type="text"
                value={titleDraftValue}
                onChange={(e) => setTitleDraftValue(e.target.value)}
                onBlur={() => {
                  setIsEditingTitle(false);
                  const val = titleDraftValue.trim();
                  if (!val) return;
                  if (isRecording && setMeetingDraft) {
                    setMeetingDraft({ ...meetingDraft, title: val });
                  } else if (selectedMeeting && updateMeeting && val !== selectedMeeting.title) {
                    updateMeeting(selectedMeeting.id, { title: val });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingTitle(false);
                }}
              />
            ) : (
              <h1
                className="ff-header-title ff-header-title-editable"
                title="Kliknij, aby edytować nazwę"
                onClick={() => {
                  setTitleDraftValue(
                    isRecording
                      ? meetingDraft?.title?.trim() || 'Ad hoc'
                      : selectedMeeting?.title || 'Ad hoc'
                  );
                  setIsEditingTitle(true);
                }}
              >
                {isRecording
                  ? meetingDraft?.title?.trim() || 'Ad hoc'
                  : selectedMeeting?.title || 'Ad hoc'}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ff-header-title-icon"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </h1>
            )}
            <p className="ff-header-sub">
              {displayRecording
                ? [
                    formatDateTime(
                      displayRecording.recordedAt ||
                        displayRecording.createdAt ||
                        displayRecording.startsAt
                    ),
                    displayRecording.duration > 0
                      ? formatDuration(Math.floor(displayRecording.duration))
                      : null,
                    uniqueSpeakers.length > 0
                      ? `${uniqueSpeakers.length} ${uniqueSpeakers.length === 1 ? 'mówca' : 'mówców'}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : formatDateTime(
                    selectedMeeting?.startsAt ||
                      selectedMeeting?.createdAt ||
                      new Date().toISOString()
                  )}
            </p>
          </div>

          <div className="ff-intelligence-tabs ff-intelligence-tabs-shell">
            {[
              { id: 'summary', label: 'Podsumowanie spotkania' },
              { id: 'needs', label: 'Potrzeby i obawy' },
              { id: 'profile', label: 'Profil psychologiczny' },
              { id: 'feedback', label: 'Twój feedback' },
              { id: 'tasks', label: 'Zadania' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`ff-int-tab ${studioAnalysisTab === t.id ? 'active' : ''}`}
                onClick={() => setStudioAnalysisTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════
           TOOLBAR — Grupa 1: Eksport/Brief | Separator | Grupa 2: Nagrywanie
          ═══════════════════════════════════════════ */}
          <div className="ff-toolbar" data-testid="studio-toolbar">
            {/* ── Grupa 1: Zakładki/Eksport (zawsze widoczne) ── */}
            <button
              type="button"
              className="ff-tb-btn"
              onClick={() => {
                setDownloadTab('summary');
                setIsDownloadModalOpen(true);
              }}
              disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Eksport
            </button>

            <button
              type="button"
              className={`ff-tb-btn${briefOpen ? ' active' : ''}`}
              onClick={() => setBriefOpen((v) => !v)}
            >
              {briefOpen ? '− Brief' : '+ Brief'}
            </button>

            {/* ── Separator ── */}
            <span className="ff-tb-sep" />

            {/* ── Grupa 2: Akcje nagrywania ── */}
            {isRecording ? (
              <>
                <button type="button" className="ff-tb-stop" onClick={stopRecording}>
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="1" y="1" width="10" height="10" rx="2" />
                  </svg>
                  Stop
                </button>
                {setLiveTranscriptEnabled ? (
                  <button
                    type="button"
                    className={`ff-tb-cc${liveTranscriptEnabled ? ' active' : ''}`}
                    onClick={() => setLiveTranscriptEnabled((p) => !p)}
                    title={liveTranscriptEnabled ? 'Wyłącz Whisper CC' : 'Włącz Whisper CC'}
                  >
                    CC
                  </button>
                ) : null}
                <span className="ff-tb-rec-badge">● REC</span>
              </>
            ) : isQueued ? (
              <span className="ff-tb-queued">{queueLabel}</span>
            ) : (
              <>
                <button
                  type="button"
                  className="ff-tb-record"
                  onClick={() => startRecording()}
                  disabled={!currentWorkspacePermissions?.canRecordAudio}
                >
                  <svg width="13" height="13" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <rect x="7" y="1" width="8" height="12" rx="4" fill="currentColor" />
                    <path
                      d="M3 10a8 8 0 0016 0"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <line
                      x1="11"
                      y1="18"
                      x2="11"
                      y2="21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Rozpocznij nagrywanie
                </button>
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════
           RECORDING ACTIVE HERO — only when recording
          ═══════════════════════════════════════════ */}

          {/* Live caption — shown when Speech Recognition returns interim text */}
          {isRecording && liveText ? (
            <div className="ff-live-block">
              <span className="ff-live-block-dot" />
              <p className="ff-live-block-text">{liveText}</p>
            </div>
          ) : isRecording && !speechRecognitionSupported && !liveTranscriptEnabled ? (
            <div className="ff-status-banner ff-status-warn">
              Transkrypcja live niedostępna — włącz CC, aby uzyskać podpisy na żywo przez Whisper.
            </div>
          ) : null}

          {/* Recording / processing status message */}
          {recordingMessage ? (
            <div
              className={`ff-status-banner${analysisStatus === 'error' ? ' ff-status-error' : ''}`}
            >
              <div style={{ flex: 1 }}>
                <span>{recordingMessage}</span>
                {pipelineProgressPercent > 0 &&
                  pipelineProgressPercent < 100 &&
                  analysisStatus !== 'error' && (
                    <div
                      style={{
                        height: 4,
                        background: 'rgba(255,255,255,0.1)',
                        marginTop: 8,
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pipelineProgressPercent}%`,
                          background: 'var(--accent, #3b82f6)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  )}
              </div>
              <button
                type="button"
                className="ff-status-dismiss-btn"
                onClick={() => setRecordingMessage('')}
                aria-label="Zamknij powiadomienie"
              >
                ×
              </button>
            </div>
          ) : null}

          {/* ── Brief panels ── */}
          {isEmptyTranscript ? (
            <div className="ff-status-banner ff-status-warn" data-testid="empty-transcript-banner">
              <div className="ff-status-detail-stack">
                <span>
                  {selectedRecording?.userMessage ||
                    'Nie wykryto wypowiedzi w nagraniu. Sprobuj ponownie transkrypcje albo sprawdz audio w odtwarzaczu.'}
                </span>
                {emptyTranscriptDiagnostics ? (
                  <span className="ff-status-detail-text">{emptyTranscriptDiagnostics}</span>
                ) : null}
                {selectedRecordingAudioQualitySummary ? (
                  <span className="ff-status-detail-text">
                    {selectedRecordingAudioQualitySummary}
                  </span>
                ) : null}
              </div>
              {retryStoredRecording && selectedMeeting && selectedRecording ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => retryStoredRecording(selectedMeeting, selectedRecording)}
                >
                  Ponow transkrypcje
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="ff-panels">
            {studioAnalysisTab === 'summary' && (
              <section className="panel studio-analysis-summary-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">AI ? podsumowanie</div>
                    <h2>Podsumowanie spotkania</h2>
                  </div>
                </div>

                {/* Share of Voice Visualizer */}
                {speakerStats.length > 0 && (
                  <div className="ff-sov-card">
                    <div className="ff-sov-card-head">
                      <h3>Udział w rozmowie (Share of Voice)</h3>
                      <span>{speakerStats.length} uczestników</span>
                    </div>
                    <div className="ff-sov-visual">
                      <div className="ff-sov-bar-track">
                        {speakerStats.map((s) => (
                          <div
                            key={s.speakerId}
                            className="ff-sov-bar-segment"
                            style={{
                              width: `${(s.speakingSeconds / (totalSpeakingSeconds || 1)) * 100}%`,
                              backgroundColor: getSpeakerColor(s.speakerId),
                            }}
                            title={`${s.speakerName}: ${Math.round((s.speakingSeconds / (totalSpeakingSeconds || 1)) * 100)}%`}
                          />
                        ))}
                      </div>
                      <div className="ff-sov-legend">
                        {speakerStats.map((s) => (
                          <div key={s.speakerId} className="ff-sov-legend-item">
                            <span
                              className="ff-sov-dot"
                              style={{ backgroundColor: getSpeakerColor(s.speakerId) }}
                            />
                            <span className="ff-sov-name">{s.speakerName}</span>
                            <span className="ff-sov-time">{formatDuration(s.speakingSeconds)}</span>
                            <span className="ff-sov-percent">
                              {Math.round((s.speakingSeconds / (totalSpeakingSeconds || 1)) * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {studioAnalysis?.summary ? (
                  <div className="panel-body ff-summary-layout">
                    <div className="summary-hero">
                      <div className="analysis-summary-text">{studioAnalysis.summary}</div>
                      {summaryBullets.length ? (
                        <ul className="summary-highlights">
                          {summaryBullets.map((item) => (
                            <li key={item.label} className="summary-highlight">
                              <span className="summary-highlight-icon" aria-hidden="true">
                                {item.icon}
                              </span>
                              <div className="summary-highlight-body">
                                <strong>{item.label}:</strong> <span>{item.value}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="sketchnote-section sketchnote-section-shell">
                        <div className="sketchnote-header">
                          <h3 className="sketchnote-title">🎨 Sketchnotka AI</h3>
                          {!sketchnoteUrl && (
                            <button
                              type="button"
                              className="primary-button"
                              onClick={handleGenerateSketchnote}
                              disabled={isGeneratingSketchnote || !selectedRecording?.id}
                            >
                              {isGeneratingSketchnote
                                ? 'Generowanie...'
                                : 'Wygeneruj sketchnotkę AI'}
                            </button>
                          )}
                        </div>

                        {sketchnoteError && (
                          <div className="inline-alert error">{sketchnoteError}</div>
                        )}

                        {sketchnoteUrl || sketchnoteFallbackSvg ? (
                          <div className="sketchnote-image-container sketchnote-image-frame">
                            {sketchnoteIsLocal && sketchnoteFallbackSvg ? (
                              <div
                                aria-label="Lokalna sketchnotka"
                                dangerouslySetInnerHTML={{ __html: sketchnoteFallbackSvg }}
                              />
                            ) : (
                              <img
                                src={sketchnoteUrl}
                                alt="AI Generated Sketchnote"
                                className="sketchnote-image"
                              />
                            )}
                            <button
                              className="ghost-button sketchnote-regenerate-btn"
                              onClick={handleGenerateSketchnote}
                              disabled={isGeneratingSketchnote}
                            >
                              {isGeneratingSketchnote ? 'Generowanie...' : 'Generuj ponownie'}
                            </button>
                          </div>
                        ) : (
                          <p className="soft-copy sketchnote-empty-copy">
                            Wygeneruj wizualną notatkę podsumowującą to spotkanie. Jeśli backend AI
                            jest niedostępny, pokażemy lokalny podgląd oparty na podsumowaniu i
                            punktach ze spotkania.
                          </p>
                        )}
                      </div>
                    </div>

                    {aiDebrief ? (
                      <section className="summary-card summary-card-spaced">
                        <div className="summary-card-head">
                          <h3>Debrief AI</h3>
                          <div className="summary-card-actions">
                            <span>{aiDebrief.followUps?.length || 0}</span>
                            <button type="button" className="ghost-button" onClick={copyAIDebrief}>
                              Kopiuj
                            </button>
                            {exportMeetingPdfFile ? (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={exportMeetingPdfFile}
                              >
                                PDF
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="analysis-summary-text summary-copy-spaced">
                          {aiDebrief.summary}
                        </div>
                        <div className="summary-grid summary-grid-tight">
                          <section className="summary-card summary-card-flush">
                            <div className="summary-card-head">
                              <h3>Decyzje</h3>
                              <span>{aiDebrief.decisions?.length || 0}</span>
                            </div>
                            {aiDebrief.decisions?.length ? (
                              <ul className="analysis-list summary-list-tight">
                                {aiDebrief.decisions.map((item, index) => (
                                  <li key={`debrief-decision-${index}`}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="soft-copy">Brak jednoznacznych decyzji.</p>
                            )}
                          </section>
                          <section className="summary-card summary-card-flush">
                            <div className="summary-card-head">
                              <h3>Ryzyka</h3>
                              <span>{aiDebrief.risks?.length || 0}</span>
                            </div>
                            {aiDebrief.risks?.length ? (
                              <ul className="analysis-list summary-list-tight">
                                {aiDebrief.risks.map((item, index) => (
                                  <li key={`debrief-risk-${index}`}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="soft-copy">Brak ryzyk do odnotowania.</p>
                            )}
                          </section>
                          <section className="summary-card summary-card-flush">
                            <div className="summary-card-head">
                              <h3>Następne kroki</h3>
                              <span>{aiDebrief.followUps?.length || 0}</span>
                            </div>
                            {aiDebrief.followUps?.length ? (
                              <ul className="analysis-list summary-list-tight">
                                {aiDebrief.followUps.map((item, index) => (
                                  <li key={`debrief-followup-${index}`}>{item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="soft-copy">Brak dodatkowych follow-upów.</p>
                            )}
                          </section>
                        </div>
                        {debriefCopyMessage ? (
                          <div className="inline-alert info summary-alert-spaced">
                            {debriefCopyMessage}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    <div className="summary-grid">
                      <section className="summary-card" style={{ overflow: 'visible' }}>
                        <div className="summary-card-head">
                          <h3>Uczestnicy</h3>
                          <span>{(selectedMeeting?.guests || []).length}</span>
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <TagInput
                            tags={selectedMeeting?.guests || []}
                            suggestions={allParticipants}
                            onChange={(newGuests) => {
                              updateMeeting?.(selectedMeeting?.id, { guests: newGuests });
                            }}
                            placeholder="Wpisz lub wybierz z listy..."
                          />
                        </div>
                      </section>

                      <section className="summary-card">
                        <div className="summary-card-head">
                          <h3>Decyzje</h3>
                          <span>{safeArray(studioAnalysis.decisions).length}</span>
                        </div>
                        {safeArray(studioAnalysis.decisions).length ? (
                          <ul className="analysis-list summary-list-tight">
                            {studioAnalysis.decisions.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="soft-copy">Brak wykrytych decyzji.</p>
                        )}
                      </section>
                      <section className="summary-card">
                        <div className="summary-card-head">
                          <h3>Nastepne kroki</h3>
                          <span>{followUps.length}</span>
                        </div>
                        {followUps.length ? (
                          <ul className="analysis-list summary-list-tight">
                            {followUps.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="soft-copy">Brak dodatkowych krokow.</p>
                        )}
                      </section>

                      <section className="summary-card">
                        <div className="summary-card-head">
                          <h3>Ryzyka i blokery</h3>
                          <span>{risks.length + blockers.length + tensions.length}</span>
                        </div>
                        {risks.length || blockers.length || tensions.length ? (
                          <div className="summary-stack">
                            {risks.map((item, i) => (
                              <article key={`risk-${i}`} className="summary-pill-card danger">
                                {item.risk}
                              </article>
                            ))}
                            {blockers.map((item, i) => (
                              <article key={`blocker-${i}`} className="summary-pill-card warning">
                                {item}
                              </article>
                            ))}
                            {tensions.map((item, i) => (
                              <article key={`tension-${i}`} className="summary-pill-card">
                                {item.topic ? <strong>{item.topic}</strong> : null}
                                <span>
                                  {Array.isArray(item.between) && item.between.length
                                    ? item.between.join(' vs ')
                                    : 'Sprawa do wyjaśnienia'}
                                  {item.resolved ? ' - rozwiązane' : ' - otwarte'}
                                </span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="soft-copy">Brak ryzyk i blokad.</p>
                        )}
                      </section>
                    </div>
                  </div>
                ) : isEmptyTranscript ? (
                  <div className="panel-body">
                    <div className="analysis-summary-text">
                      {selectedRecording?.userMessage ||
                        'Nie wykryto wypowiedzi w nagraniu. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem.'}
                    </div>
                    {selectedRecordingAudioQualitySummary ? (
                      <div className="analysis-summary-diagnostics">
                        {selectedRecordingAudioQualitySummary}
                      </div>
                    ) : null}
                    {retryStoredRecording && selectedMeeting && selectedRecording ? (
                      <div className="analysis-summary-retry">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => retryStoredRecording(selectedMeeting, selectedRecording)}
                        >
                          Ponow transkrypcje
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="panel-body">
                    <p className="soft-copy">
                      Automatyczne podsumowanie AI pojawi sie po zakonczeniu analizy.
                    </p>
                  </div>
                )}
              </section>
            )}
            {studioAnalysisTab === 'needs' && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <h2>Potrzeby i obawy</h2>
                  </div>
                </div>
                <div className="brief-columns two-col">
                  <div className="brief-col">
                    <div className="brief-col-head">
                      <span className="brief-col-label">Potrzeby</span>
                      <button
                        type="button"
                        className="what-matters-add-btn"
                        onClick={() => setAddNeedOpen((v) => !v)}
                        title="Dodaj potrzebę"
                      >
                        +
                      </button>
                    </div>
                    {addNeedOpen && (
                      <form
                        className="what-matters-add-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!needDraft.trim()) return;
                          const current = meetingDraft?.needs || '';
                          const updated = current
                            ? current.trim() + '\n' + needDraft.trim()
                            : needDraft.trim();
                          const newDraft = { ...meetingDraft, needs: updated };
                          setMeetingDraft(() => newDraft);
                          setNeedDraft('');
                          setAddNeedOpen(false);
                          saveMeeting(newDraft);
                        }}
                      >
                        <input
                          autoFocus
                          value={needDraft}
                          onChange={(e) => setNeedDraft(e.target.value)}
                          placeholder="np. Potrzebuję wybudować dom"
                        />
                        <button type="submit" className="ghost-button">
                          Dodaj
                        </button>
                      </form>
                    )}
                    <ul className="clean-list">
                      {(selectedMeeting?.needs || []).length ? (
                        selectedMeeting?.needs.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li className="soft-copy">Brak potrzeb.</li>
                      )}
                    </ul>
                  </div>

                  <div className="brief-col">
                    <div className="brief-col-head">
                      <span className="brief-col-label">Obawy</span>
                      <button
                        type="button"
                        className="what-matters-add-btn concern"
                        onClick={() => setAddConcernOpen((v) => !v)}
                        title="Dodaj obawę"
                      >
                        +
                      </button>
                    </div>
                    {addConcernOpen && (
                      <form
                        className="what-matters-add-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!concernDraft.trim()) return;
                          const current = meetingDraft?.concerns || '';
                          const updated = current
                            ? current.trim() + '\n' + concernDraft.trim()
                            : concernDraft.trim();
                          const newDraft = { ...meetingDraft, concerns: updated };
                          setMeetingDraft(() => newDraft);
                          setConcernDraft('');
                          setAddConcernOpen(false);
                          saveMeeting(newDraft);
                        }}
                      >
                        <input
                          autoFocus
                          value={concernDraft}
                          onChange={(e) => setConcernDraft(e.target.value)}
                          placeholder="np. Mam ograniczony budżet"
                        />
                        <button type="submit" className="ghost-button">
                          Dodaj
                        </button>
                      </form>
                    )}
                    <ul className="clean-list">
                      {(selectedMeeting?.concerns || []).length ? (
                        (selectedMeeting?.concerns || []).map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li className="soft-copy">Brak obaw.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {studioAnalysis?.answersToNeeds?.length > 0 && (
                  <div className="analysis-section analysis-section-padded">
                    <div className="eyebrow">AI — analiza potrzeb</div>
                    <h3>Odpowiedzi na potrzeby</h3>
                    <ul className="analysis-list">
                      {studioAnalysis.answersToNeeds.map((item, i) => (
                        <li key={i}>
                          <strong className="analysis-need-label">{item.need}:</strong>{' '}
                          {item.answer}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {studioAnalysisTab === 'profile' && (
              <section className="panel studio-psychological-profile-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">AI — profile</div>
                    <h2>Profil psychologiczny</h2>
                  </div>
                </div>
                {studioAnalysis?.participantInsights?.length > 0 ? (
                  <div className="panel-body">
                    <div className="insights-grid-v2">
                      {studioAnalysis.participantInsights.map((insight, i) => {
                        const disc = insight.personality ?? {};
                        const sentiment = insight.sentimentScore ?? 0;
                        const sentColor =
                          sentiment >= 70 ? '#67d59f' : sentiment >= 40 ? '#f3ca72' : '#f17d72';
                        return (
                          <article key={i} className="insight-card-v2">
                            {/* Header */}
                            <div className="icard-header">
                              <div className="icard-identity">
                                <h3 className="icard-name">{insight.speaker}</h3>
                                {insight.meetingRole && (
                                  <span className="icard-role-badge">{insight.meetingRole}</span>
                                )}
                              </div>
                              {insight.sentimentScore != null && (
                                <div
                                  className="icard-sentiment"
                                  title={`Zaangażowanie: ${sentiment}/100`}
                                >
                                  <span
                                    className="icard-sentiment-dot"
                                    style={{ background: sentColor }}
                                  />
                                  <span
                                    className="icard-sentiment-val"
                                    style={{ color: sentColor }}
                                  >
                                    {sentiment}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* DISC radar + bars */}
                            {(disc.D != null ||
                              disc.I != null ||
                              disc.S != null ||
                              disc.C != null) && (
                              <div className="icard-disc-row">
                                <DiscRadarChart D={disc.D} I={disc.I} S={disc.S} C={disc.C} />
                                <div className="icard-disc-info">
                                  {insight.discStyle && (
                                    <div className="icard-disc-style">{insight.discStyle}</div>
                                  )}
                                  {insight.discDescription && (
                                    <p className="icard-disc-desc">{insight.discDescription}</p>
                                  )}
                                  <div className="icard-disc-bars">
                                    {(['D', 'I', 'S', 'C'] as const).map((k) => {
                                      const v = disc[k] ?? 0;
                                      return (
                                        <div key={k} className="icard-disc-bar-row">
                                          <span
                                            className="icard-disc-bar-label"
                                            style={{ color: DISC_COLORS[k] }}
                                          >
                                            {k}
                                          </span>
                                          <div className="icard-disc-bar-track">
                                            <div
                                              className="icard-disc-bar-fill"
                                              style={{ width: `${v}%`, background: DISC_COLORS[k] }}
                                            />
                                          </div>
                                          <span className="icard-disc-bar-val">{v}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Podejście */}
                            {(insight.communicationStyle || insight.decisionStyle) && (
                              <div className="icard-section">
                                <div className="icard-section-label">Podejście</div>
                                <div className="icard-approach-grid">
                                  {insight.communicationStyle && (
                                    <div className="icard-approach-item">
                                      <span className="icard-approach-key">Komunikacja</span>
                                      <span className="icard-approach-val">
                                        {COMM_LABELS[insight.communicationStyle] ??
                                          insight.communicationStyle}
                                      </span>
                                    </div>
                                  )}
                                  {insight.decisionStyle && (
                                    <div className="icard-approach-item">
                                      <span className="icard-approach-key">Decyzje</span>
                                      <span className="icard-approach-val">
                                        {DECISION_LABELS[insight.decisionStyle] ??
                                          insight.decisionStyle}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Pod presją */}
                            {insight.stressResponse && (
                              <div className="icard-section">
                                <div className="icard-section-label">Pod presją</div>
                                <p className="icard-section-body">{insight.stressResponse}</p>
                              </div>
                            )}

                            {/* Jak pracować */}
                            {(insight.workingWithTips?.length ?? 0) > 0 && (
                              <div className="icard-section">
                                <div className="icard-section-label">Jak pracować z tą osobą</div>
                                <ul className="icard-tips-list">
                                  {insight.workingWithTips!.map((tip, j) => (
                                    <li key={j}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* W tym spotkaniu */}
                            <div className="icard-section">
                              <div className="icard-section-label">W tym spotkaniu</div>
                              <div className="icard-meeting-row">
                                {insight.talkRatio != null && (
                                  <div className="icard-talk-ratio">
                                    <span className="icard-talk-pct">
                                      {(insight.talkRatio * 100).toFixed(0)}%
                                    </span>
                                    <span className="icard-talk-label">głosu</span>
                                  </div>
                                )}
                                <div className="icard-meeting-text">
                                  {insight.mainTopic && (
                                    <div className="icard-main-topic">{insight.mainTopic}</div>
                                  )}
                                  {insight.stance && (
                                    <div className="icard-stance">
                                      Nastawienie: <strong>{insight.stance}</strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {insight.keyMoment && (
                                <blockquote className="icard-key-moment">
                                  „{insight.keyMoment}"
                                </blockquote>
                              )}
                            </div>

                            {/* Potrzeby i obawy */}
                            {((insight.needs?.length ?? 0) > 0 ||
                              (insight.concerns?.length ?? 0) > 0) && (
                              <div className="icard-section">
                                <div className="icard-section-label">Potrzeby i obawy</div>
                                {(insight.needs?.length ?? 0) > 0 && (
                                  <div className="icard-chips">
                                    {insight.needs!.map((n, j) => (
                                      <span key={j} className="icard-chip icard-chip--need">
                                        {n}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {(insight.concerns?.length ?? 0) > 0 && (
                                  <div className="icard-chips icard-chips--concerns">
                                    {insight.concerns!.map((c, j) => (
                                      <span key={j} className="icard-chip icard-chip--concern">
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="panel-body">
                    <p className="soft-copy">
                      Analiza profilu psychologicznego uczestników pojawi się tutaj.
                    </p>
                  </div>
                )}
              </section>
            )}

            {studioAnalysisTab === 'feedback' && (
              <section className="panel studio-feedback-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">AI — feedback</div>
                    <h2>Twój feedback</h2>
                  </div>
                  <div
                    className="feedback-score-badge"
                    aria-label={`Ocena spotkania ${feedbackView.overallScore} na 10`}
                  >
                    {feedbackView.overallScore}/10
                  </div>
                </div>
                <div className="panel-body feedback-panel-body">
                  <div className="feedback-hero">
                    <div className="feedback-score-card">
                      <div className="feedback-score-ring">
                        <span>{feedbackView.overallScore}</span>
                        <small>/10</small>
                      </div>
                      <div className="feedback-score-copy">
                        <div className="feedback-score-kicker">Ocena całego spotkania</div>
                        <strong>{feedbackView.summary}</strong>
                        {feedbackIsSparse ? (
                          <p className="feedback-sparse-note">
                            Za mało danych, aby ocenić dokładniej. Oceny są orientacyjne.
                          </p>
                        ) : null}
                        {feedbackView.strengths?.length ? (
                          <p className="feedback-mini-note">
                            Najmocniejsze strony:{' '}
                            <strong>{feedbackView.strengths.slice(0, 2).join(' · ')}</strong>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="feedback-highlight-card">
                      <div className="feedback-highlight-label">Najlepsza rzecz do poprawy</div>
                      <p>
                        {feedbackView.improvementAreas[0] ||
                          feedbackView.whatCouldBeBetter[0] ||
                          'Mocniej domykaj decyzje, ownera i termin po każdym ważnym wątku.'}
                      </p>
                    </div>
                  </div>

                  <div className="feedback-grid">
                    <article className="feedback-card feedback-card-good">
                      <div className="feedback-card-head">
                        <span className="feedback-card-icon success">✓</span>
                        <h3>Co poszło dobrze</h3>
                      </div>
                      <ul className="feedback-list">
                        {feedbackView.whatWentWell.map((item, index) => (
                          <li key={`went-${index}`}>
                            <strong>{item}</strong>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="feedback-card feedback-card-better">
                      <div className="feedback-card-head">
                        <span className="feedback-card-icon warning">↗</span>
                        <h3>Co można poprawić</h3>
                      </div>
                      <ul className="feedback-list">
                        {feedbackView.whatCouldBeBetter.map((item, index) => (
                          <li key={`better-${index}`}>
                            <strong>{item}</strong>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="feedback-card feedback-card-perception">
                      <div className="feedback-card-head">
                        <span className="feedback-card-icon info">👀</span>
                        <h3>Jak możesz być odbierany</h3>
                      </div>
                      <ul className="feedback-list">
                        {feedbackView.perceptionNotes.map((item, index) => (
                          <li key={`perception-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </article>

                    <article className="feedback-card feedback-card-communication">
                      <div className="feedback-card-head">
                        <span className="feedback-card-icon accent">🗣</span>
                        <h3>Jak przekazywać lepiej</h3>
                      </div>
                      <ul className="feedback-list">
                        {feedbackView.communicationTips.map((item, index) => (
                          <li key={`tip-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  </div>

                  <div className="feedback-category-block">
                    <div className="feedback-category-head">
                      <h3>Oceny 1-10</h3>
                      <span>Całe spotkanie, nie pojedyncze osoby</span>
                    </div>
                    <div className="feedback-category-grid">
                      {feedbackView.categoryScores.map((category) => (
                        <article key={category.key} className="feedback-category-card">
                          <div className="feedback-category-top">
                            <div>
                              <div className="feedback-category-label">{category.label}</div>
                              <div className="feedback-category-observation">
                                {category.observation}
                              </div>
                            </div>
                            <div className="feedback-category-score">{category.score}/10</div>
                          </div>
                          <div className="feedback-category-tip">
                            <strong>Co poprawić:</strong> {category.improvementTip}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="feedback-grid feedback-grid-bottom">
                    <article className="feedback-card feedback-card-next">
                      <div className="feedback-card-head">
                        <span className="feedback-card-icon neutral">→</span>
                        <h3>Następne kroki</h3>
                      </div>
                      <ul className="feedback-list">
                        {feedbackView.nextSteps.map((item, index) => (
                          <li key={`next-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  </div>
                </div>
              </section>
            )}
            {studioAnalysisTab === 'tasks' && (
              <section className="panel studio-tasks-panel">
                <div className="panel-header compact">
                  <div>
                    <h2>Zadania po spotkaniu</h2>
                  </div>
                </div>

                <div className="panel-body">
                  <section className="summary-card summary-card-wide studio-meeting-task-card">
                    <div className="summary-card-head">
                      <h3>Zadania utworzone z tego spotkania</h3>
                      <span>{meetingTaskEntries.length}</span>
                    </div>
                    {meetingTaskEntries.length ? (
                      <ul className="meeting-task-list">
                        {meetingTaskEntries.map((task) => (
                          <li key={task.id} className="meeting-task-item">
                            <div className="meeting-task-open">
                              <div className="meeting-task-title-row">
                                <strong>{task.title}</strong>
                                <span className="task-flag neutral">
                                  {task.priority === 'high'
                                    ? 'Wysoki'
                                    : task.priority === 'low'
                                      ? 'Niski'
                                      : 'Sredni'}
                                </span>
                              </div>
                              {task.description ? <p>{task.description}</p> : null}
                              <div className="meeting-task-meta">
                                {task.owner ? <span>@{task.owner}</span> : null}
                                {task.dueDate ? <span>{task.dueDate}</span> : null}
                                {task.tags?.length ? (
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: '4px',
                                      flexWrap: 'wrap',
                                      marginTop: '4px',
                                    }}
                                  >
                                    {task.tags.map((tag) => (
                                      <TagBadge key={tag} tag={tag} />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="meeting-task-actions">
                                <button
                                  type="button"
                                  className="meeting-task-link"
                                  onClick={() => goToTasksTab(task.id)}
                                >
                                  Przejdź do zadań
                                </button>
                                <button
                                  type="button"
                                  className="meeting-task-link secondary"
                                  onClick={() => openMeetingTaskDetails(task.id)}
                                >
                                  Otwórz szczegóły
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="soft-copy">Brak zapisanych zadan z tego spotkania.</p>
                    )}
                  </section>
                </div>

                <Suspense
                  fallback={<div className="soft-copy">Ładowanie AI Task Suggestions...</div>}
                >
                  <AiTaskSuggestionsPanel
                    selectedRecording={selectedRecording}
                    displaySpeakerNames={displaySpeakerNames}
                    peopleProfiles={peopleProfiles}
                    onCreateTask={onCreateTask}
                    canEdit={currentWorkspacePermissions?.canEditWorkspace}
                  />
                </Suspense>
              </section>
            )}
          </div>
          {/* /ff-panels */}
        </div>
        {/* /ff-studio-left-col */}

        {/* RIGHT COLUMN: Transcript */}
        <div className="ff-studio-right-col">
          {/* Section header */}
          <div className="ff-sticky-header ff-sticky-header-shell">
            <div className="ff-tabs ff-tabs-shell">
              <div className="ff-tabs-group">
                <button className="ff-tab active" type="button">
                  Transkrypcja
                </button>
              </div>

              {transcript.length > 0 && remoteApiEnabled() && (
                <button
                  type="button"
                  className="ff-sidebar-action-btn ff-sidebar-action-btn-centered"
                  onClick={handleRediarize}
                  disabled={rediarizing}
                  title="Wykryj mówców ponownie za pomocą GPT-4o-mini"
                >
                  {rediarizing ? '…' : 'Wykryj mówców'}
                </button>
              )}
            </div>

            {/* Search */}
            <div className="ff-search-bar ff-search-bar-stretch">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Szukaj lub zamień..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
              />
            </div>
          </div>

          {rediarizeMsg ? <p className="ff-rediarize-msg">{rediarizeMsg}</p> : null}

          {voiceProfileToast ? (
            <p className="ff-voice-profile-toast">
              ✓ Profil głosowy zapisany dla <strong>{voiceProfileToast}</strong>
            </p>
          ) : null}

          {/* Voice analytics panel — collapsible, shown only when transcript is available */}
          {transcript.length > 0 ? (
            <div className="ff-voice-analytics ff-voice-analytics-top">
              <button
                type="button"
                className="ff-voice-analytics-toggle"
                onClick={() => setVoiceStatsOpen((p) => !p)}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <rect x="1" y="4" width="2" height="7" rx="1" fill="currentColor" />
                  <rect x="5" y="2" width="2" height="9" rx="1" fill="currentColor" />
                  <rect x="9" y="5" width="2" height="6" rx="1" fill="currentColor" />
                </svg>
                Voice analytics
                <svg
                  className={voiceStatsOpen ? 'ff-chevron open' : 'ff-chevron'}
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 4l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {voiceStatsOpen ? (
                <VoiceSpeakerStats
                  transcript={transcript}
                  displaySpeakerNames={displaySpeakerNames}
                  recordingId={selectedRecording?.id}
                />
              ) : null}
            </div>
          ) : null}

          {/* Segments list */}
          <div className="transcript-list transcript-list-fill">
            {filteredTranscript.length ? (
              <Virtuoso
                ref={virtuosoRef}
                data={filteredTranscript}
                className="transcript-virtuoso"
                itemContent={(index, seg) => {
                  const isActive = activeSeg?.id === seg.id;
                  const name = labelSpeaker(displaySpeakerNames, seg.speakerId);
                  const letter = (name || 'S')[0].toUpperCase();
                  const color = getSpeakerColor(seg.speakerId);
                  return (
                    <div
                      key={seg.id}
                      className={`fireflies-segment${isActive ? ' active' : ''} fireflies-segment-spaced`}
                    >
                      <div className="fireflies-avatar" style={{ background: color }}>
                        {letter}
                      </div>

                      <div className="fireflies-content">
                        <div className="fireflies-header">
                          <div className="ff-speaker-picker-wrap ff-speaker-picker-inline">
                            {renamingSpeakerId === String(seg.speakerId) ? (
                              <input
                                className="ff-speaker-rename-input"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => {
                                  const name = renameValue.trim();
                                  if (name) commitSpeakerRename(seg.speakerId, name);
                                  setRenamingSpeakerId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as any).blur();
                                  if (e.key === 'Escape') {
                                    setRenamingSpeakerId(null);
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="ff-speaker-trigger"
                                  onClick={() =>
                                    setSpeakerDropdownSegId(
                                      speakerDropdownSegId === seg.id ? null : seg.id
                                    )
                                  }
                                >
                                  <span className="fireflies-speaker">{name}</span>
                                  <svg
                                    className="fireflies-chevron"
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="m6 9 6 6 6-6" />
                                  </svg>
                                </button>
                                {speakerDropdownSegId === seg.id ? (
                                  <SpeakerDropdown
                                    seg={seg}
                                    currentSpeakerId={String(seg.speakerId ?? '')}
                                    speakers={uniqueSpeakers}
                                    nextSpeakerId={nextSpeakerId}
                                    displaySpeakerNames={displaySpeakerNames}
                                    onReassign={(newId) => reassignSegmentSpeaker(seg.id, newId)}
                                    onRename={(sid) => {
                                      setSpeakerDropdownSegId(null);
                                      setRenamingSpeakerId(String(sid));
                                      setRenameValue(labelSpeaker(displaySpeakerNames, sid));
                                    }}
                                    onClose={() => setSpeakerDropdownSegId(null)}
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                          <span className="fireflies-dot">·</span>
                          <button
                            type="button"
                            className="fireflies-time"
                            onClick={() => {
                              if (audioRef.current) audioRef.current.currentTime = seg.timestamp;
                            }}
                          >
                            {formatDuration(Math.floor(seg.timestamp))}
                          </button>
                        </div>
                        <div className="fireflies-text-area">
                          <textarea
                            className="fireflies-textarea"
                            value={seg.text}
                            onChange={(e) =>
                              updateTranscriptSegment(seg.id, { text: e.target.value })
                            }
                            rows={Math.max(1, Math.ceil(seg.text.length / 80))}
                            spellCheck="false"
                          />
                        </div>

                        <div className="fireflies-actions">
                          <button type="button" className="icon-button" aria-label="Copy">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              viewBox="0 0 24 24"
                            >
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Create Soundbite"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" x2="12" y1="19" y2="22" />
                            </svg>
                          </button>
                          <label className="fireflies-select" title="Zaznacz">
                            <input type="checkbox" />
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="ff-segments-empty">
                {transcript.length ? (
                  <>
                    <svg
                      className="ff-empty-icon"
                      width="36"
                      height="36"
                      viewBox="0 0 36 36"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="1.2" />
                      <path
                        d="M12 18h12M15 13h6M15 23h6"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p>Brak wyników wyszukiwania.</p>
                  </>
                ) : (
                  <>
                    <svg
                      className="ff-empty-icon"
                      width="40"
                      height="40"
                      viewBox="0 0 40 40"
                      fill="none"
                      aria-hidden="true"
                    >
                      <rect
                        x="8"
                        y="4"
                        width="24"
                        height="32"
                        rx="4"
                        stroke="currentColor"
                        strokeWidth="1.3"
                      />
                      <path
                        d="M14 13h12M14 19h12M14 25h7"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                      <path
                        d="M8 28c3-3 6-1 8-4s3-5 4-5 2 3 4 5 5 1 8 4"
                        stroke="currentColor"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                        opacity=".45"
                      />
                    </svg>
                    <p>
                      Brak transkrypcji
                      <br />
                      dla tego nagrania.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {/* /ff-studio-right-col */}
      </div>
      {/* /ff-studio-split-view */}

      {/* ═══════════════════════════════════════════
           RECORDING ACTIVE HERO — only when recording
          ═══════════════════════════════════════════ */}
      {/* STANDALONE RECORDING HERO REMOVED — MOVED TO PLAYER BAR BELOW */}

      {/* ═══════════════════════════════════════════
           PLAYER BAR — ALWAYS visible — at bottom
          ═══════════════════════════════════════════ */}
      {shouldShowPlayerBar && (
        <div className="ff-player-bar">
          {playerState === 'recording' ? (
            <div className="ff-player-status-wrap recording-active">
              <div className="ff-rec-vis-row">
                <div
                  className="ff-rec-pulse-ring ff-rec-pulse-ring-sm"
                  style={{ animation: isPaused ? 'none' : undefined }}
                >
                  <svg width="14" height="14" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <rect x="7" y="1" width="8" height="12" rx="4" fill="currentColor" />
                    <path
                      d="M3 10a8 8 0 0016 0"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <line
                      x1="11"
                      y1="18"
                      x2="11"
                      y2="21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="ff-rec-wave-inline ff-rec-wave-inline-sm">
                  {visualBars.slice(-18).map((h, i) => (
                    <span
                      key={i}
                      className="ff-capture-bar"
                      style={{
                        height: Math.max(3, Math.round(h * 0.35)) + 'px',
                        opacity: isPaused ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="ff-rec-timer-xl ff-rec-timer-xl-compact">
                {formatDuration(elapsed)}
              </div>

              <div className={`ff-player-status-label ${isPaused ? 'is-paused' : 'is-recording'}`}>
                {isPaused ? 'Wstrzymano' : 'Nagrywanie...'}
              </div>

              {voiceActivityStatus !== 'unsupported' ? (
                <div className={`ff-vad-pill ${voiceActivityStatus === 'active' ? 'active' : ''}`}>
                  {voiceActivityStatus === 'active' ? 'VAD: glos wykryty' : 'VAD: cisza'}
                </div>
              ) : null}

              <div className="ff-player-recording-actions">
                <button
                  type="button"
                  className="ff-tb-btn ff-recording-toggle-btn"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                >
                  {isPaused ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2l10 6-10 6z" />
                      </svg>
                      Wznów
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="3" y="2" width="4" height="12" rx="1" />
                        <rect x="9" y="2" width="4" height="12" rx="1" />
                      </svg>
                      Wstrzymaj
                    </>
                  )}
                </button>
                <button type="button" className="ff-tb-stop" onClick={stopRecording}>
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="1" y="1" width="10" height="10" rx="2" />
                  </svg>
                  Zakończ
                </button>
              </div>
              {silenceCountdown != null && (
                <div className="ff-silence-countdown">
                  <span>Zatrzymanie za {silenceCountdown}s — cisza wykryta</span>
                  <button
                    type="button"
                    className="ghost-button ff-silence-continue-btn"
                    onClick={resetSilenceTimer}
                  >
                    Kontynuuj
                  </button>
                </div>
              )}
            </div>
          ) : playerState === 'queued' ? (
            <div className="ff-player-status-wrap">
              <RecordingPipelineStatus
                status={
                  analysisStatus === 'error' ||
                  analysisStatus === 'failed' ||
                  activeQueueItem?.status === 'failed'
                    ? 'failed'
                    : activeQueueItem?.status || 'processing'
                }
                errorMessage={
                  activeQueueItem?.errorMessage ||
                  (analysisStatus === 'error' || analysisStatus === 'failed'
                    ? 'Błąd analizy nagrania'
                    : undefined)
                }
                onRetry={
                  activeQueueItem
                    ? () => retryRecordingQueueItem(activeQueueItem.recordingId)
                    : undefined
                }
                progressMessage={queueLabel}
                progressPercent={pipelineProgressPercent}
                stageLabel={pipelineStageLabel}
              />
            </div>
          ) : playerState === 'loading-audio' ? (
            <div className="ff-player-status-wrap" data-testid="player-loading-audio">
              <span className="ff-player-time">Ladowanie audio...</span>
            </div>
          ) : playerState === 'audio-error' ? (
            <div className="ff-player-status-wrap" data-testid="player-audio-error">
              <span className="ff-player-time">Nie udalo sie zaladowac audio.</span>
              {selectedRecordingAudioError ? (
                <span className="soft-copy ff-audio-error-copy">{selectedRecordingAudioError}</span>
              ) : null}
              {selectedRecording?.id && hydrateRecordingAudio ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    clearAudioHydrationError?.(selectedRecording.id);
                    hydrateRecordingAudio(selectedRecording.id, {
                      force: true,
                      priority: true,
                    }).catch(() => {});
                  }}
                >
                  Sprobuj ponownie
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="ff-player-main">
                <div className="ff-player-progress-row">
                  <div className="ff-player-scrubber-container ff-player-scrubber-container-shell">
                    {hoverTime !== null && (
                      <div className="ff-player-hover-time" style={{ left: `${hoverPos}px` }}>
                        {formatDuration(Math.floor(hoverTime))}
                      </div>
                    )}
                    <input
                      type="range"
                      className="ff-player-scrubber"
                      aria-label="Pozycja odtwarzania"
                      min={0}
                      max={scrubberMax}
                      step={0.1}
                      value={scrubberValue}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percent = x / rect.width;
                        setHoverTime(percent * playbackDuration);
                        setHoverPos(x);
                      }}
                      onMouseLeave={() => setHoverTime(null)}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value || 0);
                        setCurrentTime(nextValue);
                        if (audioRef.current) {
                          audioRef.current.currentTime = nextValue;
                        }
                      }}
                      style={
                        { '--ff-player-progress': `${scrubberProgress}%` } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
                <div className="ff-player-controls">
                  <button type="button" className="ff-player-speed" onClick={cyclePlaybackRate}>
                    {playbackRate}×
                  </button>
                  <button
                    type="button"
                    className="ff-player-ctrl"
                    onClick={() => {
                      if (audioRef.current)
                        audioRef.current.currentTime = Math.max(0, currentTime - 15);
                    }}
                    title="-15s"
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 3V1L3.5 4 8 7V5a5 5 0 110 6H5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <text
                        x="4"
                        y="12.5"
                        fontSize="5.5"
                        fill="currentColor"
                        fontFamily="sans-serif"
                        fontWeight="700"
                      >
                        15
                      </text>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ff-player-play"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pauza' : 'Odtworsz'}
                  >
                    {isPlaying ? (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect x="3" y="2" width="4" height="12" rx="1.5" />
                        <rect x="9" y="2" width="4" height="12" rx="1.5" />
                      </svg>
                    ) : (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M4 2l10 6-10 6z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="ff-player-ctrl"
                    onClick={() => {
                      if (audioRef.current)
                        audioRef.current.currentTime = Math.min(audioDuration, currentTime + 15);
                    }}
                    title="+15s"
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 3V1l4.5 3L8 7V5a5 5 0 100 6h3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                      <text
                        x="4"
                        y="12.5"
                        fontSize="5.5"
                        fill="currentColor"
                        fontFamily="sans-serif"
                        fontWeight="700"
                      >
                        15
                      </text>
                    </svg>
                  </button>
                  <a
                    className="ff-player-ctrl"
                    href={selectedRecordingAudioUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!selectedRecordingAudioUrl) return;
                      fetch(selectedRecordingAudioUrl)
                        .then((res) => res.blob())
                        .then((blob) => {
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          const safeTitle = (
                            selectedMeeting?.title ||
                            displayRecording?.title ||
                            'nagranie'
                          ).replace(/[^a-z0-9_-]/gi, '_');
                          a.download = `${safeTitle}.mp3`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        })
                        .catch(() => {
                          window.open(selectedRecordingAudioUrl, '_blank');
                        });
                    }}
                    title="Pobierz MP3"
                  >
                    <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 2v8M5 8l3 4 3-4M2 14h12"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </a>
                  <span className="ff-player-time-display">
                    {formatDuration(Math.floor(currentTime))} /{' '}
                    {formatDuration(Math.floor(playbackDuration))}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {pendingVoiceProfileEnrollment ? (
        <div className="ff-modal-overlay" onClick={() => setPendingVoiceProfileEnrollment(null)}>
          <div className="ff-modal-card ff-enrollment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ff-modal-header">
              <h2 className="ff-modal-title">Zapisac probke glosu?</h2>
              <button
                className="ff-modal-close"
                onClick={() => setPendingVoiceProfileEnrollment(null)}
              >
                x
              </button>
            </div>
            <div className="ff-modal-body">
              <p className="ff-enrollment-copy">
                Zmieniono nazwe mowcy na{' '}
                <strong>{pendingVoiceProfileEnrollment.speakerName}</strong>. Mozemy zapisac te
                probke jako aktualizacje profilu glosu, zeby kolejne spotkania byly lepiej
                rozpoznawane.
              </p>
              <p className="ff-enrollment-copy muted">
                Jesli chcesz robic to bez pytania, wlacz `Auto-learn speaker profiles` w Profilu.
              </p>
            </div>
            <div className="ff-modal-footer">
              <button
                className="ghost-button"
                onClick={() => setPendingVoiceProfileEnrollment(null)}
              >
                Pomin
              </button>
              <button
                className="ff-modal-download-btn"
                onClick={async () => {
                  const pending = pendingVoiceProfileEnrollment;
                  setPendingVoiceProfileEnrollment(null);
                  await enrollSpeakerProfile(pending.speakerId, pending.speakerName);
                }}
              >
                Zapisz do profilu glosu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDownloadModalOpen && (
        <div className="ff-modal-overlay" onClick={() => setIsDownloadModalOpen(false)}>
          <div className="ff-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ff-modal-header">
              <h2 className="ff-modal-title">Download Meeting</h2>
              <button className="ff-modal-close" onClick={() => setIsDownloadModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="ff-modal-tabs">
              <button
                className={`ff-modal-tab-btn ${downloadTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setDownloadTab('transcript')}
              >
                Transcript
              </button>
              <button
                className={`ff-modal-tab-btn ${downloadTab === 'summary' ? 'active' : ''}`}
                onClick={() => setDownloadTab('summary')}
              >
                Summary
              </button>
              <button
                className={`ff-modal-tab-btn ${downloadTab === 'audio' ? 'active' : ''}`}
                onClick={() => setDownloadTab('audio')}
              >
                Audio
              </button>
            </div>

            <div className="ff-modal-body">
              {downloadTab !== 'audio' && (
                <div className="ff-modal-format-grid">
                  {['PDF', 'DOCX', 'SRT', 'CSV', 'JSON', 'MD'].map((f) => (
                    <button
                      key={f}
                      className={`ff-modal-format-btn ${downloadFormat === f ? 'active' : ''}`}
                      onClick={() => setDownloadFormat(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              <div className="ff-modal-options">
                {downloadTab === 'transcript' && (
                  <>
                    <label className="ff-modal-label">
                      <input
                        type="checkbox"
                        className="ff-modal-checkbox"
                        checked={includeTimestamp}
                        onChange={(e) => setIncludeTimestamp(e.target.checked)}
                      />
                      Include timestamp
                    </label>
                    <label className="ff-modal-label">
                      <input
                        type="checkbox"
                        className="ff-modal-checkbox"
                        checked={showSpeakerName}
                        onChange={(e) => setShowSpeakerName(e.target.checked)}
                      />
                      Show speaker name
                    </label>
                  </>
                )}
                <label className="ff-modal-label">
                  <input
                    type="checkbox"
                    className="ff-modal-checkbox"
                    checked={removeBranding}
                    onChange={(e) => setRemoveBranding(e.target.checked)}
                  />
                  Remove Antigravity Branding
                </label>
              </div>
            </div>

            <div className="ff-modal-footer">
              <button
                className="ff-modal-download-btn"
                onClick={handleDownload}
                disabled={downloadTab === 'audio' && !selectedRecordingAudioUrl}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

StudioMeetingView.propTypes = {
  selectedMeeting: PropTypes.object,
  displayRecording: PropTypes.object,
  studioAnalysis: PropTypes.object,
  isRecording: PropTypes.bool,
  analysisStatus: PropTypes.string,
  activeQueueItem: PropTypes.object,
  selectedMeetingQueue: PropTypes.array,
  elapsed: PropTypes.number,
  visualBars: PropTypes.array,
  voiceActivityStatus: PropTypes.string,
  stopRecording: PropTypes.func,
  startRecording: PropTypes.func,
  retryRecordingQueueItem: PropTypes.func,
  recordPermission: PropTypes.string,
  speechRecognitionSupported: PropTypes.bool,
  liveText: PropTypes.string,
  liveTranscriptEnabled: PropTypes.bool,
  setLiveTranscriptEnabled: PropTypes.func,
  recordingMessage: PropTypes.string,
  pipelineProgressPercent: PropTypes.number,
  pipelineStageLabel: PropTypes.string,
  selectedRecording: PropTypes.object,
  displaySpeakerNames: PropTypes.object,
  selectedRecordingAudioUrl: PropTypes.string,
  selectedRecordingAudioError: PropTypes.string,
  selectedRecordingAudioStatus: PropTypes.string,
  hydrateRecordingAudio: PropTypes.func,
  clearAudioHydrationError: PropTypes.func,
  selectedRecordingId: PropTypes.string,
  setSelectedRecordingId: PropTypes.func,
  exportTranscript: PropTypes.func,
  exportMeetingNotes: PropTypes.func,
  exportMeetingPdfFile: PropTypes.func,
  startNewMeetingDraft: PropTypes.func,
  selectMeeting: PropTypes.func,
  currentWorkspacePermissions: PropTypes.object,
  currentWorkspaceRole: PropTypes.string,
  currentWorkspace: PropTypes.object,
  currentUser: PropTypes.object,
  currentWorkspaceMembers: PropTypes.array,
  userMeetings: PropTypes.array,
  meetingTasks: PropTypes.array,
  onCreateTask: PropTypes.func,
  peopleProfiles: PropTypes.array,
  addMeetingComment: PropTypes.func,
  currentUserName: PropTypes.string,
  meetingDraft: PropTypes.object,
  renameSpeaker: PropTypes.func,
  autoCreateVoiceProfile: PropTypes.func,
  updateTranscriptSegment: PropTypes.func,
  retryStoredRecording: PropTypes.func,
  setActiveTab: PropTypes.func,
};
