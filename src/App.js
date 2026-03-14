import { useEffect, useRef, useState } from "react";
import "./App.css";
import { analyzeMeeting } from "./lib/analysis";
import { loginUser, registerUser, updateUserProfile } from "./lib/auth";
import { buildGoogleCalendarUrl, downloadMeetingIcs } from "./lib/calendar";
import { diarizeSegments, signatureAroundTimestamp, summarizeSpectrum } from "./lib/diarization";
import {
  attachRecording,
  createEmptyMeetingDraft,
  createMeeting,
  meetingToDraft,
  updateMeeting,
  upsertMeeting,
} from "./lib/meeting";
import {
  STORAGE_KEYS,
  createId,
  downloadTextFile,
  formatDateTime,
  formatDuration,
  readStorage,
  writeStorage,
} from "./lib/storage";

const DEFAULT_BARS = Array.from({ length: 24 }, (_, index) => (index % 3 === 0 ? 22 : 10));

function useStoredState(key, initialValue) {
  const [state, setState] = useState(() => readStorage(key, initialValue));

  useEffect(() => {
    writeStorage(key, state);
  }, [key, state]);

  return [state, setState];
}

function buildProfileDraft(user) {
  return {
    name: user?.name || "",
    role: user?.role || "",
    company: user?.company || "",
    timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
    googleEmail: user?.googleEmail || user?.email || "",
  };
}

function getSpeechRecognitionClass() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function labelSpeaker(map, speakerId) {
  return map?.[String(speakerId)] || `Speaker ${Number(speakerId) + 1}`;
}

function recordingToText(recording) {
  return (recording?.transcript || [])
    .map((segment) => `[${formatDuration(segment.timestamp)}] ${labelSpeaker(recording.speakerNames, segment.speakerId)}: ${segment.text}`)
    .join("\n");
}

export default function App() {
  const [users, setUsers] = useStoredState(STORAGE_KEYS.users, []);
  const [session, setSession] = useStoredState(STORAGE_KEYS.session, null);
  const [meetings, setMeetings] = useStoredState(STORAGE_KEYS.meetings, []);

  const [authMode, setAuthMode] = useState("register");
  const [authDraft, setAuthDraft] = useState({ name: "", role: "", company: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [profileDraft, setProfileDraft] = useState(buildProfileDraft(null));
  const [profileMessage, setProfileMessage] = useState("");
  const [meetingDraft, setMeetingDraft] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordPermission, setRecordPermission] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [audioUrls, setAudioUrls] = useState({});

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const chunksRef = useRef([]);
  const transcriptRef = useRef([]);
  const signatureTimelineRef = useRef([]);
  const recordingMeetingIdRef = useRef(null);
  const isRecordingRef = useRef(false);
  const audioUrlsRef = useRef({});

  const currentUser = users.find((user) => user.id === session?.userId) || null;
  const currentUserId = currentUser?.id || null;
  const userMeetings = currentUser
    ? meetings
        .filter((meeting) => meeting.userId === currentUser.id)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    : [];
  const selectedMeeting = userMeetings.find((meeting) => meeting.id === selectedMeetingId) || null;
  const selectedRecording =
    selectedMeeting?.recordings.find((recording) => recording.id === selectedRecordingId) ||
    selectedMeeting?.recordings[0] ||
    null;
  const displayRecording =
    isRecording && recordingMeetingIdRef.current === selectedMeeting?.id
      ? { transcript: currentSegments, speakerNames: {}, speakerCount: 0, analysis: null }
      : selectedRecording;

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    if (!currentUserId) {
      setSelectedMeetingId((previous) => (previous === null ? previous : null));
      setSelectedRecordingId((previous) => (previous === null ? previous : null));
      return;
    }

    if (!selectedMeetingId) {
      const nextMeeting = meetings
        .filter((meeting) => meeting.userId === currentUserId)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
      if (nextMeeting) {
        setSelectedMeetingId(nextMeeting.id);
        setSelectedRecordingId(nextMeeting.latestRecordingId || nextMeeting.recordings[0]?.id || null);
        setMeetingDraft(meetingToDraft(nextMeeting));
      }
    }
  }, [currentUserId, meetings, selectedMeetingId]);

  useEffect(() => {
    if (currentUser) {
      setProfileDraft(buildProfileDraft(currentUser));
    }
  }, [currentUser]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      window.clearInterval(timerRef.current);
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  function selectMeeting(meeting) {
    setSelectedMeetingId(meeting.id);
    setSelectedRecordingId(meeting.latestRecordingId || meeting.recordings[0]?.id || null);
    setMeetingDraft(meetingToDraft(meeting));
    setWorkspaceMessage("");
  }

  function cleanupRecorder() {
    cancelAnimationFrame(frameRef.current);
    window.clearInterval(timerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error(error);
      }
      recognitionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current?.close) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }

  function pumpBars() {
    if (!analyserRef.current) {
      return;
    }
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setVisualBars(Array.from({ length: 24 }, (_, index) => Math.max(6, (data[Math.floor((index / 24) * data.length)] / 255) * 52)));
    if (isRecordingRef.current) {
      signatureTimelineRef.current.push({
        timestamp: (Date.now() - startTimeRef.current) / 1000,
        signature: summarizeSpectrum(data),
      });
      if (signatureTimelineRef.current.length > 900) {
        signatureTimelineRef.current = signatureTimelineRef.current.slice(-700);
      }
    }
    frameRef.current = window.requestAnimationFrame(pumpBars);
  }

  async function startRecording() {
    if (!selectedMeeting || !navigator.mediaDevices?.getUserMedia) {
      setRecordingMessage("Wybierz spotkanie i upewnij sie, ze mikrofon jest dostepny.");
      return;
    }
    setRecordPermission("loading");
    setRecordingMessage("");
    setLiveText("");
    setCurrentSegments([]);
    setAnalysisStatus("idle");
    transcriptRef.current = [];
    signatureTimelineRef.current = [];
    chunksRef.current = [];
    recordingMeetingIdRef.current = selectedMeeting.id;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const targetMeeting = userMeetings.find((meeting) => meeting.id === recordingMeetingIdRef.current) || selectedMeeting;
        const diarization = diarizeSegments(
          transcriptRef.current.map((segment) => ({
            ...segment,
            signature: segment.signature || signatureAroundTimestamp(signatureTimelineRef.current, segment.timestamp),
          }))
        );
        setCurrentSegments(diarization.segments);
        setAnalysisStatus("analyzing");

        const analysis = await analyzeMeeting({
          meeting: targetMeeting,
          segments: diarization.segments,
          speakerNames: diarization.speakerNames,
          diarization,
        });
        const recordingId = createId("recording");
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const recording = {
          id: recordingId,
          createdAt: new Date().toISOString(),
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
          transcript: diarization.segments,
          speakerNames: analysis.speakerLabels || diarization.speakerNames,
          speakerCount: analysis.speakerCount || diarization.speakerCount,
          diarizationConfidence: diarization.confidence,
          analysis,
        };
        setAudioUrls((previous) => ({ ...previous, [recordingId]: url }));
        setMeetings((previous) =>
          previous.map((meeting) =>
            meeting.id === recordingMeetingIdRef.current ? attachRecording(meeting, recording) : meeting
          )
        );
        setSelectedMeetingId(recordingMeetingIdRef.current);
        setSelectedRecordingId(recordingId);
        setRecordingMessage("Nagranie zapisane i przeanalizowane.");
        setAnalysisStatus("done");
        cleanupRecorder();
        setVisualBars(DEFAULT_BARS);
      };
      recorder.start(800);

      const SpeechRecognitionClass = getSpeechRecognitionClass();
      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "pl-PL";
        recognition.onresult = (event) => {
          let interim = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const text = result[0]?.transcript?.trim();
            if (!text) {
              continue;
            }
            if (result.isFinal) {
              const timestamp = (Date.now() - startTimeRef.current) / 1000;
              const segment = {
                id: createId("segment"),
                text,
                timestamp,
                speakerId: 0,
                signature: signatureAroundTimestamp(signatureTimelineRef.current, timestamp),
              };
              transcriptRef.current = [...transcriptRef.current, segment];
              setCurrentSegments([...transcriptRef.current]);
              setLiveText("");
            } else {
              interim += `${text} `;
            }
          }
          setLiveText(interim.trim());
        };
        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (error) {
              console.error(error);
            }
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
      }

      setRecordPermission("granted");
      startTimeRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        if (isRecordingRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 300);
      pumpBars();
    } catch (error) {
      console.error(error);
      cleanupRecorder();
      setRecordPermission("denied");
      setRecordingMessage("Nie udalo sie wlaczyc nagrywania.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    setLiveText("");
    window.clearInterval(timerRef.current);
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.error(error);
    }
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.error(error);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthError("");
    try {
      if (authMode === "register") {
        const result = await registerUser(users, authDraft);
        setUsers(result.users);
        setSession({ userId: result.user.id });
      } else {
        const user = await loginUser(users, authDraft);
        setSession({ userId: user.id });
      }
    } catch (error) {
      setAuthError(error.message);
    }
  }

  function saveProfile(event) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }
    setUsers((previous) => updateUserProfile(previous, currentUser.id, profileDraft));
    setProfileMessage("Profil zapisany.");
  }

  function saveMeeting() {
    if (!currentUser) {
      return;
    }
    if (!selectedMeeting) {
      const meeting = createMeeting(currentUser.id, meetingDraft);
      setMeetings((previous) => upsertMeeting(previous, meeting));
      selectMeeting(meeting);
      setWorkspaceMessage("Spotkanie utworzone.");
      return;
    }
    const nextMeeting = updateMeeting(selectedMeeting, meetingDraft);
    setMeetings((previous) => upsertMeeting(previous, nextMeeting));
    selectMeeting(nextMeeting);
    setWorkspaceMessage("Spotkanie zapisane.");
  }

  function renameSpeaker(speakerId, nextValue) {
    if (!selectedMeeting || !selectedRecording) {
      return;
    }
    setMeetings((previous) =>
      previous.map((meeting) =>
        meeting.id !== selectedMeeting.id
          ? meeting
          : {
              ...meeting,
              speakerNames:
                meeting.latestRecordingId === selectedRecording.id
                  ? { ...meeting.speakerNames, [String(speakerId)]: nextValue }
                  : meeting.speakerNames,
              recordings: meeting.recordings.map((recording) =>
                recording.id !== selectedRecording.id
                  ? recording
                  : {
                      ...recording,
                      speakerNames: { ...recording.speakerNames, [String(speakerId)]: nextValue },
                    }
              ),
            }
      )
    );
  }

  function exportTranscript() {
    if (!displayRecording) {
      return;
    }
    downloadTextFile("meeting-transcript.txt", recordingToText(displayRecording));
  }

  function logout() {
    if (isRecording) {
      stopRecording();
    }
    setSession(null);
  }

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="backdrop-orb backdrop-orb-left" />
        <div className="backdrop-orb backdrop-orb-right" />
        <section className="auth-hero">
          <div className="eyebrow">VoiceLog OS</div>
          <h1>Meeting intelligence for people who need clear answers.</h1>
          <p className="hero-copy">
            Dzialaj na spotkaniach z diarization, profilem uzytkownika, briefem potrzeb i szybkim eksportem do Google
            Calendar.
          </p>
          <div className="hero-grid">
            <article className="feature-card"><h2>Diarization</h2><p>Segmenty sa grupowane po sygnaturze glosu.</p></article>
            <article className="feature-card"><h2>Meeting brief</h2><p>Do kazdego spotkania zapisujesz to, co jest dla Ciebie wazne.</p></article>
            <article className="feature-card"><h2>Calendar</h2><p>Jednym kliknieciem otwierasz wydarzenie w Google Calendar lub pobierasz ICS.</p></article>
          </div>
        </section>
        <section className="auth-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">Workspace access</div>
              <h2>{authMode === "register" ? "Stworz konto" : "Zaloguj sie"}</h2>
            </div>
            <div className="mode-switch">
              <button type="button" className={authMode === "register" ? "pill active" : "pill"} onClick={() => setAuthMode("register")}>Rejestracja</button>
              <button type="button" className={authMode === "login" ? "pill active" : "pill"} onClick={() => setAuthMode("login")}>Logowanie</button>
            </div>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" ? (
              <>
                <label><span>Imie</span><input value={authDraft.name} onChange={(event) => setAuthDraft((previous) => ({ ...previous, name: event.target.value }))} /></label>
                <label><span>Rola</span><input value={authDraft.role} onChange={(event) => setAuthDraft((previous) => ({ ...previous, role: event.target.value }))} /></label>
                <label><span>Firma</span><input value={authDraft.company} onChange={(event) => setAuthDraft((previous) => ({ ...previous, company: event.target.value }))} /></label>
              </>
            ) : null}
            <label><span>Email</span><input type="email" value={authDraft.email} onChange={(event) => setAuthDraft((previous) => ({ ...previous, email: event.target.value }))} /></label>
            <label><span>Haslo</span><input type="password" value={authDraft.password} onChange={(event) => setAuthDraft((previous) => ({ ...previous, password: event.target.value }))} /></label>
            {authError ? <div className="inline-alert error">{authError}</div> : null}
            <button type="submit" className="primary-button">{authMode === "register" ? "Wejdz do workspace" : "Zaloguj"}</button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />
      <header className="topbar">
        <div>
          <div className="eyebrow">VoiceLog OS</div>
          <h1>Meeting intelligence studio</h1>
        </div>
        <div className="topbar-actions">
          <div className="status-chip">{process.env.REACT_APP_ANTHROPIC_API_KEY ? "AI analysis" : "Local fallback"}</div>
          <div className="status-chip">{getSpeechRecognitionClass() ? "Live transcript" : "Chrome for transcript"}</div>
          <div className="user-card">
            <div><strong>{currentUser.name}</strong><span>{currentUser.role || "No role"}</span></div>
            <button type="button" className="ghost-button" onClick={logout}>Wyloguj</button>
          </div>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <section className="panel">
            <div className="panel-header compact"><div><div className="eyebrow">Profil</div><h2>Uzytkownik</h2></div></div>
            <form className="stack-form" onSubmit={saveProfile}>
              <label><span>Imie</span><input value={profileDraft.name} onChange={(event) => setProfileDraft((previous) => ({ ...previous, name: event.target.value }))} /></label>
              <label><span>Rola</span><input value={profileDraft.role} onChange={(event) => setProfileDraft((previous) => ({ ...previous, role: event.target.value }))} /></label>
              <label><span>Firma</span><input value={profileDraft.company} onChange={(event) => setProfileDraft((previous) => ({ ...previous, company: event.target.value }))} /></label>
              <label><span>Timezone</span><input value={profileDraft.timezone} onChange={(event) => setProfileDraft((previous) => ({ ...previous, timezone: event.target.value }))} /></label>
              <label><span>Google email</span><input value={profileDraft.googleEmail} onChange={(event) => setProfileDraft((previous) => ({ ...previous, googleEmail: event.target.value }))} /></label>
              <button type="submit" className="secondary-button">Zapisz profil</button>
            </form>
            {profileMessage ? <div className="inline-alert success">{profileMessage}</div> : null}
          </section>

          <section className="panel">
            <div className="panel-header compact">
              <div><div className="eyebrow">Meeting brief</div><h2>{selectedMeeting ? "Edytuj spotkanie" : "Nowe spotkanie"}</h2></div>
              <button type="button" className="ghost-button" onClick={() => { setSelectedMeetingId(null); setSelectedRecordingId(null); setMeetingDraft(createEmptyMeetingDraft()); }}>Nowe</button>
            </div>
            <div className="stack-form">
              <label><span>Tytul</span><input value={meetingDraft.title} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))} /></label>
              <label><span>Kontekst</span><textarea rows="3" value={meetingDraft.context} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))} /></label>
              <label><span>Termin</span><input type="datetime-local" value={meetingDraft.startsAt} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))} /></label>
              <label><span>Czas (min)</span><input type="number" min="15" step="15" value={meetingDraft.durationMinutes} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, durationMinutes: event.target.value }))} /></label>
              <label><span>Uczestnicy</span><textarea rows="3" value={meetingDraft.attendees} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, attendees: event.target.value }))} /></label>
              <label><span>Moje potrzeby</span><textarea rows="4" value={meetingDraft.needs} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))} placeholder={"np. Decyzje budzetowe\nRyzyka wdrozenia"} /></label>
              <label><span>Co wyciagnac po spotkaniu</span><textarea rows="4" value={meetingDraft.desiredOutputs} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, desiredOutputs: event.target.value }))} placeholder={"np. Kolejne kroki\nOwnerzy zadan"} /></label>
              <label><span>Lokalizacja</span><input value={meetingDraft.location} onChange={(event) => setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))} /></label>
              <button type="button" className="primary-button" onClick={saveMeeting}>Zapisz spotkanie</button>
            </div>
            {workspaceMessage ? <div className="inline-alert success">{workspaceMessage}</div> : null}
          </section>

          <section className="panel">
            <div className="panel-header compact"><div><div className="eyebrow">Meetings</div><h2>Lista spotkan</h2></div></div>
            <div className="meeting-list">
              {userMeetings.length ? userMeetings.map((meeting) => (
                <button type="button" key={meeting.id} className={meeting.id === selectedMeetingId ? "meeting-card active" : "meeting-card"} onClick={() => selectMeeting(meeting)}>
                  <div className="meeting-card-top"><strong>{meeting.title}</strong><span>{formatDateTime(meeting.startsAt)}</span></div>
                  <p>{meeting.context || "Brak kontekstu."}</p>
                  <div className="meeting-card-meta"><span>{meeting.recordings.length} nagran</span><span>{meeting.speakerCount || 0} speakerow</span></div>
                </button>
              )) : <div className="empty-panel"><strong>Brak spotkan</strong><span>Utworz pierwsze spotkanie powyzej.</span></div>}
            </div>
          </section>
        </aside>

        <main className="workspace-main">
          {selectedMeeting ? (
            <>
              <section className="hero-panel">
                <div><div className="eyebrow">Active meeting</div><h2>{selectedMeeting.title}</h2><p>{selectedMeeting.context || "Dodaj kontekst, aby analiza lepiej rozumiala rozmowe."}</p></div>
                <div className="hero-meta">
                  <div className="metric-card"><span>Start</span><strong>{formatDateTime(selectedMeeting.startsAt)}</strong></div>
                  <div className="metric-card"><span>Czas</span><strong>{selectedMeeting.durationMinutes} min</strong></div>
                  <div className="metric-card"><span>Diarization</span><strong>{selectedMeeting.speakerCount || 0} speakerow</strong></div>
                </div>
                <div className="button-row">
                  <button type="button" className="secondary-button" onClick={() => window.open(buildGoogleCalendarUrl(selectedMeeting), "_blank", "noopener,noreferrer")}>Google Calendar</button>
                  <button type="button" className="secondary-button" onClick={() => downloadMeetingIcs(selectedMeeting)}>ICS</button>
                  <button type="button" className="secondary-button" onClick={exportTranscript} disabled={!displayRecording}>Eksport</button>
                </div>
              </section>

              <div className="main-grid">
                <section className="panel recorder-panel">
                  <div className="panel-header compact"><div><div className="eyebrow">Recorder</div><h2>Live capture</h2></div><div className="status-cluster"><span className={isRecording ? "live-pill recording" : "live-pill"}>{isRecording ? "REC" : "Idle"}</span><span className="live-pill subtle">{analysisStatus === "analyzing" ? "Analyzing" : "Ready"}</span></div></div>
                  <div className="recorder-body">
                    <div className="timer">{formatDuration(elapsed)}</div>
                    <div className="visualizer">{visualBars.map((height, index) => <span key={`${height}-${index}`} className="bar" style={{ height: `${height}px` }} />)}</div>
                    <div className="button-row">
                      <button type="button" className={isRecording ? "danger-button" : "primary-button"} onClick={isRecording ? stopRecording : startRecording}>{isRecording ? "Stop recording" : "Start recording"}</button>
                      <div className="microcopy">{recordPermission === "denied" ? "Mikrofon zablokowany." : getSpeechRecognitionClass() ? "Live transcript wlacza sie automatycznie." : "Bez live transcriptu w tej przegladarce."}</div>
                    </div>
                    {liveText ? <div className="live-text">Na zywo: {liveText}</div> : null}
                    {recordingMessage ? <div className="inline-alert info">{recordingMessage}</div> : null}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header compact"><div><div className="eyebrow">What matters</div><h2>Potrzeby i outputy</h2></div></div>
                  <div className="chip-list">{selectedMeeting.needs.length ? selectedMeeting.needs.map((need) => <span className="need-chip" key={need}>{need}</span>) : <span className="soft-copy">Dodaj potrzeby, aby analiza odpowiadala na nie osobno.</span>}</div>
                  <div className="brief-columns">
                    <div><h3>Desired outputs</h3><ul className="clean-list">{selectedMeeting.desiredOutputs.length ? selectedMeeting.desiredOutputs.map((item) => <li key={item}>{item}</li>) : <li>Brak outputow.</li>}</ul></div>
                    <div><h3>Attendees</h3><ul className="clean-list">{selectedMeeting.attendees.length ? selectedMeeting.attendees.map((item) => <li key={item}>{item}</li>) : <li>Brak uczestnikow.</li>}</ul></div>
                  </div>
                </section>

                <section className="panel transcript-panel">
                  <div className="panel-header compact"><div><div className="eyebrow">Transcript</div><h2>{displayRecording ? "Kto co powiedzial" : "Brak nagrania"}</h2></div>{selectedRecording ? <div className="status-chip">{Math.round((selectedRecording.diarizationConfidence || 0) * 100)}% confidence</div> : null}</div>
                  {selectedRecording && !audioUrls[selectedRecording.id] ? <div className="soft-copy">Audio jest dostepne tylko w aktualnej sesji przegladarki.</div> : null}
                  {selectedRecording && audioUrls[selectedRecording.id] ? <audio className="audio-player" controls src={audioUrls[selectedRecording.id]}><track kind="captions" /></audio> : null}
                  <div className="transcript-list">
                    {displayRecording?.transcript?.length ? displayRecording.transcript.map((segment) => (
                      <article key={segment.id} className="segment-card">
                        <div className="segment-meta"><strong>{labelSpeaker(displayRecording.speakerNames, segment.speakerId)}</strong><span>{formatDuration(segment.timestamp)}</span></div>
                        <p>{segment.text}</p>
                      </article>
                    )) : <div className="empty-panel large"><strong>Brak transkrypcji</strong><span>Uruchom nagrywanie, aby przypiac pierwsza rozmowe.</span></div>}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header compact"><div><div className="eyebrow">Insights</div><h2>Analiza spotkania</h2></div><div className="status-chip">{displayRecording?.analysis?.mode || "waiting"}</div></div>
                  {displayRecording?.analysis ? (
                    <div className="analysis-stack">
                      <div className="analysis-block"><h3>Summary</h3><p>{displayRecording.analysis.summary}</p></div>
                      <div className="analysis-columns">
                        <div className="analysis-block"><h3>Decisions</h3><ul className="clean-list">{displayRecording.analysis.decisions?.length ? displayRecording.analysis.decisions.map((item) => <li key={item}>{item}</li>) : <li>Brak decyzji.</li>}</ul></div>
                        <div className="analysis-block"><h3>Action items</h3><ul className="clean-list">{displayRecording.analysis.actionItems?.length ? displayRecording.analysis.actionItems.map((item) => <li key={item}>{item}</li>) : <li>Brak action items.</li>}</ul></div>
                      </div>
                      <div className="answers-grid">{displayRecording.analysis.answersToNeeds?.length ? displayRecording.analysis.answersToNeeds.map((item) => <article className="answer-card" key={`${item.need}-${item.answer}`}><strong>{item.need}</strong><p>{item.answer}</p></article>) : <div className="soft-copy">Brak odpowiedzi do potrzeb.</div>}</div>
                    </div>
                  ) : <div className="empty-panel large"><strong>Brak analizy</strong><span>Analiza pojawi sie po zatrzymaniu nagrania.</span></div>}
                </section>

                <section className="panel">
                  <div className="panel-header compact"><div><div className="eyebrow">Speaker map</div><h2>Nazwij rozmowcow</h2></div></div>
                  <div className="speaker-editor-list">
                    {Object.entries(displayRecording?.speakerNames || {}).length ? Object.entries(displayRecording.speakerNames).map(([key, value]) => (
                      <label key={key} className="speaker-editor-row"><span>Speaker {Number(key) + 1}</span><input value={value} onChange={(event) => renameSpeaker(key, event.target.value)} /></label>
                    )) : <div className="soft-copy">Mapa speakerow pojawi sie po pierwszym nagraniu.</div>}
                  </div>
                </section>

                <section className="panel recordings-panel">
                  <div className="panel-header compact"><div><div className="eyebrow">Recordings</div><h2>Historia spotkania</h2></div><div className="status-chip">{selectedMeeting.recordings.length} zapisow</div></div>
                  <div className="recordings-list">
                    {selectedMeeting.recordings.length ? selectedMeeting.recordings.map((recording) => (
                      <button type="button" key={recording.id} className={recording.id === selectedRecordingId ? "recording-card active" : "recording-card"} onClick={() => setSelectedRecordingId(recording.id)}>
                        <div className="recording-card-top"><strong>{formatDateTime(recording.createdAt)}</strong><span>{formatDuration(recording.duration)}</span></div>
                        <p>{recording.analysis?.summary || "Nagranie bez summary."}</p>
                        <div className="meeting-card-meta"><span>{recording.speakerCount || 0} speakerow</span><span>{recording.transcript.length} segmentow</span></div>
                      </button>
                    )) : <div className="empty-panel"><strong>Brak nagran</strong><span>Pierwsze nagranie pojawi sie tutaj.</span></div>}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <section className="hero-panel empty-workspace"><div className="eyebrow">Workspace</div><h2>Utworz pierwsze spotkanie</h2><p>Zacznij od briefu, potem uruchom recorder i przypnij rozmowe do konkretnego spotkania.</p></section>
          )}
        </main>
      </div>
    </div>
  );
}
