import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";
import { useMeetingsCtx } from "../context/MeetingsContext";

import PropTypes from "prop-types";
import { formatDateTime, formatDuration } from "../lib/storage";
import { getSpeakerColor } from "../lib/speakerColors";
import { labelSpeaker } from "../lib/recording";
import { analyzeSpeakingStyle } from "../lib/speakerAnalysis";
import { apiRequest } from "../services/httpClient";
import { remoteApiEnabled } from "../services/config";
import AiTaskSuggestionsPanel from "./AiTaskSuggestionsPanel";
import { RecordingPipelineStatus } from "../components/RecordingPipelineStatus";
import './StudioMeetingViewStyles.css';





/**
 * Fireflies-style speaker picker dropdown for a single transcript segment.
 * Shows all existing speakers (checkmark on current), option to rename,
 * and option to add a new speaker slot.
 */
function SpeakerDropdown({ seg, currentSpeakerId, speakers, nextSpeakerId, displaySpeakerNames, onReassign, onRename, onClose }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
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
            className={`ff-speaker-dropdown-item${isCurrent ? " current" : ""}`}
            onClick={() => { if (!isCurrent) onReassign(sp.id); }}
          >
            <span
              className="ff-spk-dot"
              style={{ background: getSpeakerColor(sp.id) }}
            />
            <span className="ff-spk-label">{sp.name}</span>
            {isCurrent ? (
              <svg className="ff-spk-check" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg className="ff-spk-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M3 5h4M5 3l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
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
          <path d="M1 8.5l1.5-1.5 5-5 1.5 1.5-5 5L1 10l.5-1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
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

  async function fetchCoaching(speakerId) {
    if (!recordingId || loading[speakerId]) return;
    setLoading((p) => ({ ...p, [speakerId]: true }));
    setCoachingError((p) => ({ ...p, [speakerId]: "" }));
    try {
      const speakerSegs = transcript.filter(
        (s) => String(s.speakerId ?? "") === String(speakerId)
      );
      const res = await apiRequest(`/media/recordings/${recordingId}/voice-coaching`, {
        method: "POST",
        body: { speakerId, segments: speakerSegs },
      });
      setCoaching((p) => ({ ...p, [speakerId]: res?.coaching || "" }));
    } catch (err) {
      setCoachingError((p) => ({ ...p, [speakerId]: err.message || "Błąd analizy głosu." }));
    } finally {
      setLoading((p) => ({ ...p, [speakerId]: false }));
    }
  }

  if (!stats.length) return null;

  return (
    <div className="ff-voice-stats-list">
      {stats.map((stat) => (
        <div key={stat.speakerId} className="ff-voice-stat-card">
          <div className="ff-voice-stat-header">
            <span
              className="ff-speaker-avatar"
              style={{ background: getSpeakerColor(stat.speakerId) }}
            >
              {(stat.speakerName || "S")[0].toUpperCase()}
            </span>
            <strong className="ff-voice-stat-name">{stat.speakerName}</strong>
          </div>
          <div className="ff-voice-stat-metrics">
            <span className="ff-voice-metric">
              <strong>{stat.wpm || "—"}</strong>
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
          {coaching[stat.speakerId] ? (
            <div className="ff-voice-coaching-text">{coaching[stat.speakerId]}</div>
          ) : null}
          {coachingError[stat.speakerId] ? (
            <div className="ff-voice-coaching-error">{coachingError[stat.speakerId]}</div>
          ) : null}
          {recordingId && remoteApiEnabled() ? (
            <button
              type="button"
              className="ff-voice-coaching-btn"
              onClick={() => fetchCoaching(stat.speakerId)}
              disabled={loading[stat.speakerId]}
            >
              {loading[stat.speakerId]
                ? "Analizuję głos…"
                : coaching[stat.speakerId]
                  ? "Odśwież analizę głosu"
                  : "Analiza głosu AI"}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

VoiceSpeakerStats.propTypes = {
  transcript: PropTypes.array,
  displaySpeakerNames: PropTypes.object,
  recordingId: PropTypes.string,
};

function formatEmptyTranscriptDiagnostics(recording) {
  if (!recording || recording.transcriptOutcome !== "empty") return "";
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
    details.push("Chunking: tak");
  }
  if (Number.isFinite(Number(diagnostics.chunksSentToStt)) && Number.isFinite(Number(diagnostics.chunksAttempted))) {
    details.push(`Chunks sent to STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`);
  }
  if (Number.isFinite(Number(diagnostics.chunksFailedAtStt)) && Number(diagnostics.chunksFailedAtStt) > 0) {
    details.push(`Chunks failed at STT: ${Number(diagnostics.chunksFailedAtStt)}`);
  }
  if (Number.isFinite(Number(diagnostics.chunksWithText)) && Number.isFinite(Number(diagnostics.chunksAttempted))) {
    details.push(`STT chunks with text: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`);
  }
  if (recording.emptyReason) {
    details.push(`Reason: ${recording.emptyReason}`);
  }
  if (audioQuality?.qualityLabel) {
    details.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }

  return details.join(" · ");
}

function formatAudioQualityPanel(audioQuality) {
  if (!audioQuality || typeof audioQuality !== "object") return "";
  const parts = [];

  if (audioQuality.qualityLabel) {
    parts.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }
  if (Number.isFinite(Number(audioQuality.meanVolumeDb))) {
    parts.push(`Srednia glosnosc: ${Number(audioQuality.meanVolumeDb).toFixed(1)} dB`);
  }
  if (typeof audioQuality.enhancementApplied === "boolean") {
    parts.push(`Uzyto poprawy audio: ${audioQuality.enhancementApplied ? "tak" : "nie"}`);
  }

  return parts.join(" | ");
}

export default function StudioMeetingView({
  selectedMeeting,
  displayRecording,
  studioAnalysis,
  isRecording,
  activeQueueItem,
  selectedMeetingQueue,
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
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
  updateTranscriptSegment,
  retryStoredRecording,
  briefOpen,
  setBriefOpen,
  setActiveTab,
}) {
  const [addNeedOpen, setAddNeedOpen] = useState(false);
  const [needDraft, setNeedDraft] = useState("");
  const [addConcernOpen, setAddConcernOpen] = useState(false);
  const [concernDraft, setConcernDraft] = useState("");

  const { meetings } = useMeetingsCtx();
  const updateMeeting = meetings?.updateMeeting;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraftValue, setTitleDraftValue] = useState("");

  const [studioAnalysisTab, setStudioAnalysisTab] = useState("tasks"); // default to tasks based on user preference

  const [transcriptSearch, setTranscriptSearch] = useState("");
  // Speaker picker dropdown — tracks which segment's dropdown is open
  const [speakerDropdownSegId, setSpeakerDropdownSegId] = useState(null);
  // Rename flow (triggered from within the dropdown)
  const [renamingSpeakerId, setRenamingSpeakerId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [voiceStatsOpen, setVoiceStatsOpen] = useState(false);
  const [rediarizing, setRediarizing] = useState(false);
  const [rediarizeMsg, setRediarizeMsg] = useState(null);

  const audioRef = useRef(null);
  const virtuosoRef = useRef(null);


  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const analysisStatus = selectedMeetingQueue?.status;
  const isQueued = ["queued", "uploading", "processing"].includes(analysisStatus) && !isRecording;
  const isEmptyTranscript = selectedRecording?.transcriptOutcome === "empty";
  const emptyTranscriptDiagnostics = useMemo(
    () => formatEmptyTranscriptDiagnostics(selectedRecording),
    [selectedRecording]
  );
  const selectedRecordingAudioQualitySummary = useMemo(
    () => formatAudioQualityPanel(selectedRecording?.audioQuality),
    [selectedRecording?.audioQuality]
  );
  const queueLabel = analysisStatus === "uploading" ? "Wysyłanie audio…"
    : analysisStatus === "processing" ? "Transkrypcja w toku…"
    : "Nagranie w kolejce…";

  const transcript = useMemo(() => displayRecording?.transcript || [], [displayRecording?.transcript]);

  const activeSeg = useMemo(() => (
    transcript.length && currentTime > 0
      ? transcript.find((s) => s.timestamp <= currentTime && s.endTimestamp > currentTime) || null
      : null
  ), [transcript, currentTime]);

  const filteredTranscript = useMemo(() => {
    const q = transcriptSearch.trim().toLowerCase();
    if (!q) return transcript;
    return transcript.filter((s) => s.text?.toLowerCase().includes(q));
  }, [transcript, transcriptSearch]);

  // All unique speaker IDs in the current recording's transcript
  const uniqueSpeakers = useMemo(() => {
    const seen = new Map();
    for (const seg of transcript) {
      const sid = String(seg.speakerId ?? "");
      if (sid && !seen.has(sid)) seen.set(sid, labelSpeaker(displaySpeakerNames, sid));
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [transcript, displaySpeakerNames]);

  // Reassign a single segment to a different speaker
  const reassignSegmentSpeaker = useCallback((segId, newSpeakerId) => {
    if (typeof updateTranscriptSegment === "function") {
      updateTranscriptSegment(segId, { speakerId: newSpeakerId });
    }
    setSpeakerDropdownSegId(null);
  }, [updateTranscriptSegment]);

  // Re-run GPT-4o-mini speaker detection on stored transcript
  const handleRediarize = useCallback(async () => {
    if (!selectedRecording?.id || !remoteApiEnabled()) return;
    setRediarizing(true);
    setRediarizeMsg(null);
    try {
      const result = await apiRequest(`/media/recordings/${selectedRecording.id}/rediarize`, { method: "POST" });
      if (result?.segments && typeof updateTranscriptSegment === "function") {
        for (const seg of result.segments) {
          if (seg.id) updateTranscriptSegment(seg.id, { speakerId: seg.speakerId, rawSpeakerLabel: seg.rawSpeakerLabel });
        }
        setRediarizeMsg(`Wykryto ${result.speakerCount} mówcę/mówców.`);
      }
    } catch (err) {
      setRediarizeMsg(`Błąd: ${err.message}`);
    } finally {
      setRediarizing(false);
    }
  }, [selectedRecording?.id, updateTranscriptSegment]);

  // Next unused speaker ID for "Add speaker" action
  const nextSpeakerId = useMemo(() => {
    const nums = uniqueSpeakers
      .map((s) => parseInt(String(s.id).replace(/\D/g, ""), 10))
      .filter(Number.isFinite);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [uniqueSpeakers]);


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
       const index = filteredTranscript.findIndex(s => s.id === activeSeg.id);
       if (index !== -1) {
          virtuosoRef.current.scrollToIndex({
            index,
            align: 'center',
            behavior: 'smooth'
          });
       }
    }
  }, [activeSeg?.id, filteredTranscript]);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    function onTimeUpdate() { setCurrentTime(audio.currentTime || 0); }
    function onDuration() { setAudioDuration(isFinite(audio.duration) ? audio.duration : 0); }
    function onPlayPause() { setIsPlaying(!audio.paused); }
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlayPause);
    audio.addEventListener("pause", onPlayPause);
    audio.addEventListener("ended", onPlayPause);
    if (isFinite(audio.duration) && audio.duration > 0) setAudioDuration(audio.duration);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlayPause);
      audio.removeEventListener("pause", onPlayPause);
      audio.removeEventListener("ended", onPlayPause);
    };
  }, [selectedRecordingAudioUrl]);

  useEffect(() => {
    if (!selectedRecording?.id || !hydrateRecordingAudio) return;
    if (selectedRecordingAudioUrl) return;
    if (selectedRecordingAudioStatus === "loading") return;
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
    analysisStatus === "error" ||
    analysisStatus === "failed";
  const playerState = isRecording
    ? "recording"
    : selectedRecording && !selectedRecordingAudioUrl
      ? selectedRecordingAudioStatus === "error"
        ? "audio-error"
        : "loading-audio"
      : (isQueued || analysisStatus === "error" || analysisStatus === "failed") && !selectedRecordingAudioUrl
        ? "queued"
        : "playback-ready";
  const playbackDuration = Math.max(0, Number(audioDuration || displayRecording?.duration || 0));
  const scrubberMax = Math.max(playbackDuration, 1);
  const scrubberValue = Math.min(scrubberMax, Math.max(0, Number(currentTime || 0)));
  const scrubberProgress = scrubberMax > 0 ? Math.min(100, Math.max(0, (scrubberValue / scrubberMax) * 100)) : 0;




  if (!selectedMeeting) {
    return (
      <section className="hero-panel empty-workspace">
        <div className="empty-workspace-inner">
          <div className="eyebrow">Studio</div>
          <h2>Brak aktywnego spotkania</h2>
          <p>Przejdź do zakładki <strong>Nagrania</strong>, aby wybrać nagranie do analizy lub uruchom nagranie ad hoc.</p>
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
            <div className={`ff-status-banner${analysisStatus === "error" ? " ff-status-error" : ""}`} style={{ marginTop: '24px' }}>
              <span>{recordingMessage}</span>
              <button
                type="button"
                className="ff-status-dismiss-btn"
                onClick={() => setRecordingMessage("")}
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
        <audio ref={audioRef} src={selectedRecordingAudioUrl} preload="metadata" style={{ display: "none" }}>
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
            className="ff-header-title-input"
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
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setIsEditingTitle(false);
            }}
            style={{
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "var(--text)",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              padding: "4px 12px",
              margin: "0 0 8px 0",
              width: "100%",
              outline: "none",
            }}
          />
        ) : (
          <h1 
            className="ff-header-title" 
            title="Kliknij, aby edytować nazwę"
            onClick={() => {
              setTitleDraftValue(
                isRecording
                  ? (meetingDraft?.title?.trim() || "Ad hoc")
                  : (selectedMeeting?.title || "Ad hoc")
              );
              setIsEditingTitle(true);
            }}
            style={{ cursor: "pointer", display: "inline-block", padding: "4px 8px", margin: "0 -8px 8px -8px", borderRadius: "6px" }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
          >
            {isRecording
              ? (meetingDraft?.title?.trim() || "Ad hoc")
              : (selectedMeeting?.title || "Ad hoc")}
            <svg 
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ display: "inline-block", marginLeft: "12px", opacity: 0.4, verticalAlign: "middle" }}
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </h1>
        )}
        <p className="ff-header-sub">
          {displayRecording
            ? [
                formatDateTime(displayRecording.recordedAt || displayRecording.createdAt || displayRecording.startsAt),
                displayRecording.duration > 0 ? formatDuration(Math.floor(displayRecording.duration)) : null,
                uniqueSpeakers.length > 0 ? `${uniqueSpeakers.length} ${uniqueSpeakers.length === 1 ? "mówca" : "mówców"}` : null,
              ].filter(Boolean).join(" · ")
            : formatDateTime(selectedMeeting?.startsAt || selectedMeeting?.createdAt || new Date().toISOString())
          }
        </p>
      </div>

      <div className="ff-intelligence-tabs" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '20px', padding: '0 4px' }}>
        {[
          { id: 'summary', label: 'Podsumowanie spotkania' },
          { id: 'needs', label: 'Potrzeby i obawy' },
          { id: 'profile', label: 'Profil psychologiczny' },
          { id: 'feedback', label: 'Twój feedback' },
          { id: 'tasks', label: 'Zadania' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className={`ff-int-tab ${studioAnalysisTab === t.id ? 'active' : ''}`}
            onClick={() => setStudioAnalysisTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 0 10px',
              fontSize: '0.88rem',
              fontWeight: 500,
              color: studioAnalysisTab === t.id ? '#75d6c4' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              borderBottom: studioAnalysisTab === t.id ? '2px solid #75d6c4' : '2px solid transparent',
              transition: 'all 0.2s ease'
            }}
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
        <button type="button" className="ff-tb-btn" onClick={exportMeetingNotes}
          disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 1h6v6M13 1L7 7M5 3H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Notatki
        </button>
        <button type="button" className="ff-tb-btn" onClick={exportTranscript}
          disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <line x1="4" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="4" y1="7.5" x2="10" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="4" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Transkrypt
        </button>

        <button
          type="button"
          className={`ff-tb-btn${briefOpen ? " active" : ""}`}
          onClick={() => setBriefOpen((v) => !v)}
        >
          {briefOpen ? "− Brief" : "+ Brief"}
        </button>

        {/* ── Separator ── */}
        <span className="ff-tb-sep" />

        {/* ── Grupa 2: Akcje nagrywania ── */}
        {isRecording ? (
          <>
            <button type="button" className="ff-tb-stop" onClick={stopRecording}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" /></svg>
              Stop
            </button>
            {setLiveTranscriptEnabled ? (
              <button
                type="button"
                className={`ff-tb-cc${liveTranscriptEnabled ? " active" : ""}`}
                onClick={() => setLiveTranscriptEnabled((p) => !p)}
                title={liveTranscriptEnabled ? "Wyłącz Whisper CC" : "Włącz Whisper CC"}
              >CC</button>
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
                <path d="M3 10a8 8 0 0016 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                <line x1="11" y1="18" x2="11" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Rozpocznij nagrywanie
            </button>
            <button type="button" className="ff-tb-lang" title="Język nagrania">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 1.5C8 1.5 5.5 4 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4 10.5 8S8 14.5 8 14.5" stroke="currentColor" strokeWidth="1.4" />
                <line x1="1.5" y1="8" x2="14.5" y2="8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              PL
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
        <div className={`ff-status-banner${analysisStatus === "error" ? " ff-status-error" : ""}`}>
          <span>{recordingMessage}</span>
          <button
            type="button"
            className="ff-status-dismiss-btn"
            onClick={() => setRecordingMessage("")}
            aria-label="Zamknij powiadomienie"
          >
            ×
          </button>
        </div>
      ) : null}

      {/* ── Brief panels ── */}
      {isEmptyTranscript ? (
        <div className="ff-status-banner ff-status-warn" data-testid="empty-transcript-banner">
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span>Nie wykryto wypowiedzi w nagraniu. Sprobuj ponownie transkrypcje albo sprawdz audio w odtwarzaczu.</span>
            {emptyTranscriptDiagnostics ? (
              <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{emptyTranscriptDiagnostics}</span>
            ) : null}
            {selectedRecordingAudioQualitySummary ? (
              <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>{selectedRecordingAudioQualitySummary}</span>
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
                <div className="eyebrow">AI — podsumowanie</div>
                <h2>Podsumowanie spotkania</h2>
              </div>
            </div>
            {studioAnalysis?.summary ? (
              <div className="panel-body">
                <div className="analysis-summary-text">{studioAnalysis.summary}</div>

                {studioAnalysis.decisions?.length > 0 && (
                  <div className="analysis-section">
                    <h3>Decyzje</h3>
                    <ul className="analysis-list">
                      {studioAnalysis.decisions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {studioAnalysis.actionItems?.length > 0 && (
                  <div className="analysis-section">
                    <h3>Action Items</h3>
                    <ul className="analysis-list">
                      {studioAnalysis.actionItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : isEmptyTranscript ? (
              <div className="panel-body">
                <div className="analysis-summary-text">
                  Nie wykryto wypowiedzi w nagraniu. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem.
                </div>
                {selectedRecordingAudioQualitySummary ? (
                  <div style={{ marginTop: "10px", color: "var(--text-3, #8f97ab)", fontSize: "0.84rem" }}>
                    {selectedRecordingAudioQualitySummary}
                  </div>
                ) : null}
                {retryStoredRecording && selectedMeeting && selectedRecording ? (
                  <div style={{ marginTop: "16px" }}>
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
                <p className="soft-copy">Automatyczne podsumowanie AI pojawi się po zakończeniu analizy.</p>
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
                      const current = (meetingDraft?.needs || "");
                      const updated = current ? current.trim() + "\n" + needDraft.trim() : needDraft.trim();
                      const newDraft = { ...meetingDraft, needs: updated };
                      setMeetingDraft(() => newDraft);
                      setNeedDraft("");
                      setAddNeedOpen(false);
                      saveMeeting(newDraft);
                    }}
                  >
                    <input autoFocus value={needDraft} onChange={(e) => setNeedDraft(e.target.value)} placeholder="np. Potrzebuję wybudować dom" />
                    <button type="submit" className="ghost-button">Dodaj</button>
                  </form>
                )}
                <ul className="clean-list">
                  {(selectedMeeting.needs || []).length ? (
                    selectedMeeting.needs.map((item) => <li key={item}>{item}</li>)
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
                      const current = (meetingDraft?.concerns || "");
                      const updated = current ? current.trim() + "\n" + concernDraft.trim() : concernDraft.trim();
                      const newDraft = { ...meetingDraft, concerns: updated };
                      setMeetingDraft(() => newDraft);
                      setConcernDraft("");
                      setAddConcernOpen(false);
                      saveMeeting(newDraft);
                    }}
                  >
                    <input autoFocus value={concernDraft} onChange={(e) => setConcernDraft(e.target.value)} placeholder="np. Mam ograniczony budżet" />
                    <button type="submit" className="ghost-button">Dodaj</button>
                  </form>
                )}
                <ul className="clean-list">
                  {(selectedMeeting.concerns || []).length ? (
                    (selectedMeeting.concerns || []).map((item) => <li key={item}>{item}</li>)
                  ) : (
                    <li className="soft-copy">Brak obaw.</li>
                  )}
                </ul>
              </div>
            </div>

            {studioAnalysis?.answersToNeeds?.length > 0 && (
              <div className="analysis-section" style={{ padding: '20px 24px' }}>
                <div className="eyebrow">AI — analiza potrzeb</div>
                <h3>Odpowiedzi na potrzeby</h3>
                <ul className="analysis-list">
                  {studioAnalysis.answersToNeeds.map((item, i) => (
                    <li key={i}>
                      <strong style={{ color: 'var(--brand-primary)' }}>{item.need}:</strong> {item.answer}
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
                <div className="insights-grid">
                  {studioAnalysis.participantInsights.map((insight, i) => (
                    <div key={i} className="insight-card">
                      <h3>{insight.speaker}</h3>
                      <div className="insight-topic">
                        <strong>Główny temat:</strong> {insight.mainTopic}
                      </div>
                      <div className="insight-stance">
                        <strong>Nastawienie:</strong> {insight.stance}
                      </div>
                      <div className="insight-ratio">
                        <strong>Udział w rozmowie:</strong> {(insight.talkRatio * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="panel-body">
                <p className="soft-copy">Analiza profilu psychologicznego uczestników pojawi się tutaj.</p>
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
            </div>
            {studioAnalysis ? (
              <div className="panel-body">
                <div className="feedback-meta">
                  <div className="meta-item">
                    <strong>Poziom energii</strong>
                    {studioAnalysis.energyLevel || "N/A"}
                  </div>
                  <div className="meta-item">
                    <strong>Typ spotkania</strong>
                    {studioAnalysis.meetingType || "N/A"}
                  </div>
                </div>

                {studioAnalysis.openQuestions?.length > 0 && (
                  <div className="analysis-section">
                    <h3>Otwarte pytania</h3>
                    <ul className="analysis-list">
                      {studioAnalysis.openQuestions.map((q, i) => (
                        <li key={i}>
                          <strong>{q.askedBy}:</strong> {q.question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {studioAnalysis.risks?.length > 0 && (
                  <div className="analysis-section">
                    <h3>Ryzyka</h3>
                    <div className="risks-list" style={{ marginTop: '12px' }}>
                      {studioAnalysis.risks.map((r, i) => (
                        <div key={i} className={`risk-item severity-${r.severity || "medium"}`}>
                          {r.risk}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="panel-body">
                <p className="soft-copy">Tutaj znajdziesz analizę zwrotną dotyczącą jakości spotkania.</p>
              </div>
            )}
          </section>
        )}

        {studioAnalysisTab === 'tasks' && (
          <AiTaskSuggestionsPanel
            selectedRecording={selectedRecording}
            displaySpeakerNames={displaySpeakerNames}
            peopleProfiles={peopleProfiles}
            onCreateTask={onCreateTask}
            canEdit={currentWorkspacePermissions?.canEditWorkspace}
          />
        )}

          </div>{/* /ff-panels */}
        </div>{/* /ff-studio-left-col */}

        {/* RIGHT COLUMN: Transcript */}
        <div className="ff-studio-right-col">

          {/* Section header */}
          <div className="ff-sticky-header" style={{ padding: '16px 20px 12px' }}>
            <div className="ff-tabs" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button className="ff-tab active" type="button">Transkrypcja</button>
              </div>
              
              {transcript.length > 0 && remoteApiEnabled() && (
                <button
                  type="button"
                  className="ff-sidebar-action-btn"
                  onClick={handleRediarize}
                  disabled={rediarizing}
                  title="Wykryj mówców ponownie za pomocą GPT-4o-mini"
                  style={{ alignSelf: 'center' }}
                >
                  {rediarizing ? "…" : "Wykryj mówców"}
                </button>
              )}
            </div>

          {/* Search */}
          <div className="ff-search-bar" style={{ alignSelf: 'stretch', margin: '0' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Find or Replace"
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
            />
          </div>
          </div>

          {rediarizeMsg ? <p className="ff-rediarize-msg">{rediarizeMsg}</p> : null}

          {/* Segments list */}
          <div className="transcript-list" style={{ flex: 1, minHeight: 0 }}>
            {filteredTranscript.length ? (
              <Virtuoso
                ref={virtuosoRef}
                data={filteredTranscript}
                style={{ height: '100%', width: '100%' }}
                itemContent={(index, seg) => {
                  const isActive = activeSeg?.id === seg.id;
                  const name = labelSpeaker(displaySpeakerNames, seg.speakerId);
                  const letter = (name || "S")[0].toUpperCase();
                  const color = getSpeakerColor(seg.speakerId);
                  return (
                    <div
                      key={seg.id}
                      className={`fireflies-segment${isActive ? " active" : ""}`}
                      style={{ marginBottom: '24px' }}
                    >
                      <div className="fireflies-avatar" style={{ background: color }}>{letter}</div>
                      
                      <div className="fireflies-content">
                        <div className="fireflies-header">
                          <div className="ff-speaker-picker-wrap" style={{ display: 'flex', alignItems: 'center' }}>
                            {renamingSpeakerId === String(seg.speakerId) ? (
                              <input
                                className="ff-speaker-rename-input"
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onBlur={() => {
                                  if (renameValue.trim() && renameSpeaker) renameSpeaker(seg.speakerId, renameValue.trim());
                                  setRenamingSpeakerId(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as any).blur();
                                  if (e.key === "Escape") { setRenamingSpeakerId(null); }
                                }}
                              />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                  onClick={() => setSpeakerDropdownSegId(speakerDropdownSegId === seg.id ? null : seg.id)}
                                >
                                  <span className="fireflies-speaker">{name}</span>
                                  <svg className="fireflies-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                                {speakerDropdownSegId === seg.id ? (
                                  <SpeakerDropdown
                                    seg={seg}
                                    currentSpeakerId={String(seg.speakerId ?? "")}
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
                            onClick={() => { if (audioRef.current) audioRef.current.currentTime = seg.timestamp; }}
                          >
                            {formatDuration(Math.floor(seg.timestamp))}
                          </button>
                        </div>
                        <div className="fireflies-text-area">
                          <textarea
                            className="fireflies-textarea"
                            value={seg.text}
                            onChange={(e) => updateTranscriptSegment(seg.id, { text: e.target.value })}
                            rows={Math.max(1, Math.ceil(seg.text.length / 80))}
                            spellCheck="false"
                          />
                        </div>
                        
                        <div className="fireflies-actions">
                           <button type="button" className="icon-button" aria-label="Copy">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </button>
                            <button type="button" className="icon-button" aria-label="Create Soundbite">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
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
                    <svg className="ff-empty-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                      <circle cx="18" cy="18" r="17" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M12 18h12M15 13h6M15 23h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <p>Brak wyników wyszukiwania.</p>
                  </>
                ) : (
                  <>
                    <svg className="ff-empty-icon" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                      <rect x="8" y="4" width="24" height="32" rx="4" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M14 13h12M14 19h12M14 25h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M8 28c3-3 6-1 8-4s3-5 4-5 2 3 4 5 5 1 8 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity=".45" />
                    </svg>
                    <p>Brak transkrypcji<br />dla tego nagrania.</p>
                  </>
                )}
              </div>
            )}
          </div>


          {/* Floating "Sync with audio" button */}
          {transcript.length > 0 && selectedRecordingAudioUrl && !isRecording ? (
            <button
              type="button"
              className="ff-sync-fab"
              onClick={() => {
                if (audioRef.current && activeSeg) {
                  audioRef.current.currentTime = activeSeg.timestamp;
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 9V3M3 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sync with audio
            </button>
          ) : null}

          {/* Voice analytics panel — collapsible, shown only when transcript is available */}
          {transcript.length > 0 ? (
            <div className="ff-voice-analytics">
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
                  className={voiceStatsOpen ? "ff-chevron open" : "ff-chevron"}
                  width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                >
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

      </div>{/* /ff-studio-right-col */}
      </div>{/* /ff-studio-split-view */}

      {/* ═══════════════════════════════════════════
           RECORDING ACTIVE HERO — only when recording
          ═══════════════════════════════════════════ */}
      {isRecording && (
        <div className="ff-rec-active-hero">
          <div className="ff-rec-vis-row">
            <div className="ff-rec-pulse-ring">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <rect x="7" y="1" width="8" height="12" rx="4" fill="currentColor" />
                <path d="M3 10a8 8 0 0016 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                <line x1="11" y1="18" x2="11" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="ff-rec-wave-inline">
              {visualBars.map((h, i) => (
                <span key={i} className="ff-capture-bar" style={{ height: Math.max(3, Math.round(h * 0.45)) + "px" }} />
              ))}
            </div>
          </div>
          <div className="ff-rec-timer-xl">{formatDuration(elapsed)}</div>
          <p className="ff-rec-status-label">● Nagrywanie</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           PLAYER BAR — ALWAYS visible — at bottom
          ═══════════════════════════════════════════ */}
      {shouldShowPlayerBar && (
        <div className="ff-player-bar">
          {playerState === "recording" ? (
            <>
              <div className="ff-rec-mini-bars">
                {visualBars.slice(-14).map((h, i) => (
                  <span key={i} className="ff-rec-mini-bar" style={{ height: Math.max(2, Math.round(h / 4)) + "px" }} />
                ))}
              </div>
              <span className="ff-player-time">{formatDuration(elapsed)}</span>
            </>
          ) : playerState === "queued" ? (
            <div className="ff-player-status-wrap">
              <RecordingPipelineStatus 
                status={analysisStatus === "error" || analysisStatus === "failed" || activeQueueItem?.status === "failed" ? "failed" : (activeQueueItem?.status || "processing")}
                errorMessage={activeQueueItem?.errorMessage || (analysisStatus === "error" || analysisStatus === "failed" ? "Błąd analizy nagrania" : undefined)}
                onRetry={activeQueueItem ? () => retryRecordingQueueItem(activeQueueItem.recordingId) : undefined}
                progressMessage={queueLabel}
                progressPercent={pipelineProgressPercent}
                stageLabel={pipelineStageLabel}
              />
            </div>
          ) : playerState === "loading-audio" ? (
            <div className="ff-player-status-wrap" data-testid="player-loading-audio">
              <span className="ff-player-time">Ladowanie audio...</span>
            </div>
          ) : playerState === "audio-error" ? (
            <div className="ff-player-status-wrap" data-testid="player-audio-error">
              <span className="ff-player-time">Nie udalo sie zaladowac audio.</span>
              {selectedRecordingAudioError ? (
                <span className="soft-copy" style={{ fontSize: "0.8rem" }}>{selectedRecordingAudioError}</span>
              ) : null}
              {selectedRecording?.id && hydrateRecordingAudio ? (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    clearAudioHydrationError?.(selectedRecording.id);
                    hydrateRecordingAudio(selectedRecording.id, { force: true, priority: true }).catch(() => {});
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
                  <span className="ff-player-time ff-player-time-current">
                    {formatDuration(Math.floor(currentTime))}
                  </span>
                  <input
                    type="range"
                    className="ff-player-scrubber"
                    aria-label="Pozycja odtwarzania"
                    min={0}
                    max={scrubberMax}
                    step={0.1}
                    value={scrubberValue}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value || 0);
                      setCurrentTime(nextValue);
                      if (audioRef.current) {
                        audioRef.current.currentTime = nextValue;
                      }
                    }}
                    style={{ "--ff-player-progress": `${scrubberProgress}%` }}
                  />
                  <span className="ff-player-time ff-player-time-total">
                    {formatDuration(Math.floor(playbackDuration))}
                  </span>
                </div>
              <div className="ff-player-controls">
                <button type="button" className="ff-player-speed" onClick={cyclePlaybackRate}>{playbackRate}×</button>
                <button type="button" className="ff-player-ctrl" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 15); }} title="-15s">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3V1L3.5 4 8 7V5a5 5 0 110 6H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <text x="4.2" y="12.5" fontSize="5" fill="currentColor" fontFamily="sans-serif" fontWeight="600">15</text>
                  </svg>
                </button>
                <button type="button" className="ff-player-play" onClick={togglePlay} aria-label={isPlaying ? "Pauza" : "Odtwórz"}>
                  {isPlaying
                    ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2l10 6-10 6z" /></svg>
                  }
                </button>
                <button type="button" className="ff-player-ctrl" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioDuration, currentTime + 15); }} title="+15s">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3V1l4.5 3L8 7V5a5 5 0 100 6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <text x="4.2" y="12.5" fontSize="5" fill="currentColor" fontFamily="sans-serif" fontWeight="600">15</text>
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
                        const a = document.createElement("a");
                        a.href = url;
                        const safeTitle = (selectedMeeting?.title || displayRecording?.title || "nagranie").replace(/[^a-z0-9_-]/gi, '_');
                        a.download = `${safeTitle}.mp3`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);
                      })
                      .catch(() => {
                        window.open(selectedRecordingAudioUrl, "_blank");
                      });
                  }}
                  title="Pobierz MP3"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v8M5 8l3 4 3-4M2 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
              </div>
            </>
          )}
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
  userMeetings: PropTypes.array,
  meetingTasks: PropTypes.array,
  onCreateTask: PropTypes.func,
  peopleProfiles: PropTypes.array,
  addMeetingComment: PropTypes.func,
  currentUserName: PropTypes.string,
  meetingDraft: PropTypes.object,
  renameSpeaker: PropTypes.func,
  updateTranscriptSegment: PropTypes.func,
  retryStoredRecording: PropTypes.func,
  setActiveTab: PropTypes.func,
};
