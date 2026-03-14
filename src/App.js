import { useEffect, useRef, useState } from "react";
import "./App.css";
import { analyzeMeeting } from "./lib/analysis";
import {
  changeUserPassword,
  loginUser,
  registerUser,
  updateUserProfile,
  upsertGoogleUser,
} from "./lib/auth";
import { buildGoogleCalendarUrl, downloadMeetingIcs } from "./lib/calendar";
import {
  buildMonthMatrix,
  formatCalendarEventTime,
  groupMeetingsByDay,
  isCurrentMonth,
  isToday,
  meetingsForDay,
  monthLabel,
  weekdayLabels,
} from "./lib/calendarView";
import { diarizeSegments, signatureAroundTimestamp, summarizeSpectrum } from "./lib/diarization";
import {
  GOOGLE_CLIENT_ID,
  fetchPrimaryCalendarEvents,
  renderGoogleSignInButton,
  requestGoogleCalendarAccess,
  signOutGoogleSession,
} from "./lib/google";
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
import ProfileTab from "./ProfileTab";
import TasksTab from "./TasksTab";
import { buildTaskPeople, buildTasksFromMeetings, createManualTask, TASK_STATUSES, taskListStats } from "./lib/tasks";

const DEFAULT_BARS = Array.from({ length: 24 }, (_, index) => (index % 4 === 0 ? 24 : 10));
const CALENDAR_WEEKDAYS = weekdayLabels();

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
    phone: user?.phone || "",
    location: user?.location || "",
    team: user?.team || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
    preferredInsights: Array.isArray(user?.preferredInsights) ? user.preferredInsights.join("\n") : "",
    notifyDailyDigest: Boolean(user?.notifyDailyDigest ?? true),
    autoTaskCapture: Boolean(user?.autoTaskCapture ?? true),
    preferredTaskView: user?.preferredTaskView === "kanban" ? "kanban" : "list",
  };
}

function normalizeTaskUpdatePayload(previousTask, updates) {
  const nextStatus = updates.status || previousTask.status;
  const completed =
    typeof updates.completed === "boolean" ? updates.completed : (updates.status || previousTask.status) === "done";

  return {
    ...updates,
    title: updates.title ?? previousTask.title,
    owner: updates.owner ?? previousTask.owner,
    description: updates.description ?? previousTask.description,
    dueDate: updates.dueDate ?? previousTask.dueDate,
    notes: updates.notes ?? previousTask.notes,
    important: typeof updates.important === "boolean" ? updates.important : previousTask.important,
    status: completed ? "done" : nextStatus,
    completed,
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
    .map(
      (segment) =>
        `[${formatDuration(segment.timestamp)}] ${labelSpeaker(recording.speakerNames, segment.speakerId)}: ${segment.text}`
    )
    .join("\n");
}

function eventTypeLabel(type) {
  return type === "google" ? "Google" : "VoiceLog";
}

function eventTimeLabel(entry) {
  if (!entry.startsAt) {
    return "Caly dzien";
  }

  return formatCalendarEventTime(entry.startsAt);
}

function recordingErrorMessage(error) {
  if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
    return "Nagrywanie mikrofonu wymaga bezpiecznego adresu https:// albo localhost.";
  }

  if (typeof window !== "undefined" && typeof window.MediaRecorder === "undefined") {
    return "Ta przegladarka nie obsluguje zapisu audio przez MediaRecorder.";
  }

  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Dostep do mikrofonu jest zablokowany. Odblokuj go przy ikonie klodki obok adresu strony.";
    case "NotFoundError":
      return "Nie znaleziono zadnego mikrofonu.";
    case "NotReadableError":
      return "Mikrofon jest teraz zajety przez inna aplikacje.";
    case "AbortError":
      return "Nagrywanie zostalo przerwane zanim zdazylo wystartowac.";
    default:
      return "Nie udalo sie wlaczyc nagrywania.";
  }
}

function AuthScreen({
  authMode,
  authDraft,
  authError,
  setAuthMode,
  setAuthDraft,
  submitAuth,
  googleEnabled,
  googleButtonRef,
  googleAuthMessage,
}) {
  return (
    <div className="auth-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <section className="auth-hero">
        <div className="eyebrow">VoiceLog OS</div>
        <h1>Meeting intelligence z kalendarzem i rozpoznawaniem rozmowcow.</h1>
        <p className="hero-copy">
          Planujesz spotkania, logujesz sie lokalnie albo przez Google, a po nagraniu od razu widzisz kto co mowil,
          jakie byly decyzje i czy odpowiedzi pokrywaja Twoje potrzeby.
        </p>

        <div className="hero-grid">
          <article className="feature-card">
            <h2>Diarization</h2>
            <p>Segmenty sa grupowane po sygnaturze glosu, a nie tylko po ciszy.</p>
          </article>
          <article className="feature-card">
            <h2>Calendar tab</h2>
            <p>Masz miesieczny widok spotkan w stylu Google Calendar i szybkie wejscie do wydarzen.</p>
          </article>
          <article className="feature-card">
            <h2>Need-based insights</h2>
            <p>Do kazdego spotkania zapisujesz, co chcesz z niego wyciagnac, a analiza odpowiada na te potrzeby.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Workspace access</div>
            <h2>{authMode === "register" ? "Stworz konto" : "Zaloguj sie"}</h2>
          </div>
          <div className="mode-switch">
            <button
              type="button"
              className={authMode === "register" ? "pill active" : "pill"}
              onClick={() => setAuthMode("register")}
            >
              Rejestracja
            </button>
            <button
              type="button"
              className={authMode === "login" ? "pill active" : "pill"}
              onClick={() => setAuthMode("login")}
            >
              Logowanie
            </button>
          </div>
        </div>

        <div className="google-auth-block">
          <div>
            <div className="eyebrow">Google</div>
            <strong>Logowanie przez Google</strong>
          </div>
          {googleEnabled ? (
            <div ref={googleButtonRef} className="google-button-slot" />
          ) : (
            <div className="inline-alert info">
              Dodaj `REACT_APP_GOOGLE_CLIENT_ID`, aby wlaczyc logowanie Google i synchronizacje kalendarza.
            </div>
          )}
          {googleAuthMessage ? <div className="inline-alert info">{googleAuthMessage}</div> : null}
        </div>

        <div className="auth-divider"><span>albo klasycznie</span></div>

        <form className="auth-form" onSubmit={submitAuth}>
          {authMode === "register" ? (
            <>
              <label>
                <span>Imie</span>
                <input
                  value={authDraft.name}
                  onChange={(event) => setAuthDraft((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="np. Anna Nowak"
                />
              </label>
              <label>
                <span>Rola</span>
                <input
                  value={authDraft.role}
                  onChange={(event) => setAuthDraft((previous) => ({ ...previous, role: event.target.value }))}
                  placeholder="np. Product Manager"
                />
              </label>
              <label>
                <span>Firma</span>
                <input
                  value={authDraft.company}
                  onChange={(event) => setAuthDraft((previous) => ({ ...previous, company: event.target.value }))}
                  placeholder="np. VoiceLog"
                />
              </label>
            </>
          ) : null}

          <label>
            <span>Email</span>
            <input
              type="email"
              value={authDraft.email}
              onChange={(event) => setAuthDraft((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="name@company.com"
            />
          </label>
          <label>
            <span>Haslo</span>
            <input
              type="password"
              value={authDraft.password}
              onChange={(event) => setAuthDraft((previous) => ({ ...previous, password: event.target.value }))}
              placeholder="minimum 6 znakow"
            />
          </label>
          {authError ? <div className="inline-alert error">{authError}</div> : null}
          <button type="submit" className="primary-button">
            {authMode === "register" ? "Wejdz do workspace" : "Zaloguj"}
          </button>
        </form>
      </section>
    </div>
  );
}

function CalendarTab({
  activeMonth,
  setActiveMonth,
  selectedDate,
  setSelectedDate,
  monthMatrix,
  miniMatrix,
  bucket,
  userMeetings,
  googleCalendarEvents,
  googleCalendarStatus,
  googleCalendarMessage,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  openMeetingFromCalendar,
  openGoogleCalendarForMeeting,
  googleCalendarEnabled,
}) {
  const selectedDayEntries = meetingsForDay(bucket, selectedDate).sort(
    (left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime()
  );
  const upcomingMeetings = [...userMeetings]
    .filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 6);

  function shiftMonth(amount) {
    setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + amount, 1));
  }

  function jumpToToday() {
    const today = new Date();
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return (
    <div className="calendar-layout">
      <aside className="calendar-sidebar">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Kalendarz</div>
              <h2>Mini month</h2>
            </div>
          </div>

          <div className="mini-calendar-header">
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <strong>{monthLabel(activeMonth)}</strong>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>

          <div className="mini-calendar-grid">
            {CALENDAR_WEEKDAYS.map((label) => (
              <span key={label} className="mini-calendar-weekday">
                {label}
              </span>
            ))}
            {miniMatrix.flat().map((date) => {
              const inMonth = isCurrentMonth(date, activeMonth);
              const today = isToday(date);
              const selected = date.toDateString() === selectedDate.toDateString();
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={selected ? "mini-day selected" : today ? "mini-day today" : "mini-day"}
                  data-faded={!inMonth}
                  onClick={() => {
                    setSelectedDate(date);
                    setActiveMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Google Calendar</div>
              <h2>Synchronizacja</h2>
            </div>
          </div>

          <div className="calendar-sync-card">
            <p>
              {googleCalendarEnabled
                ? "Po zalogowaniu mozesz pobrac wydarzenia z podstawowego kalendarza Google i zobaczyc je obok spotkan VoiceLog."
                : "Dodaj Google Client ID, aby wlaczyc logowanie Google i import wydarzen."}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={connectGoogleCalendar}
                disabled={!googleCalendarEnabled || googleCalendarStatus === "loading"}
              >
                {googleCalendarStatus === "loading" ? "Laczenie..." : "Pobierz wydarzenia Google"}
              </button>
              {googleCalendarEvents.length ? (
                <button type="button" className="ghost-button" onClick={disconnectGoogleCalendar}>
                  Odlacz
                </button>
              ) : null}
            </div>
            {googleCalendarMessage ? <div className="inline-alert info">{googleCalendarMessage}</div> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Upcoming</div>
              <h2>Najblizsze spotkania</h2>
            </div>
          </div>
          <div className="agenda-list">
            {upcomingMeetings.length ? (
              upcomingMeetings.map((meeting) => (
                <button
                  type="button"
                  key={meeting.id}
                  className="agenda-card"
                  onClick={() => openMeetingFromCalendar(meeting.id)}
                >
                  <strong>{meeting.title}</strong>
                  <span>{formatDateTime(meeting.startsAt)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak zaplanowanych spotkan</strong>
                <span>Dodaj spotkanie w zakladce Studio, a pojawi sie tutaj automatycznie.</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="panel calendar-board">
        <div className="calendar-board-header">
          <div className="calendar-board-actions">
            <button type="button" className="secondary-button" onClick={jumpToToday}>
              Dzisiaj
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(1)}>
              ›
            </button>
            <div>
              <div className="eyebrow">Calendar tab</div>
              <h2>{monthLabel(activeMonth)}</h2>
            </div>
          </div>
          <div className="status-cluster">
            <span className="status-chip">{userMeetings.length} spotkan VoiceLog</span>
            <span className="status-chip">{googleCalendarEvents.length} wydarzen Google</span>
          </div>
        </div>

        <div className="calendar-weekdays">
          {CALENDAR_WEEKDAYS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {monthMatrix.flat().map((date) => {
            const entries = meetingsForDay(bucket, date)
              .sort((left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime())
              .slice(0, 4);
            const currentMonth = isCurrentMonth(date, activeMonth);
            const today = isToday(date);
            const selected = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                type="button"
                key={date.toISOString()}
                className={selected ? "calendar-day selected" : "calendar-day"}
                data-muted={!currentMonth}
                onClick={() => setSelectedDate(date)}
              >
                <div className={today ? "calendar-day-number today" : "calendar-day-number"}>{date.getDate()}</div>
                <div className="calendar-day-events">
                  {entries.map((entry) => (
                    <span
                      key={`${entry.type}-${entry.id}`}
                      className={entry.type === "google" ? "calendar-pill google" : "calendar-pill meeting"}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (entry.type === "meeting") {
                          openMeetingFromCalendar(entry.id);
                        }
                      }}
                    >
                      {entry.type === "google" ? "G" : "V"} {eventTimeLabel(entry)} {entry.title}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="selected-day-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Agenda dnia</div>
              <h2>{formatDateTime(selectedDate)}</h2>
            </div>
          </div>

          <div className="agenda-list">
            {selectedDayEntries.length ? (
              selectedDayEntries.map((entry) => (
                <div key={`${entry.type}-${entry.id}`} className="agenda-card static">
                  <div className="agenda-card-top">
                    <strong>{entry.title}</strong>
                    <span>{eventTypeLabel(entry.type)}</span>
                  </div>
                  <p>{eventTimeLabel(entry)}</p>
                  {entry.type === "meeting" ? (
                    <div className="button-row">
                      <button type="button" className="ghost-button" onClick={() => openMeetingFromCalendar(entry.id)}>
                        Otworz w Studio
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openGoogleCalendarForMeeting(entry.id)}
                      >
                        Otworz w Google Calendar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Ten dzien jest pusty</strong>
                <span>Wybierz inny dzien albo dodaj nowe spotkanie.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useStoredState(STORAGE_KEYS.users, []);
  const [session, setSession] = useStoredState(STORAGE_KEYS.session, null);
  const [meetings, setMeetings] = useStoredState(STORAGE_KEYS.meetings, []);
  const [manualTasks, setManualTasks] = useStoredState(STORAGE_KEYS.manualTasks, []);
  const [taskState, setTaskState] = useStoredState(STORAGE_KEYS.taskState, {});
  const [authMode, setAuthMode] = useState("register");
  const [authDraft, setAuthDraft] = useState({ name: "", role: "", company: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [googleAuthMessage, setGoogleAuthMessage] = useState("");

  const [profileDraft, setProfileDraft] = useState(buildProfileDraft(null));
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityMessage, setSecurityMessage] = useState("");

  const [meetingDraft, setMeetingDraft] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [activeTab, setActiveTab] = useState("studio");
  const [taskFilter, setTaskFilter] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const [recordPermission, setRecordPermission] = useState("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [audioUrls, setAudioUrls] = useState({});

  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState("idle");
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [googleCalendarMessage, setGoogleCalendarMessage] = useState("");

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
  const googleButtonRef = useRef(null);
  const googleCalendarTokenRef = useRef("");

  const currentUser = users.find((user) => user.id === session?.userId) || null;
  const currentUserId = currentUser?.id || null;
  const userMeetings = currentUser
    ? [...meetings]
        .filter((meeting) => meeting.userId === currentUser.id)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    : [];
  const selectedMeeting = userMeetings.find((meeting) => meeting.id === selectedMeetingId) || null;
  const selectedRecording =
    selectedMeeting?.recordings.find((recording) => recording.id === selectedRecordingId) ||
    selectedMeeting?.recordings[0] ||
    null;
  const liveRecording =
    isRecording && recordingMeetingIdRef.current === selectedMeeting?.id
      ? {
          transcript: currentSegments,
          speakerNames: {},
          speakerCount: new Set(currentSegments.map((segment) => segment.speakerId || 0)).size,
          analysis: null,
        }
      : null;
  const displayRecording = liveRecording || selectedRecording;
  const displaySpeakerNames = displayRecording?.speakerNames || selectedMeeting?.speakerNames || {};
  const studioAnalysis = selectedRecording?.analysis || selectedMeeting?.analysis || null;
  const meetingTasks = buildTasksFromMeetings(userMeetings, manualTasks, taskState, currentUser);
  const taskPeople = buildTaskPeople(userMeetings, currentUser);
  const taskStats = taskListStats(meetingTasks);
  const taskFilters = [
    { id: "all", label: "Wszystkie", description: "Spotkania i reczne zadania", count: taskStats.all },
    { id: "assigned", label: "Przypisane", description: "Taski przypisane do Ciebie", count: taskStats.assigned },
    { id: "important", label: "Wazne", description: "Rzeczy oznaczone jako wazne", count: taskStats.important },
    { id: "completed", label: "Zakonczone", description: "Taski juz zamkniete", count: taskStats.completed },
    { id: "manual", label: "Reczne", description: "Taski dodane poza spotkaniami", count: taskStats.manual },
  ];
  const visibleTasks = meetingTasks.filter((task) => {
    if (taskFilter === "assigned") {
      return task.assignedToMe;
    }
    if (taskFilter === "important") {
      return task.important;
    }
    if (taskFilter === "completed") {
      return task.completed;
    }
    if (taskFilter === "manual") {
      return task.sourceType === "manual";
    }
    return true;
  });
  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null;
  const bucket = groupMeetingsByDay(userMeetings, googleCalendarEvents);
  const monthMatrix = buildMonthMatrix(calendarMonth);
  const miniMatrix = buildMonthMatrix(calendarMonth);
  const selectedRecordingAudioUrl = selectedRecording ? audioUrls[selectedRecording.id] : "";
  const speechRecognitionSupported = Boolean(getSpeechRecognitionClass());
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    if (!currentUserId) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      setMeetingDraft(createEmptyMeetingDraft());
      setActiveTab("studio");
      setTaskFilter("all");
      setSelectedTaskId(null);
      setGoogleCalendarStatus("idle");
      setGoogleCalendarEvents([]);
      setGoogleCalendarMessage("");
      googleCalendarTokenRef.current = "";
      return;
    }

    const personalMeetings = [...meetings]
      .filter((meeting) => meeting.userId === currentUserId)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

    if (!personalMeetings.length) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      return;
    }

    const nextSelectedMeeting = personalMeetings.find((meeting) => meeting.id === selectedMeetingId) || personalMeetings[0];
    if (nextSelectedMeeting.id !== selectedMeetingId) {
      setSelectedMeetingId(nextSelectedMeeting.id);
      setSelectedRecordingId(nextSelectedMeeting.latestRecordingId || nextSelectedMeeting.recordings[0]?.id || null);
      setMeetingDraft(meetingToDraft(nextSelectedMeeting));
    }
  }, [currentUserId, meetings, selectedMeetingId]);

  useEffect(() => {
    setProfileDraft(buildProfileDraft(currentUser));
    setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setProfileMessage("");
    setSecurityMessage("");
  }, [currentUser]);

  useEffect(() => {
    if (!selectedMeeting) {
      return;
    }

    setMeetingDraft(meetingToDraft(selectedMeeting));
  }, [selectedMeeting]);

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId(null);
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [selectedTaskId, visibleTasks]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return undefined;
    }

    let mounted = true;
    let permissionStatus;

    async function syncPermission() {
      try {
        permissionStatus = await navigator.permissions.query({ name: "microphone" });
        if (!mounted) {
          return;
        }
        setRecordPermission(permissionStatus.state);
        permissionStatus.onchange = () => setRecordPermission(permissionStatus.state);
      } catch (error) {
        console.error("Microphone permission query failed.", error);
      }
    }

    syncPermission();

    return () => {
      mounted = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    const googleButtonNode = googleButtonRef.current;

    if (currentUser || !googleEnabled || !googleButtonNode) {
      return undefined;
    }

    let active = true;

    renderGoogleSignInButton(googleButtonNode, (profile) => {
      if (!active) {
        return;
      }

      let nextUserId = null;
      setUsers((previous) => {
        const result = upsertGoogleUser(previous, profile);
        nextUserId = result.user.id;
        return result.users;
      });
      setSession({ userId: nextUserId });
      setGoogleAuthMessage(`Zalogowano przez Google jako ${profile.email}.`);
      setAuthError("");
    }).catch((error) => {
      console.error("Google sign-in render failed.", error);
      if (active) {
        setGoogleAuthMessage("Nie udalo sie zaladowac logowania Google.");
      }
    });

    return () => {
      active = false;
      googleButtonNode.innerHTML = "";
    };
  }, [currentUser, googleEnabled, setSession, setUsers]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      window.clearInterval(timerRef.current);
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      signOutGoogleSession();
    },
    []
  );

  async function loadGoogleMonthEvents(accessToken, monthDate) {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();
    const payload = await fetchPrimaryCalendarEvents(accessToken, { timeMin: monthStart, timeMax: monthEnd });
    setGoogleCalendarEvents(payload.items || []);
    setGoogleCalendarStatus("connected");
    setGoogleCalendarMessage("Pobrano wydarzenia z podstawowego kalendarza Google.");
  }

  useEffect(() => {
    if (!googleCalendarTokenRef.current) {
      return;
    }

    loadGoogleMonthEvents(googleCalendarTokenRef.current, calendarMonth).catch((error) => {
      console.error("Google Calendar refresh failed.", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Nie udalo sie odswiezyc wydarzen Google. Polacz kalendarz ponownie.");
    });
  }, [calendarMonth]);

  function selectMeeting(meeting) {
    setSelectedMeetingId(meeting.id);
    setSelectedRecordingId(meeting.latestRecordingId || meeting.recordings[0]?.id || null);
    setMeetingDraft(meetingToDraft(meeting));
    setWorkspaceMessage("");
  }

  function cleanupRecorder() {
    cancelAnimationFrame(frameRef.current);
    window.clearInterval(timerRef.current);
    frameRef.current = null;
    timerRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.onresult = null;
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Speech recognition stop failed.", error);
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

  function pumpVisualizer() {
    if (!analyserRef.current) {
      return;
    }

    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setVisualBars(
      Array.from({ length: 24 }, (_, index) => {
        const sourceIndex = Math.floor((index / 24) * data.length);
        return Math.max(6, (data[sourceIndex] / 255) * 58);
      })
    );

    if (isRecordingRef.current) {
      signatureTimelineRef.current.push({
        timestamp: (Date.now() - startTimeRef.current) / 1000,
        signature: summarizeSpectrum(data),
      });
      if (signatureTimelineRef.current.length > 1200) {
        signatureTimelineRef.current = signatureTimelineRef.current.slice(-900);
      }
    }

    frameRef.current = window.requestAnimationFrame(pumpVisualizer);
  }

  async function startRecording() {
    if (!selectedMeeting) {
      setRecordingMessage("Najpierw utworz albo wybierz spotkanie.");
      return;
    }

    if (recordPermission === "denied") {
      setRecordingMessage(
        "Mikrofon jest zablokowany w przegladarce. Kliknij ikone klodki przy adresie strony i zezwol na mikrofon."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingMessage("Ta przegladarka nie obsluguje dostepu do mikrofonu.");
      return;
    }

    if (typeof window !== "undefined" && typeof window.MediaRecorder === "undefined") {
      setRecordingMessage("Ta przegladarka nie obsluguje nagrywania audio przez MediaRecorder.");
      return;
    }

    cleanupRecorder();
    setRecordPermission("loading");
    setRecordingMessage("");
    setLiveText("");
    setCurrentSegments([]);
    setAnalysisStatus("idle");
    setVisualBars(DEFAULT_BARS);
    chunksRef.current = [];
    transcriptRef.current = [];
    signatureTimelineRef.current = [];
    recordingMeetingIdRef.current = selectedMeeting.id;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext unavailable");
      }

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
        const rawSegments = transcriptRef.current.map((segment) => ({
          ...segment,
          signature: segment.signature || signatureAroundTimestamp(signatureTimelineRef.current, segment.timestamp),
        }));

        const diarization = diarizeSegments(rawSegments);
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
        setAnalysisStatus("done");
        setRecordingMessage(
          diarization.segments.length
            ? "Nagranie zapisane i przeanalizowane."
            : "Audio zapisane, ale ta przegladarka nie dostarczyla transkrypcji live."
        );
        setRecordPermission("granted");
        cleanupRecorder();
        setVisualBars(DEFAULT_BARS);
      };

      recorder.start(900);

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
              console.error("Speech recognition restart failed.", error);
            }
          }
        };
        recognitionRef.current = recognition;
        recognition.start();
      }

      startTimeRef.current = Date.now();
      setElapsed(0);
      setIsRecording(true);
      setRecordPermission("granted");
      timerRef.current = window.setInterval(() => {
        if (isRecordingRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 300);
      pumpVisualizer();
    } catch (error) {
      console.error("Recording start failed.", error);
      cleanupRecorder();
      setIsRecording(false);
      setRecordPermission("denied");
      setRecordingMessage(recordingErrorMessage(error));
      setVisualBars(DEFAULT_BARS);
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
      console.error("Recorder stop failed.", error);
    }

    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.error("Speech recognition stop failed.", error);
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

    setSecurityMessage("");
    setUsers((previous) => updateUserProfile(previous, currentUser.id, profileDraft));
    setProfileMessage("Profil zapisany.");
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!currentUser) {
      return;
    }

    setProfileMessage("");

    try {
      const nextUsers = await changeUserPassword(users, currentUser.id, passwordDraft);
      setUsers(nextUsers);
      setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSecurityMessage("Haslo zostalo zmienione.");
    } catch (error) {
      setSecurityMessage(error.message);
    }
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

  function createTaskFromComposer(draft) {
    if (!currentUser) {
      return null;
    }

    const task = createManualTask(currentUser.id, draft);
    setManualTasks((previous) => [task, ...previous]);
    setTaskFilter("all");
    return task.id;
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const normalizedUpdates = normalizeTaskUpdatePayload(task, updates);

    if (task.sourceType === "manual") {
      setManualTasks((previous) =>
        previous.map((item) =>
          item.id !== taskId
            ? item
            : {
                ...item,
                ...normalizedUpdates,
                updatedAt: new Date().toISOString(),
              }
        )
      );
      return;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        ...normalizedUpdates,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function deleteTask(taskId) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    if (task.sourceType === "manual") {
      setManualTasks((previous) => previous.filter((item) => item.id !== taskId));
      return;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        archived: true,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function renameSpeaker(speakerId, nextValue) {
    if (!selectedMeeting || !selectedRecording) {
      return;
    }

    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== selectedMeeting.id) {
          return meeting;
        }

        return {
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
                  speakerNames: {
                    ...recording.speakerNames,
                    [String(speakerId)]: nextValue,
                  },
                  analysis: recording.analysis
                    ? {
                        ...recording.analysis,
                        speakerLabels: {
                          ...(recording.analysis.speakerLabels || recording.speakerNames),
                          [String(speakerId)]: nextValue,
                        },
                      }
                    : recording.analysis,
                }
          ),
        };
      })
    );
  }

  function exportTranscript() {
    if (!displayRecording) {
      return;
    }

    const safeTitle = (selectedMeeting?.title || "meeting").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadTextFile(`${safeTitle || "meeting"}-transcript.txt`, recordingToText(displayRecording));
  }

  function logout() {
    if (isRecording) {
      stopRecording();
    }

    setSession(null);
    setActiveTab("studio");
    setTaskFilter("all");
    setSelectedTaskId(null);
    setProfileMessage("");
    setSecurityMessage("");
    setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setGoogleCalendarEvents([]);
    setGoogleCalendarMessage("");
    setGoogleCalendarStatus("idle");
    googleCalendarTokenRef.current = "";
    signOutGoogleSession();
  }

  async function connectGoogleCalendar() {
    if (!currentUser) {
      return;
    }

    if (!googleEnabled) {
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Dodaj REACT_APP_GOOGLE_CLIENT_ID, aby laczyc Google Calendar.");
      return;
    }

    try {
      setGoogleCalendarStatus("loading");
      setGoogleCalendarMessage("");
      const response = await requestGoogleCalendarAccess({
        loginHint: currentUser.googleEmail || currentUser.email,
      });
      googleCalendarTokenRef.current = response.access_token;
      await loadGoogleMonthEvents(response.access_token, calendarMonth);
    } catch (error) {
      console.error("Google Calendar connect failed.", error);
      setGoogleCalendarStatus("error");
      setGoogleCalendarMessage("Nie udalo sie polaczyc z Google Calendar.");
    }
  }

  function disconnectGoogleCalendar() {
    googleCalendarTokenRef.current = "";
    setGoogleCalendarStatus("idle");
    setGoogleCalendarEvents([]);
    setGoogleCalendarMessage("Polaczenie z Google Calendar zostalo odlaczone.");
  }

  function openMeetingFromCalendar(meetingId) {
    const meeting = userMeetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return;
    }

    selectMeeting(meeting);
    setActiveTab("studio");
  }

  function openGoogleCalendarForMeeting(meetingId) {
    const meeting = userMeetings.find((item) => item.id === meetingId);
    if (!meeting) {
      return;
    }

    window.open(buildGoogleCalendarUrl(meeting), "_blank", "noopener,noreferrer");
  }

  if (!currentUser) {
    return (
      <AuthScreen
        authMode={authMode}
        authDraft={authDraft}
        authError={authError}
        setAuthMode={setAuthMode}
        setAuthDraft={setAuthDraft}
        submitAuth={submitAuth}
        googleEnabled={googleEnabled}
        googleButtonRef={googleButtonRef}
        googleAuthMessage={googleAuthMessage}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <header className="topbar">
        <div className="topbar-title">
          <div>
            <div className="eyebrow">VoiceLog OS</div>
            <h1>Meeting intelligence studio</h1>
          </div>
          <div className="tab-switcher">
            <button
              type="button"
              className={activeTab === "studio" ? "tab-pill active" : "tab-pill"}
              onClick={() => setActiveTab("studio")}
            >
              Studio
            </button>
            <button
              type="button"
              className={activeTab === "calendar" ? "tab-pill active" : "tab-pill"}
              onClick={() => setActiveTab("calendar")}
            >
              Kalendarz
            </button>
            <button
              type="button"
              className={activeTab === "tasks" ? "tab-pill active" : "tab-pill"}
              onClick={() => setActiveTab("tasks")}
            >
              Zadania
            </button>
            <button
              type="button"
              className={activeTab === "profile" ? "tab-pill active" : "tab-pill"}
              onClick={() => setActiveTab("profile")}
            >
              Profil
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="status-chip">{speechRecognitionSupported ? "Live transcript ready" : "Chrome for transcript"}</div>
          <div className="status-chip">{googleEnabled ? "Google ready" : "Google env missing"}</div>
          <div className="user-card">
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser.name} className="avatar" /> : null}
            <div>
              <strong>{currentUser.name}</strong>
              <span>
                {currentUser.role || "No role"}
                {currentUser.provider === "google" ? " - Google sign-in" : ""}
              </span>
            </div>
            <button type="button" className="ghost-button" onClick={logout}>
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      {activeTab === "calendar" ? (
        <CalendarTab
          activeMonth={calendarMonth}
          setActiveMonth={setCalendarMonth}
          selectedDate={selectedCalendarDate}
          setSelectedDate={setSelectedCalendarDate}
          monthMatrix={monthMatrix}
          miniMatrix={miniMatrix}
          bucket={bucket}
          userMeetings={userMeetings}
          googleCalendarEvents={googleCalendarEvents}
          googleCalendarStatus={googleCalendarStatus}
          googleCalendarMessage={googleCalendarMessage}
          connectGoogleCalendar={connectGoogleCalendar}
          disconnectGoogleCalendar={disconnectGoogleCalendar}
          openMeetingFromCalendar={openMeetingFromCalendar}
          openGoogleCalendarForMeeting={openGoogleCalendarForMeeting}
          googleCalendarEnabled={googleEnabled}
        />
      ) : activeTab === "tasks" ? (
        <TasksTab
          filters={taskFilters}
          activeFilter={taskFilter}
          onFilterChange={setTaskFilter}
          stats={taskStats}
          tasks={visibleTasks}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTaskId}
          onCreateTask={createTaskFromComposer}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onOpenMeeting={openMeetingFromCalendar}
          peopleOptions={taskPeople}
          defaultView={currentUser.preferredTaskView || "list"}
          statuses={TASK_STATUSES}
        />
      ) : activeTab === "profile" ? (
        <ProfileTab
          currentUser={currentUser}
          profileDraft={profileDraft}
          setProfileDraft={setProfileDraft}
          saveProfile={saveProfile}
          profileMessage={profileMessage}
          googleEnabled={googleEnabled}
          googleCalendarStatus={googleCalendarStatus}
          googleCalendarMessage={googleCalendarMessage}
          googleCalendarEventsCount={googleCalendarEvents.length}
          connectGoogleCalendar={connectGoogleCalendar}
          disconnectGoogleCalendar={disconnectGoogleCalendar}
          passwordDraft={passwordDraft}
          setPasswordDraft={setPasswordDraft}
          updatePassword={updatePassword}
          securityMessage={securityMessage}
        />
      ) : (
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <section className="panel">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Account</div>
                  <h2>Workspace owner</h2>
                </div>
                <button type="button" className="ghost-button" onClick={() => setActiveTab("profile")}>
                  Otworz profil
                </button>
              </div>

              <div className="workspace-owner-card">
                <div className="user-card">
                  {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser.name} className="avatar" /> : null}
                  <div>
                    <strong>{currentUser.name}</strong>
                    <span>
                      {currentUser.role || "Brak roli"}
                      {currentUser.company ? ` • ${currentUser.company}` : ""}
                    </span>
                  </div>
                </div>

                <div className="profile-quick-grid">
                  <div className="task-detail-chip">
                    <span>Email</span>
                    <strong>{currentUser.email}</strong>
                  </div>
                  <div className="task-detail-chip">
                    <span>Team</span>
                    <strong>{currentUser.team || "Brak"}</strong>
                  </div>
                  <div className="task-detail-chip">
                    <span>Timezone</span>
                    <strong>{currentUser.timezone || "Europe/Warsaw"}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Meeting brief</div>
                  <h2>{selectedMeeting ? "Edytuj spotkanie" : "Nowe spotkanie"}</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setSelectedMeetingId(null);
                    setSelectedRecordingId(null);
                    setMeetingDraft(createEmptyMeetingDraft());
                  }}
                >
                  Nowe
                </button>
              </div>

              <div className="stack-form">
                <label>
                  <span>Tytul</span>
                  <input
                    value={meetingDraft.title}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Kontekst</span>
                  <textarea
                    rows="3"
                    value={meetingDraft.context}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Termin</span>
                  <input
                    type="datetime-local"
                    value={meetingDraft.startsAt}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Czas (min)</span>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={meetingDraft.durationMinutes}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, durationMinutes: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Uczestnicy</span>
                  <textarea
                    rows="3"
                    value={meetingDraft.attendees}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, attendees: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Moje potrzeby</span>
                  <textarea
                    rows="4"
                    value={meetingDraft.needs}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))}
                    placeholder={"np. Decyzje budzetowe\nRyzyka wdrozenia"}
                  />
                </label>
                <label>
                  <span>Co wyciagnac po spotkaniu</span>
                  <textarea
                    rows="4"
                    value={meetingDraft.desiredOutputs}
                    onChange={(event) =>
                      setMeetingDraft((previous) => ({ ...previous, desiredOutputs: event.target.value }))
                    }
                    placeholder={"np. Kolejne kroki\nOwnerzy zadan"}
                  />
                </label>
                <label>
                  <span>Lokalizacja</span>
                  <input
                    value={meetingDraft.location}
                    onChange={(event) => setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))}
                  />
                </label>
                <button type="button" className="primary-button" onClick={saveMeeting}>
                  Zapisz spotkanie
                </button>
              </div>

              {workspaceMessage ? <div className="inline-alert success">{workspaceMessage}</div> : null}
            </section>

            <section className="panel">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Meetings</div>
                  <h2>Lista spotkan</h2>
                </div>
              </div>
              <div className="meeting-list">
                {userMeetings.length ? (
                  userMeetings.map((meeting) => (
                    <button
                      type="button"
                      key={meeting.id}
                      className={meeting.id === selectedMeetingId ? "meeting-card active" : "meeting-card"}
                      onClick={() => selectMeeting(meeting)}
                    >
                      <div className="meeting-card-top">
                        <strong>{meeting.title}</strong>
                        <span>{formatDateTime(meeting.startsAt)}</span>
                      </div>
                      <p>{meeting.context || "Brak kontekstu."}</p>
                      <div className="meeting-card-meta">
                        <span>{meeting.recordings.length} nagran</span>
                        <span>{meeting.speakerCount || 0} speakerow</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="empty-panel">
                    <strong>Brak spotkan</strong>
                    <span>Utworz pierwsze spotkanie powyzej albo zaloguj sie przez Google.</span>
                  </div>
                )}
              </div>
            </section>
          </aside>

          <main className="workspace-main">
            {selectedMeeting ? (
              <>
                <section className="hero-panel">
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
                      <strong>{selectedMeeting.speakerCount || 0} speakerow</strong>
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
                    <button type="button" className="secondary-button" onClick={exportTranscript} disabled={!displayRecording}>
                      Eksport
                    </button>
                  </div>
                </section>

                <div className="main-grid">
                  <section className="panel recorder-panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">Recorder</div>
                        <h2>Live capture</h2>
                      </div>
                      <div className="status-cluster">
                        <span className={isRecording ? "live-pill recording" : "live-pill"}>{isRecording ? "REC" : "Idle"}</span>
                        <span className="live-pill subtle">{analysisStatus === "analyzing" ? "Analyzing" : "Ready"}</span>
                      </div>
                    </div>

                    <div className="recorder-body">
                      <div className="timer">{formatDuration(elapsed)}</div>
                      <div className="visualizer">
                        {visualBars.map((height, index) => (
                          <span key={`${height}-${index}`} className="bar" style={{ height: `${height}px` }} />
                        ))}
                      </div>
                      <div className="button-row align-center">
                        <button
                          type="button"
                          className={isRecording ? "danger-button" : "primary-button"}
                          onClick={isRecording ? stopRecording : startRecording}
                        >
                          {isRecording ? "Stop recording" : "Start recording"}
                        </button>
                        <div className="microcopy">
                          {recordPermission === "denied"
                            ? "Mikrofon zablokowany. Odblokuj go przy pasku adresu."
                            : speechRecognitionSupported
                              ? "Live transcript wlacza sie automatycznie."
                              : "Audio zlapiesz normalnie, ale bez live transcriptu w tej przegladarce."}
                        </div>
                      </div>
                      {liveText ? <div className="live-text">Na zywo: {liveText}</div> : null}
                      {recordingMessage ? <div className="inline-alert info">{recordingMessage}</div> : null}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">What matters</div>
                        <h2>Potrzeby i outputy</h2>
                      </div>
                    </div>
                    <div className="chip-list">
                      {selectedMeeting.needs.length ? (
                        selectedMeeting.needs.map((need) => (
                          <span className="need-chip" key={need}>
                            {need}
                          </span>
                        ))
                      ) : (
                        <span className="soft-copy">Dodaj potrzeby, aby analiza odpowiadala na nie osobno.</span>
                      )}
                    </div>
                    <div className="brief-columns">
                      <div>
                        <h3>Desired outputs</h3>
                        <ul className="clean-list">
                          {selectedMeeting.desiredOutputs.length ? (
                            selectedMeeting.desiredOutputs.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>Brak outputow.</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <h3>Attendees</h3>
                        <ul className="clean-list">
                          {selectedMeeting.attendees.length ? (
                            selectedMeeting.attendees.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>Brak uczestnikow.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section className="panel transcript-panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">Transcript</div>
                        <h2>{displayRecording ? "Kto co powiedzial" : "Brak nagrania"}</h2>
                      </div>
                      {selectedRecording ? (
                        <div className="status-cluster">
                          <span className="status-chip">{selectedRecording.speakerCount || 0} speakerow</span>
                          <span className="status-chip">
                            {Math.round((selectedRecording.diarizationConfidence || 0) * 100)}% confidence
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {selectedRecordingAudioUrl ? (
                      <audio className="audio-player" controls src={selectedRecordingAudioUrl}>
                        <track kind="captions" />
                      </audio>
                    ) : selectedRecording ? (
                      <div className="soft-copy">Audio jest dostepne tylko w aktualnej sesji przegladarki.</div>
                    ) : null}

                    <div className="transcript-list">
                      {displayRecording?.transcript?.length ? (
                        displayRecording.transcript.map((segment) => (
                          <article key={segment.id} className="segment-card">
                            <div className="segment-meta">
                              <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                              <span>{formatDuration(segment.timestamp)}</span>
                            </div>
                            <p>{segment.text}</p>
                          </article>
                        ))
                      ) : (
                        <div className="empty-panel large">
                          <strong>Brak transkrypcji</strong>
                          <span>Uruchom nagrywanie, aby przypiac pierwsza rozmowe.</span>
                        </div>
                      )}
                    </div>
                  </section>

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

                  <section className="panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">Speaker map</div>
                        <h2>Nazwij rozmowcow</h2>
                      </div>
                    </div>
                    <div className="speaker-editor-list">
                      {Object.entries(displaySpeakerNames).length ? (
                        Object.entries(displaySpeakerNames).map(([key, value]) => (
                          <label key={key} className="speaker-editor-row">
                            <span>Speaker {Number(key) + 1}</span>
                            <input value={value} onChange={(event) => renameSpeaker(key, event.target.value)} />
                          </label>
                        ))
                      ) : (
                        <div className="soft-copy">Mapa speakerow pojawi sie po pierwszym nagraniu.</div>
                      )}
                    </div>
                  </section>

                  <section className="panel recordings-panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">Recordings</div>
                        <h2>Historia spotkania</h2>
                      </div>
                      <div className="status-chip">{selectedMeeting.recordings.length} zapisow</div>
                    </div>
                    <div className="recordings-list">
                      {selectedMeeting.recordings.length ? (
                        selectedMeeting.recordings.map((recording) => (
                          <button
                            type="button"
                            key={recording.id}
                            className={recording.id === selectedRecordingId ? "recording-card active" : "recording-card"}
                            onClick={() => setSelectedRecordingId(recording.id)}
                          >
                            <div className="recording-card-top">
                              <strong>{formatDateTime(recording.createdAt)}</strong>
                              <span>{formatDuration(recording.duration)}</span>
                            </div>
                            <p>{recording.analysis?.summary || "Nagranie bez summary."}</p>
                            <div className="meeting-card-meta">
                              <span>{recording.speakerCount || 0} speakerow</span>
                              <span>{recording.transcript.length} segmentow</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="empty-panel">
                          <strong>Brak nagran</strong>
                          <span>Pierwsze nagranie pojawi sie tutaj.</span>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <section className="hero-panel empty-workspace">
                <div className="eyebrow">Workspace</div>
                <h2>Utworz pierwsze spotkanie</h2>
                <p>
                  Zacznij od briefu, potem uruchom recorder i przypnij rozmowe do konkretnego spotkania albo zaplanuj
                  termin w zakladce Kalendarz.
                </p>
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
