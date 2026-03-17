import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { buildGoogleCalendarUrl, downloadMeetingIcs } from "../lib/calendar";
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
}) {
  const [commentDraft, setCommentDraft] = useState("");
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

  // Next unused speaker ID for "Add speaker" action
  const nextSpeakerId = useMemo(() => {
    const nums = uniqueSpeakers
      .map((s) => parseInt(String(s.id).replace(/\D/g, ""), 10))
      .filter(Number.isFinite);
    const max = nums.length ? Math.max(...nums) : 0;
    return String(max + 1);
  }, [uniqueSpeakers]);

  const initials = (currentUserName || "U").split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

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

  function handleAddComment() {
    if (!commentDraft.trim() || !addMeetingComment) return;
    addMeetingComment(selectedMeeting.id, commentDraft.trim(), currentUserName || "Ty");
    setCommentDraft("");
  }

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
      {picker}

      <div className="studio-ff-layout">
        {/* ── LEFT: main content ── */}
        <div className="studio-ff-main">

          {/* Fireflies-style meeting header */}
          <div className="ff-meeting-header">
            <div className="ff-capture-area">
              {isRecording ? (
                <div className="ff-capture-recording">
                  <div className="ff-capture-bars">
                    {visualBars.map((h, i) => (
                      <span key={i} className="ff-capture-bar" style={{ height: Math.max(3, Math.round(h * 0.55)) + "px" }} />
                    ))}
                  </div>
                  <span className="ff-capture-rec-label">● NAGRYWANIE — {formatDuration(elapsed)}</span>
                </div>
              ) : (
                <div className="ff-capture-placeholder">
                  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                    <rect x="3" y="10" width="28" height="24" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M31 17l10-5v20l-10-5V17z" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                  <p>Capture your meetings video with VoiceLog.</p>
                  <button
                    type="button"
                    className="ff-enable-btn"
                    onClick={() => startRecording()}
                    disabled={!currentWorkspacePermissions?.canRecordAudio}
                  >
                    Nagraj spotkanie
                  </button>
                </div>
              )}
            </div>

            <div className="ff-meeting-info">
              <h2 className="ff-meeting-date">{formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt)}</h2>
              <div className="ff-meeting-meta-row">
                <span className="ff-user-chip">
                  <span className="ff-user-avatar">{initials}</span>
                  <span className="ff-user-name">{currentUserName || "Użytkownik"}</span>
                </span>
                <span className="ff-meta-dot">·</span>
                <span className="ff-meta-text">{formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt)}</span>
                <span className="ff-meta-dot">·</span>
                <svg className="ff-meta-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-label="Mikrofon">
                  <rect x="4" y="1" width="5" height="7" rx="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  <path d="M2 6.5a4.5 4.5 0 009 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                  <line x1="6.5" y1="11" x2="6.5" y2="13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="ff-meta-dot">·</span>
                <span className="ff-meta-text">Polish</span>
              </div>
              <div className="ff-action-bar">
                <button type="button" className="ff-action-btn ff-action-primary">
                  ✦ General Summary
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" /></svg>
                </button>
                <button
                  type="button"
                  className="ff-action-btn"
                  onClick={exportMeetingNotes}
                  disabled={!currentWorkspacePermissions?.canExportWorkspaceData}
                >
                  ↗ Notatki TXT
                </button>
                <button
                  type="button"
                  className="ff-action-btn"
                  onClick={exportTranscript}
                  disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}
                >
                  ⊟ Transkrypt
                </button>
                <button
                  type="button"
                  className="ff-action-btn"
                  onClick={exportMeetingPdfFile}
                  disabled={!currentWorkspacePermissions?.canExportWorkspaceData}
                >
                  + PDF
                </button>
              </div>
            </div>
          </div>

          {/* Summary bullets from analysis */}
          {studioAnalysis && (
            <div className="ff-summary-section panel">
              {studioAnalysis.summary && <p className="ff-summary-text">{studioAnalysis.summary}</p>}
              {studioAnalysis.decisions?.length > 0 && (
                <ul className="ff-summary-bullets">
                  {studioAnalysis.decisions.map((d, i) => (
                    <li key={i}>
                      <strong>
                        {d.split(":")[0]}
                        {d.includes(":") ? ":" : ""}
                      </strong>
                      {d.includes(":") ? d.slice(d.indexOf(":") + 1) : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Content panels (single-column stack) ── */}
          <div className="ff-panels">

      <section className="panel hero-panel">
        <div>
          <div className="eyebrow">Active meeting</div>
          <h2>{selectedMeeting.title}</h2>
          <p>{selectedMeeting.context || "Dodaj kontekst, aby analiza lepiej rozumiala rozmowe."}</p>
        </div>
        <div className="hero-meta">
          <div className="metric-card">
            <span>Start</span>
            <strong>{formatDateTime(selectedMeeting.startsAt)}</strong>
          </div>
          <div className="metric-card">
            <span>Czas</span>
            <strong>{selectedMeeting.durationMinutes} min</strong>
          </div>
          <div className="metric-card">
            <span>Diarization</span>
            <strong>{selectedMeeting.speakerCount || 0} rozmówców</strong>
          </div>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.open(buildGoogleCalendarUrl(selectedMeeting), "_blank", "noopener,noreferrer")}
          >
            Google Calendar
          </button>
          <button type="button" className="secondary-button" onClick={() => downloadMeetingIcs(selectedMeeting)}>
            ICS
          </button>
        </div>
      </section>

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

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Insights</div>
              <h2>Analiza spotkania</h2>
            </div>
            <div className="status-chip">{studioAnalysis?.mode || "waiting"}</div>
          </div>

          {studioAnalysis ? (
            <div className="analysis-stack">
              <div className="analysis-block">
                <h3>Summary</h3>
                <p>{studioAnalysis.summary}</p>
              </div>
              <div className="analysis-columns">
                <div className="analysis-block">
                  <h3>Decisions</h3>
                  <ul className="clean-list">
                    {studioAnalysis.decisions?.length ? (
                      studioAnalysis.decisions.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>Brak decyzji.</li>
                    )}
                  </ul>
                </div>
                <div className="analysis-block">
                  <h3>Action items</h3>
                  <ul className="clean-list">
                    {studioAnalysis.actionItems?.length ? (
                      studioAnalysis.actionItems.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>Brak action items.</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="answers-grid">
                {studioAnalysis.answersToNeeds?.length ? (
                  studioAnalysis.answersToNeeds.map((item) => (
                    <article className="answer-card" key={`${item.need}-${item.answer}`}>
                      <strong>{item.need}</strong>
                      <p>{item.answer}</p>
                    </article>
                  ))
                ) : (
                  <div className="soft-copy">Brak odpowiedzi do potrzeb.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-panel large">
              <strong>Brak analizy</strong>
              <span>Analiza pojawi sie po zatrzymaniu nagrania.</span>
            </div>
          )}
        </section>

        {studioAnalysis && (
          <>
            {(studioAnalysis.openQuestions?.length > 0 || studioAnalysis.risks?.length > 0 || studioAnalysis.blockers?.length > 0) && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Risk radar</div>
                    <h2>Ryzyka i blokery</h2>
                  </div>
                </div>
                <div className="analysis-columns">
                  {studioAnalysis.risks?.length > 0 && (
                    <div className="analysis-block">
                      <h3>Ryzyka</h3>
                      <ul className="clean-list">
                        {studioAnalysis.risks.map((r, i) => (
                          <li key={i} className="risk-item">
                            <span className={`risk-severity risk-${r.severity || "medium"}`}>{r.severity || "medium"}</span>
                            {r.risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {studioAnalysis.blockers?.length > 0 && (
                    <div className="analysis-block">
                      <h3>Blokery</h3>
                      <ul className="clean-list">
                        {studioAnalysis.blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {studioAnalysis.openQuestions?.length > 0 && (
                  <div className="analysis-block">
                    <h3>Otwarte pytania</h3>
                    <ul className="clean-list open-questions-list">
                      {studioAnalysis.openQuestions.map((q, i) => (
                        <li key={i} className="open-question-item">
                          <span className="open-question-text">{q.question}</span>
                          {q.askedBy && <span className="open-question-by">{q.askedBy}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}



            {(studioAnalysis.suggestedAgenda?.length > 0 || studioAnalysis.coachingTip || studioAnalysis.terminology?.length > 0 || studioAnalysis.contextLinks?.length > 0) && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Next steps</div>
                    <h2>Następne spotkanie</h2>
                  </div>
                  {studioAnalysis.meetingType && studioAnalysis.meetingType !== "other" && (
                    <span className="status-chip">{studioAnalysis.meetingType}</span>
                  )}
                </div>
                {studioAnalysis.suggestedAgenda?.length > 0 && (
                  <div className="analysis-block">
                    <h3>Proponowana agenda</h3>
                    <ol className="clean-list suggested-agenda-list">
                      {studioAnalysis.suggestedAgenda.map((item, i) => <li key={i}>{item}</li>)}
                    </ol>
                  </div>
                )}
                {studioAnalysis.coachingTip && (
                  <div className="coaching-tip-box">
                    <span className="coaching-tip-icon">💡</span>
                    <p>{studioAnalysis.coachingTip}</p>
                  </div>
                )}
                {(studioAnalysis.terminology?.length > 0 || studioAnalysis.contextLinks?.length > 0) && (
                  <div className="analysis-columns">
                    {studioAnalysis.terminology?.length > 0 && (
                      <div className="analysis-block">
                        <h3>Terminologia</h3>
                        <div className="chip-list">
                          {studioAnalysis.terminology.map((t) => (
                            <span key={t} className="task-tag-chip neutral">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {studioAnalysis.contextLinks?.length > 0 && (
                      <div className="analysis-block">
                        <h3>Nawiązania</h3>
                        <ul className="clean-list">
                          {studioAnalysis.contextLinks.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}



        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Discussion</div>
              <h2>Komentarze</h2>
            </div>
            <div className="status-chip">{(selectedMeeting.comments || []).length}</div>
          </div>
          <div className="meeting-comment-create">
            <textarea
              rows="3"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Dodaj komentarz... użyj @imię aby wspomnieć osobę"
              disabled={!currentWorkspacePermissions?.canEditWorkspace}
            />
            <button
              type="button"
              className="secondary-button small"
              onClick={handleAddComment}
              disabled={!commentDraft.trim()}
            >
              Dodaj
            </button>
          </div>
          <div className="meeting-comments-list">
            {(selectedMeeting.comments || []).length ? (
              [...selectedMeeting.comments].reverse().map((comment) => (
                <article key={comment.id} className="meeting-comment-card">
                  <div className="meeting-comment-meta">
                    <strong>{comment.author}</strong>
                    <small>{formatDateTime(comment.createdAt)}</small>
                  </div>
                  <p>{comment.text}</p>
                  {comment.mentions?.length > 0 && (
                    <div className="meeting-comment-mentions">
                      {comment.mentions.map((m) => (
                        <span key={m} className="mention-chip">@{m}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak komentarzy</strong>
                <span>Dodaj komentarz lub ustalenie do tego spotkania.</span>
              </div>
            )}
          </div>
        </section>

          </div>{/* /ff-panels */}
        </div>{/* /studio-ff-main */}

        {/* ── RIGHT: transcript sidebar ── */}
        <aside className="studio-ff-sidebar">

          {/* Tab bar — Transcript only */}
          <div className="ff-tab-bar">
            <span className="ff-tab active">Transcript</span>
          </div>

          {/* Search */}
          <div className="ff-search-bar">
            <svg className="ff-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
              <line x1="8.5" y1="8.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              className="ff-search-input"
              placeholder="Szukaj..."
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
            />
          </div>

          {/* Segments list */}
          <div className="ff-segments-list">
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
                    className={`ff-segment${isActive ? " active" : ""}`}
                  >
                    <div className="ff-seg-header">
                      <span className="ff-speaker-avatar" style={{ background: color }}>{letter}</span>
                      <div className="ff-speaker-picker-wrap">
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
                              className={`ff-speaker-name-btn${speakerDropdownSegId === seg.id ? " open" : ""}`}
                              onClick={() => setSpeakerDropdownSegId(speakerDropdownSegId === seg.id ? null : seg.id)}
                            >
                              <span className="ff-speaker-name">{name}</span>
                              <svg className="ff-speaker-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                              </svg>
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
                      <span className="ff-seg-dot">·</span>
                      <button
                        type="button"
                        className="ff-seg-timestamp"
                        onClick={() => { if (audioRef.current) audioRef.current.currentTime = seg.timestamp; }}
                      >
                        {formatDuration(Math.floor(seg.timestamp))}
                      </button>
                    </div>
                    <p className="ff-seg-text">{seg.text}</p>
                  </div>
                );
              })
            ) : (
              <div className="ff-segments-empty">
                {transcript.length ? "Brak wyników wyszukiwania." : "Brak transkrypcji dla tego nagrania."}
              </div>
            )}
          </div>

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

          {/* Player bar */}
          <div className="ff-player-bar">
            {isRecording ? (
              <>
                <button type="button" className="ff-stop-btn" onClick={stopRecording} title="Stop">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" /></svg>
                </button>
                <div className="ff-rec-mini-bars">
                  {visualBars.slice(-14).map((h, i) => (
                    <span key={i} className="ff-rec-mini-bar" style={{ height: Math.max(2, Math.round(h / 4)) + "px" }} />
                  ))}
                </div>
                <span className="ff-player-time">{formatDuration(elapsed)}</span>
                {liveText ? (
                  <span className="ff-live-caption" title="Napisy na żywo">{liveText.slice(-90)}</span>
                ) : null}
                {setLiveTranscriptEnabled ? (
                  <button
                    type="button"
                    className={`ff-cc-btn${liveTranscriptEnabled ? " active" : ""}`}
                    onClick={() => setLiveTranscriptEnabled((p) => !p)}
                    title={liveTranscriptEnabled ? "Wyłącz napisy Whisper" : "Włącz napisy Whisper (wymaga serwera)"}
                  >
                    CC
                  </button>
                ) : null}
                <span className="ff-rec-badge">REC</span>
              </>
            ) : isQueued ? (
              <span className="ff-player-queue">{queueLabel}</span>
            ) : selectedRecordingAudioUrl ? (
              <>
                <span className="ff-player-time">
                  {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(audioDuration))}
                </span>
                <button type="button" className="ff-player-speed" onClick={cyclePlaybackRate}>
                  {playbackRate}×
                </button>
                <button
                  type="button"
                  className="ff-player-ctrl"
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 15); }}
                  title="-15s"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3V1L3.5 4 8 7V5a5 5 0 110 6H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <text x="4.2" y="12.5" fontSize="5" fill="currentColor" fontFamily="sans-serif" fontWeight="600">15</text>
                  </svg>
                </button>
                <button type="button" className="ff-player-play" onClick={togglePlay} aria-label={isPlaying ? "Pauza" : "Odtwórz"}>
                  {isPlaying
                    ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2l10 6-10 6z" /></svg>
                  }
                </button>
                <button
                  type="button"
                  className="ff-player-ctrl"
                  onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(audioDuration, currentTime + 15); }}
                  title="+15s"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3V1l4.5 3L8 7V5a5 5 0 100 6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <text x="4.2" y="12.5" fontSize="5" fill="currentColor" fontFamily="sans-serif" fontWeight="600">15</text>
                  </svg>
                </button>
                <a className="ff-player-ctrl" href={selectedRecordingAudioUrl} download title="Pobierz">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 2v8M5 8l3 4 3-4M2 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </a>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ff-player-record-btn"
                  onClick={() => startRecording()}
                  disabled={!currentWorkspacePermissions?.canRecordAudio}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="4.5" /></svg>
                  Nagraj
                </button>
                <button
                  type="button"
                  className="ff-player-adhoc-btn"
                  onClick={() => startRecording({ adHoc: true })}
                  disabled={!currentWorkspacePermissions?.canRecordAudio}
                >
                  Ad hoc
                </button>
              </>
            )}
          </div>
        </aside>{/* /studio-ff-sidebar */}

      </div>{/* /studio-ff-layout */}
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
