import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { formatDateTime, formatDuration } from "../lib/storage";
import { getSpeakerColor } from "../lib/speakerColors";
import { labelSpeaker } from "../lib/recording";
import { analyzeSpeakingStyle } from "../lib/speakerAnalysis";
import { apiRequest } from "../services/httpClient";
import { remoteApiEnabled } from "../services/config";
import AiTaskSuggestionsPanel from "./AiTaskSuggestionsPanel";


function MeetingPicker({ selectedMeeting, userMeetings, selectMeeting, startNewMeetingDraft, selectedRecordingId, setSelectedRecordingId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const sorted = [...userMeetings].sort(
    (a, b) => new Date(b.startsAt || b.createdAt) - new Date(a.startsAt || a.createdAt)
  );
  const filtered = query.trim()
    ? sorted.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : sorted.slice(0, 10);

  const recordings = selectedMeeting?.recordings || [];

  return (
    <div className="studio-picker-header" ref={ref}>
      <div className="studio-picker-header-top">
        <div className="studio-picker-header-info">
          <div className="eyebrow">Studio</div>
          <h2 className="studio-picker-header-title">
            {selectedMeeting ? selectedMeeting.title : "Wybierz spotkanie"}
          </h2>
          {selectedMeeting && (
            <div className="studio-picker-header-meta">
              <span>{formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt)}</span>
              <span>{selectedMeeting.durationMinutes} min</span>
              <span>{recordings.length} nagran</span>
            </div>
          )}
        </div>
        <div className="studio-picker-header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            Zmień ▾
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={startNewMeetingDraft}
          >
            + Nowe
          </button>
        </div>
        {open && (
          <div className="studio-picker-dropdown" role="listbox">
            <input
              className="studio-picker-search"
              type="search"
              placeholder="Szukaj spotkania…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="studio-picker-list">
              {filtered.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  role="option"
                  aria-selected={selectedMeeting?.id === meeting.id}
                  className={`studio-picker-item${selectedMeeting?.id === meeting.id ? " active" : ""}`}
                  onClick={() => {
                    selectMeeting(meeting);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="studio-picker-item-title">{meeting.title}</span>
                  <span className="studio-picker-item-date">
                    {formatDateTime(meeting.startsAt || meeting.createdAt)}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="studio-picker-empty">Brak wyników</div>
              )}
            </div>
          </div>
        )}
      </div>

      {recordings.length > 0 && (
        <div className="studio-recordings-table-wrap">
          <table className="studio-recordings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Czas</th>
                <th>Speakerzy</th>
                <th>Segmenty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((rec) => (
                <tr
                  key={rec.id}
                  className={rec.id === selectedRecordingId ? "active" : ""}
                  onClick={() => setSelectedRecordingId(rec.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatDateTime(rec.createdAt)}</td>
                  <td>{formatDuration(rec.duration)}</td>
                  <td>{rec.speakerCount || 0}</td>
                  <td>{rec.transcript?.length || 0}</td>
                  <td>
                    <span className={`status-chip status-chip-sm ${rec.pipelineStatus || "done"}`}>
                      {rec.pipelineStatus || "done"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


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

export default function StudioMeetingView({
  selectedMeeting,
  displayRecording,
  studioAnalysis,
  isRecording,
  analysisStatus,
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
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  selectedRecordingAudioError,
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
  briefOpen,
  setBriefOpen,
}) {
  const [addNeedOpen, setAddNeedOpen] = useState(false);
  const [needDraft, setNeedDraft] = useState("");
  const [addConcernOpen, setAddConcernOpen] = useState(false);
  const [concernDraft, setConcernDraft] = useState("");

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
  const activeSegRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const isQueued = ["queued", "uploading", "processing"].includes(analysisStatus) && !isRecording;
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
    if (activeSegRef.current) {
      activeSegRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeSeg?.id]);

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


  const picker = (
    <MeetingPicker
      selectedMeeting={selectedMeeting}
      userMeetings={userMeetings}
      selectMeeting={selectMeeting}
      startNewMeetingDraft={startNewMeetingDraft}
      selectedRecordingId={selectedRecordingId}
      setSelectedRecordingId={setSelectedRecordingId}
    />
  );

  if (!selectedMeeting) {
    return (
      <>
        {picker}
        <section className="hero-panel empty-workspace">
          <div className="empty-workspace-inner">
            <div className="eyebrow">Studio</div>
            <h2>Wybierz lub utwórz spotkanie</h2>
            <p>Zacznij od briefu albo uruchom nagranie ad hoc — spotkanie zostanie utworzone automatycznie.</p>
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
                onClick={startNewMeetingDraft}
                disabled={!currentWorkspacePermissions?.canEditWorkspace}
              >
                Przygotuj brief
              </button>
            </div>
          </div>
        </section>
        <RecordingsLibrary
          userMeetings={userMeetings}
          selectedRecordingId={selectedRecordingId}
          setSelectedRecordingId={setSelectedRecordingId}
          selectMeeting={selectMeeting}
        />
      </>
    );
  }

  return (
    <>
      {selectedRecordingAudioUrl ? (
        <audio ref={audioRef} src={selectedRecordingAudioUrl} preload="metadata" style={{ display: "none" }}>
          <track kind="captions" />
        </audio>
      ) : null}

      {/* ═══════════════════════════════════════════
           HEADER — title + subtitle
          ═══════════════════════════════════════════ */}
      <div className="ff-header">
        <h1 className="ff-header-title">
          {isRecording
            ? (meetingDraft?.title?.trim() || "Ad hoc")
            : (selectedMeeting.title || "Ad hoc")}
        </h1>
        <p className="ff-header-sub">
          {displayRecording
            ? [
                formatDateTime(displayRecording.recordedAt || displayRecording.createdAt || displayRecording.startsAt),
                displayRecording.duration > 0 ? formatDuration(Math.floor(displayRecording.duration)) : null,
                uniqueSpeakers.length > 0 ? `${uniqueSpeakers.length} ${uniqueSpeakers.length === 1 ? "mówca" : "mówców"}` : null,
              ].filter(Boolean).join(" · ")
            : formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt || new Date().toISOString())
          }
        </p>
      </div>

      {/* ═══════════════════════════════════════════
           TOOLBAR — Grupa 1: Eksport/Brief | Separator | Grupa 2: Nagrywanie
          ═══════════════════════════════════════════ */}
      <div className="ff-toolbar">

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
        <button type="button" className="ff-tb-btn" onClick={exportMeetingPdfFile}
          disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}>
          PDF
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
           PLAYER BAR — ONE instance only
          ═══════════════════════════════════════════ */}
      {(isRecording || selectedRecordingAudioUrl || isQueued) && (
        <div className="ff-player-bar">
          {isRecording ? (
            <>
              <div className="ff-rec-mini-bars">
                {visualBars.slice(-14).map((h, i) => (
                  <span key={i} className="ff-rec-mini-bar" style={{ height: Math.max(2, Math.round(h / 4)) + "px" }} />
                ))}
              </div>
              <span className="ff-player-time">{formatDuration(elapsed)}</span>
            </>
          ) : isQueued ? (
            <span className="ff-player-queue">{queueLabel}</span>
          ) : (
            <>
              <span className="ff-player-time">
                {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(audioDuration))}
              </span>
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
                <a className="ff-player-ctrl" href={selectedRecordingAudioUrl} download title="Pobierz">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v8M5 8l3 4 3-4M2 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
            </>
          )}
        </div>
      )}

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
          {recordingMessage}
        </div>
      ) : null}

      {/* ── Brief panels ── */}
      <div className="ff-panels">

        {briefOpen && (
        <><section className="panel">
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
                  <input
                    autoFocus
                    value={needDraft}
                    onChange={(e) => setNeedDraft(e.target.value)}
                    placeholder="np. Potrzebuję wybudować dom"
                  />
                  <button type="submit" className="ghost-button">Dodaj</button>
                </form>
              )}
              <ul className="clean-list">
                {selectedMeeting.needs.length ? (
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
                  <input
                    autoFocus
                    value={concernDraft}
                    onChange={(e) => setConcernDraft(e.target.value)}
                    placeholder="np. Mam ograniczony budżet"
                  />
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
        </section>


        <AiTaskSuggestionsPanel
          selectedRecording={selectedRecording}
          displaySpeakerNames={displaySpeakerNames}
          peopleProfiles={peopleProfiles}
          onCreateTask={onCreateTask}
          canEdit={currentWorkspacePermissions?.canEditWorkspace}
        />
        </>
        )}


          </div>{/* /ff-panels */}

        {/* ── Transcript section ── */}
        <div className="ff-transcript-wrapper" style={{ marginTop: '24px' }}>

          {/* Section header */}
          <div className="ff-sticky-header" style={{ padding: '16px 20px 12px' }}>
            <div className="ff-tabs" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button className="ff-tab active" type="button">Transcript</button>
                <button className="ff-tab askfred" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm-3-9a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 9 11Zm6 0a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 15 11Zm-3 5.5a4.48 4.48 0 0 1-3.64-1.92l1.64-1.16A2.47 2.47 0 0 0 12 14.5a2.47 2.47 0 0 0 2-1.08l1.64 1.16A4.48 4.48 0 0 1 12 16.5Z" /></svg>
                  AskFred
                </button>
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
          <div className="transcript-list" style={{ maxHeight: '600px' }}>
            {filteredTranscript.length ? (
              filteredTranscript.map((seg) => {
                const isActive = activeSeg?.id === seg.id;
                const name = labelSpeaker(displaySpeakerNames, seg.speakerId);
                const letter = (name || "S")[0].toUpperCase();
                const color = getSpeakerColor(seg.speakerId);
                return (
                  <div
                    key={seg.id}
                    ref={isActive ? activeSegRef : null}
                    className={`fireflies-segment${isActive ? " active" : ""}`}
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
                                if (e.key === "Enter") e.target.blur();
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
                      
                      {/* Action icons hidden by default, shown on hover */}
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
              })
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

        </div>{/* /ff-transcript-section */}
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
  selectedRecording: PropTypes.object,
  displaySpeakerNames: PropTypes.object,
  selectedRecordingAudioUrl: PropTypes.string,
  selectedRecordingAudioError: PropTypes.string,
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
  setMeetingDraft: PropTypes.func,
  saveMeeting: PropTypes.func,
  renameSpeaker: PropTypes.func,
  updateTranscriptSegment: PropTypes.func,
};

function RecordingsLibrary({ userMeetings, selectedRecordingId, setSelectedRecordingId, selectMeeting }) {
  const allRecordings = userMeetings.flatMap((m) =>
    (m.recordings || []).map((r) => ({ ...r, meetingId: m.id, meetingTitle: m.title }))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!allRecordings.length) return null;

  return (
    <section className="panel recordings-library">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Library</div>
          <h2>Wszystkie nagrania</h2>
        </div>
        <div className="status-chip">{allRecordings.length}</div>
      </div>
      <div className="studio-recordings-table-wrap">
        <table className="studio-recordings-table">
          <thead>
            <tr>
              <th>Spotkanie</th>
              <th>Data</th>
              <th>Czas</th>
              <th>Speakerzy</th>
              <th>Segmenty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allRecordings.map((rec) => (
              <tr
                key={rec.id}
                className={rec.id === selectedRecordingId ? "active" : ""}
                onClick={() => {
                  const meeting = userMeetings.find((m) => m.id === rec.meetingId);
                  if (meeting) selectMeeting(meeting);
                  setSelectedRecordingId(rec.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="recordings-library-meeting">{rec.meetingTitle}</td>
                <td>{formatDateTime(rec.createdAt)}</td>
                <td>{formatDuration(rec.duration)}</td>
                <td>{rec.speakerCount || 0}</td>
                <td>{rec.transcript?.length || 0}</td>
                <td>
                  <span className={`status-chip status-chip-sm ${rec.pipelineStatus || "done"}`}>
                    {rec.pipelineStatus || "done"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
