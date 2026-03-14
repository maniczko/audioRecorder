import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AuthScreen from "./AuthScreen";
import CalendarTab from "./CalendarTab";
import ProfileTab from "./ProfileTab";
import PeopleTab from "./PeopleTab";
import StudioTab from "./StudioTab";
import TasksTab from "./TasksTab";
import useStoredState from "./hooks/useStoredState";
import { analyzeMeeting } from "./lib/analysis";
import { buildProfileDraft, normalizeTaskUpdatePayload } from "./lib/appState";
import {
  changeUserPassword,
  loginUser,
  requestPasswordReset,
  registerUser,
  resetPasswordWithCode,
  updateUserProfile,
  upsertGoogleUser,
} from "./lib/auth";
import { getAudioBlob, saveAudioBlob } from "./lib/audioStore";
import { buildGoogleCalendarUrl } from "./lib/calendar";
import { buildMonthMatrix, groupMeetingsByDay } from "./lib/calendarView";
import { diarizeSegments, summarizeSpectrum, verifyRecognizedSegments } from "./lib/diarization";
import { buildMeetingNotesText, printMeetingPdf, slugifyExportTitle } from "./lib/export";
import {
  GOOGLE_CLIENT_ID,
  createGoogleTask,
  fetchGoogleTaskLists,
  fetchGoogleTasks,
  fetchPrimaryCalendarEvents,
  renderGoogleSignInButton,
  requestGoogleCalendarAccess,
  requestGoogleTasksAccess,
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
import { buildPeopleProfiles } from "./lib/people";
import {
  DEFAULT_BARS,
  getSpeechRecognitionClass,
  recordingErrorMessage,
  recordingToText,
} from "./lib/recording";
import {
  STORAGE_KEYS,
  createId,
  downloadTextFile,
  formatDateTime,
  formatDuration,
} from "./lib/storage";
import {
  buildTaskColumns,
  buildTaskPeople,
  buildTaskTags,
  buildTasksFromMeetings,
  createManualTask,
  createTaskColumn,
  createTaskFromGoogle,
  updateTaskColumns,
  upsertGoogleImportedTasks,
} from "./lib/tasks";
import { createBrowserTranscriptionController, TRANSCRIPTION_PROVIDER } from "./lib/transcription";
import { migrateWorkspaceData, resolveWorkspaceForUser, workspaceMembers } from "./lib/workspace";

const EMPTY_AUTH_DRAFT = {
  name: "",
  role: "",
  company: "",
  email: "",
  password: "",
  workspaceMode: "create",
  workspaceName: "",
  workspaceCode: "",
};

const EMPTY_RESET_DRAFT = {
  email: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
};

const EMPTY_PASSWORD_DRAFT = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function revokeAudioUrl(url) {
  if (url && typeof URL !== "undefined" && URL.revokeObjectURL) {
    URL.revokeObjectURL(url);
  }
}

function buildFallbackAnalysis(message, diarization) {
  return {
    summary: message,
    decisions: [],
    actionItems: [],
    followUps: [],
    needsCoverage: [],
    speakerLabels: diarization.speakerNames,
    speakerCount: diarization.speakerCount,
  };
}

export default function MainApp() {
  const [users, setUsers] = useStoredState(STORAGE_KEYS.users, []);
  const [session, setSession] = useStoredState(STORAGE_KEYS.session, null);
  const [workspaces, setWorkspaces] = useStoredState(STORAGE_KEYS.workspaces, []);
  const [meetings, setMeetings] = useStoredState(STORAGE_KEYS.meetings, []);
  const [manualTasks, setManualTasks] = useStoredState(STORAGE_KEYS.manualTasks, []);
  const [taskState, setTaskState] = useStoredState(STORAGE_KEYS.taskState, {});
  const [taskBoards, setTaskBoards] = useStoredState(STORAGE_KEYS.taskBoards, {});

  const [authMode, setAuthMode] = useState("register");
  const [authDraft, setAuthDraft] = useState(EMPTY_AUTH_DRAFT);
  const [authError, setAuthError] = useState("");
  const [googleAuthMessage, setGoogleAuthMessage] = useState("");
  const [resetDraft, setResetDraft] = useState(EMPTY_RESET_DRAFT);
  const [resetMessage, setResetMessage] = useState("");
  const [resetPreviewCode, setResetPreviewCode] = useState("");
  const [resetExpiresAt, setResetExpiresAt] = useState("");

  const [profileDraft, setProfileDraft] = useState(buildProfileDraft(null));
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordDraft, setPasswordDraft] = useState(EMPTY_PASSWORD_DRAFT);
  const [securityMessage, setSecurityMessage] = useState("");

  const [meetingDraft, setMeetingDraft] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [activeTab, setActiveTab] = useState("studio");

  const [recordPermission, setRecordPermission] = useState("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [audioUrls, setAudioUrls] = useState({});

  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState("idle");
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [googleCalendarMessage, setGoogleCalendarMessage] = useState("");
  const [googleTasksStatus, setGoogleTasksStatus] = useState("idle");
  const [googleTaskLists, setGoogleTaskLists] = useState([]);
  const [selectedGoogleTaskListId, setSelectedGoogleTaskListId] = useState("");
  const [googleTasksMessage, setGoogleTasksMessage] = useState("");

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
  const googleTasksTokenRef = useRef("");

  const currentUser = users.find((user) => user.id === session?.userId) || null;
  const currentUserId = currentUser?.id || null;
  const currentWorkspaceId = currentUser
    ? resolveWorkspaceForUser(currentUser, workspaces, session?.workspaceId)
    : null;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;
  const currentWorkspaceMembers = workspaceMembers(users, currentWorkspace);
  const availableWorkspaces = useMemo(
    () =>
      currentUser ? workspaces.filter((workspace) => (workspace.memberIds || []).includes(currentUser.id)) : [],
    [currentUser, workspaces]
  );
  const userMeetings = useMemo(
    () =>
      currentWorkspaceId
        ? [...meetings]
            .filter((meeting) => meeting.workspaceId === currentWorkspaceId)
            .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        : [],
    [currentWorkspaceId, meetings]
  );
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
  const taskColumns = buildTaskColumns(taskBoards, currentWorkspaceId);
  const meetingTasks = buildTasksFromMeetings(
    userMeetings,
    manualTasks,
    taskState,
    currentUser,
    taskColumns,
    currentWorkspaceId
  );
  const taskPeople = buildTaskPeople(userMeetings, currentUser, currentWorkspaceMembers);
  const taskTags = buildTaskTags(meetingTasks, userMeetings);
  const peopleProfiles = buildPeopleProfiles(userMeetings, meetingTasks, currentUser, currentWorkspaceMembers);
  const bucket = groupMeetingsByDay(userMeetings, googleCalendarEvents);
  const monthMatrix = buildMonthMatrix(calendarMonth);
  const miniMatrix = buildMonthMatrix(calendarMonth);
  const selectedRecordingAudioUrl = selectedRecording ? audioUrls[selectedRecording.id] : "";
  const speechRecognitionSupported = Boolean(getSpeechRecognitionClass());
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID);

  useEffect(() => {
    const migration = migrateWorkspaceData({
      users,
      workspaces,
      meetings,
      manualTasks,
      taskBoards,
      session,
    });

    if (!migration.changed) {
      return;
    }

    setUsers(migration.users);
    setWorkspaces(migration.workspaces);
    setMeetings(migration.meetings);
    setManualTasks(migration.manualTasks);
    setTaskBoards(migration.taskBoards);
    setSession(migration.session);
  }, [
    users,
    workspaces,
    meetings,
    manualTasks,
    taskBoards,
    session,
    setManualTasks,
    setMeetings,
    setSession,
    setTaskBoards,
    setUsers,
    setWorkspaces,
  ]);

  useEffect(() => {
    if (!currentUser || !currentWorkspaceId || session?.workspaceId === currentWorkspaceId) {
      return;
    }

    setSession((previous) =>
      previous
        ? {
            ...previous,
            workspaceId: currentWorkspaceId,
          }
        : previous
    );
  }, [currentUser, currentWorkspaceId, session?.workspaceId, setSession]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    if (!currentUserId || !currentWorkspaceId) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      setMeetingDraft(createEmptyMeetingDraft());
      setActiveTab("studio");
      setGoogleCalendarStatus("idle");
      setGoogleCalendarEvents([]);
      setGoogleCalendarMessage("");
      setGoogleTasksStatus("idle");
      setGoogleTaskLists([]);
      setSelectedGoogleTaskListId("");
      setGoogleTasksMessage("");
      googleCalendarTokenRef.current = "";
      googleTasksTokenRef.current = "";
      return;
    }

    const workspaceMeetings = [...meetings]
      .filter((meeting) => meeting.workspaceId === currentWorkspaceId)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

    if (!workspaceMeetings.length) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      return;
    }

    const nextSelectedMeeting =
      workspaceMeetings.find((meeting) => meeting.id === selectedMeetingId) || workspaceMeetings[0];
    if (nextSelectedMeeting.id !== selectedMeetingId) {
      setSelectedMeetingId(nextSelectedMeeting.id);
      setSelectedRecordingId(
        nextSelectedMeeting.latestRecordingId || nextSelectedMeeting.recordings[0]?.id || null
      );
      setMeetingDraft(meetingToDraft(nextSelectedMeeting));
    }
  }, [currentUserId, currentWorkspaceId, meetings, selectedMeetingId]);

  useEffect(() => {
    setProfileDraft(buildProfileDraft(currentUser));
    setPasswordDraft(EMPTY_PASSWORD_DRAFT);
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
    setAuthError("");
    setGoogleAuthMessage("");
    if (authMode !== "forgot") {
      setResetMessage("");
      setResetPreviewCode("");
      setResetExpiresAt("");
    }
  }, [authMode]);

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

      const result = upsertGoogleUser(users, workspaces, profile);
      setUsers(result.users);
      setWorkspaces(result.workspaces);
      setSession({ userId: result.user.id, workspaceId: result.workspaceId });
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
  }, [currentUser, googleEnabled, setSession, setUsers, setWorkspaces, users, workspaces]);

  useEffect(() => {
    if (!userMeetings.length) {
      setAudioUrls((previous) => {
        Object.values(previous).forEach((url) => revokeAudioUrl(url));
        return {};
      });
      return;
    }

    let cancelled = false;
    const recordingIds = new Set(
      userMeetings.flatMap((meeting) => (meeting.recordings || []).map((recording) => recording.id))
    );

    async function hydrateAudio() {
      for (const recordingId of recordingIds) {
        if (cancelled || audioUrlsRef.current[recordingId]) {
          continue;
        }

        try {
          const blob = await getAudioBlob(recordingId);
          if (!blob || cancelled || typeof URL === "undefined" || !URL.createObjectURL) {
            continue;
          }

          const nextUrl = URL.createObjectURL(blob);
          setAudioUrls((previous) => {
            if (previous[recordingId]) {
              revokeAudioUrl(nextUrl);
              return previous;
            }

            return {
              ...previous,
              [recordingId]: nextUrl,
            };
          });
        } catch (error) {
          console.error(`Audio hydration failed for ${recordingId}.`, error);
        }
      }

      if (cancelled) {
        return;
      }

      setAudioUrls((previous) => {
        let changed = false;
        const next = { ...previous };

        Object.entries(previous).forEach(([recordingId, url]) => {
          if (!recordingIds.has(recordingId)) {
            revokeAudioUrl(url);
            delete next[recordingId];
            changed = true;
          }
        });

        return changed ? next : previous;
      });
    }

    hydrateAudio();

    return () => {
      cancelled = true;
    };
  }, [userMeetings]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(frameRef.current);
        window.clearInterval(timerRef.current);
      }
      Object.values(audioUrlsRef.current).forEach((url) => revokeAudioUrl(url));
      signOutGoogleSession();
    },
    []
  );

  async function loadGoogleMonthEvents(accessToken, monthDate) {
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1).toISOString();
    const payload = await fetchPrimaryCalendarEvents(accessToken, {
      timeMin: monthStart,
      timeMax: monthEnd,
    });
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

  function createAdHocMeeting() {
    if (!currentUser || !currentWorkspaceId) {
      return null;
    }

    const timestamp = new Date();
    const adHocMeeting = createMeeting(
      currentUser.id,
      {
        title: `Ad hoc ${new Intl.DateTimeFormat("pl-PL", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(timestamp)}`,
        context: "Szybkie nagranie bez wczesniejszego briefu.",
        startsAt: new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .slice(0, 16),
        durationMinutes: 30,
        attendees: currentWorkspaceMembers.map((member) => member.name).filter(Boolean).join("\n"),
        tags: "ad-hoc",
        needs: "",
        desiredOutputs: "",
        location: "",
      },
      {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
      }
    );

    setMeetings((previous) => upsertMeeting(previous, adHocMeeting));
    selectMeeting(adHocMeeting);
    setWorkspaceMessage("Utworzono spotkanie ad hoc.");
    return adHocMeeting;
  }

  function cleanupRecorder() {
    if (typeof window !== "undefined") {
      window.cancelAnimationFrame(frameRef.current);
      window.clearInterval(timerRef.current);
    }
    frameRef.current = null;
    timerRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.clearHandlers?.();
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

    if (typeof window !== "undefined") {
      frameRef.current = window.requestAnimationFrame(pumpVisualizer);
    }
  }

  async function startRecording(options = {}) {
    const activeMeeting = options.adHoc || !selectedMeeting ? createAdHocMeeting() : selectedMeeting;
    if (!activeMeeting) {
      setRecordingMessage("Nie udalo sie przygotowac spotkania do nagrania.");
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
    recordingMeetingIdRef.current = activeMeeting.id;

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
        const targetMeeting =
          userMeetings.find((meeting) => meeting.id === recordingMeetingIdRef.current) || activeMeeting;

        try {
          const diarization = diarizeSegments(transcriptRef.current);
          const verifiedSegments = verifyRecognizedSegments(diarization.segments);
          const recordingId = createId("recording");
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });

          try {
            await saveAudioBlob(recordingId, blob);
          } catch (error) {
            console.error("Audio persistence failed.", error);
          }

          if (typeof URL !== "undefined" && URL.createObjectURL) {
            const nextAudioUrl = URL.createObjectURL(blob);
            setAudioUrls((previous) => {
              const previousUrl = previous[recordingId];
              if (previousUrl && previousUrl !== nextAudioUrl) {
                revokeAudioUrl(previousUrl);
              }

              return {
                ...previous,
                [recordingId]: nextAudioUrl,
              };
            });
          }

          setCurrentSegments(verifiedSegments);
          setAnalysisStatus("analyzing");

          let analysis;
          try {
            analysis = await analyzeMeeting({
              meeting: targetMeeting,
              segments: verifiedSegments,
              speakerNames: diarization.speakerNames,
              diarization,
            });
          } catch (error) {
            console.error("Meeting analysis failed.", error);
            analysis = buildFallbackAnalysis(
              "Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty do dalszej pracy.",
              diarization
            );
          }

          const recording = {
            id: recordingId,
            createdAt: new Date().toISOString(),
            duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
            transcript: verifiedSegments,
            speakerNames: analysis.speakerLabels || diarization.speakerNames,
            speakerCount: analysis.speakerCount || diarization.speakerCount,
            diarizationConfidence: diarization.confidence,
            reviewSummary: {
              needsReview: verifiedSegments.filter(
                (segment) => segment.verificationStatus === "review"
              ).length,
              approved: verifiedSegments.filter(
                (segment) => segment.verificationStatus === "verified"
              ).length,
            },
            transcriptionProvider: TRANSCRIPTION_PROVIDER.id,
            storageMode: "indexeddb",
            analysis,
          };

          setMeetings((previous) =>
            previous.map((meeting) =>
              meeting.id === recordingMeetingIdRef.current ? attachRecording(meeting, recording) : meeting
            )
          );
          setSelectedMeetingId(recordingMeetingIdRef.current);
          setSelectedRecordingId(recordingId);
          setAnalysisStatus("done");
          setRecordingMessage(
            verifiedSegments.length
              ? verifiedSegments.some((segment) => segment.verificationStatus === "review")
                ? "Nagranie zapisane. Czesc transkrypcji oznaczylismy do dodatkowej weryfikacji."
                : "Nagranie zapisane, przeanalizowane i trwale zapisane lokalnie."
              : "Audio zapisane lokalnie, ale ta przegladarka nie dostarczyla transkrypcji live."
          );
        } catch (error) {
          console.error("Recording finalization failed.", error);
          setAnalysisStatus("error");
          setRecordingMessage("Audio zapisano, ale finalizacja nagrania nie powiodla sie.");
        } finally {
          setIsRecording(false);
          setRecordPermission("granted");
          cleanupRecorder();
          setVisualBars(DEFAULT_BARS);
        }
      };

      recorder.start(900);

      const controller = createBrowserTranscriptionController({
        lang: "pl-PL",
        startTimeRef,
        transcriptRef,
        signatureTimelineRef,
        onSegmentsChange: setCurrentSegments,
        onInterimChange: setLiveText,
      });

      if (controller) {
        controller.setOnEnd(() => {
          if (isRecordingRef.current) {
            try {
              controller.start();
            } catch (error) {
              console.error("Speech recognition restart failed.", error);
            }
          }
        });
        recognitionRef.current = controller;
        controller.start();
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
    if (typeof window !== "undefined") {
      window.clearInterval(timerRef.current);
    }

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
    setResetMessage("");

    try {
      if (authMode === "register") {
        const result = await registerUser(users, workspaces, authDraft);
        setUsers(result.users);
        setWorkspaces(result.workspaces);
        setSession({ userId: result.user.id, workspaceId: result.workspaceId });
      } else {
        const result = await loginUser(users, workspaces, authDraft);
        setSession({ userId: result.user.id, workspaceId: result.workspaceId });
      }
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function requestResetCode() {
    setAuthError("");
    setResetMessage("");
    try {
      const result = await requestPasswordReset(users, resetDraft);
      setUsers(result.users);
      setResetPreviewCode(result.recoveryCode);
      setResetExpiresAt(result.expiresAt);
      setResetMessage("Kod resetu jest gotowy. Ustaw nowe haslo ponizej.");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function completeReset() {
    setAuthError("");
    setResetMessage("");
    try {
      const nextUsers = await resetPasswordWithCode(users, resetDraft);
      setUsers(nextUsers);
      setResetMessage("Haslo zostalo zmienione. Mozesz sie teraz zalogowac.");
      setResetPreviewCode("");
      setResetExpiresAt("");
      setResetDraft({
        ...EMPTY_RESET_DRAFT,
        email: resetDraft.email,
      });
      setAuthMode("login");
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
      setPasswordDraft(EMPTY_PASSWORD_DRAFT);
      setSecurityMessage("Haslo zostalo zmienione.");
    } catch (error) {
      setSecurityMessage(error.message);
    }
  }

  function saveMeeting() {
    if (!currentUser || !currentWorkspaceId) {
      return;
    }

    if (!selectedMeeting) {
      const meeting = createMeeting(currentUser.id, meetingDraft, {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
      });
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
    if (!currentUser || !currentWorkspaceId) {
      return null;
    }

    const task = createManualTask(currentUser.id, draft, taskColumns, currentWorkspaceId);
    setManualTasks((previous) => [task, ...previous]);
    return task.id;
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);

    if (task.sourceType === "manual" || task.sourceType === "google") {
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

  function moveTaskToColumn(taskId, columnId) {
    updateTask(taskId, { status: columnId });
  }

  function addTaskColumn(draft) {
    if (!currentWorkspaceId) {
      return;
    }

    setTaskBoards((previous) => createTaskColumn(previous, currentWorkspaceId, draft));
  }

  function changeTaskColumn(columnId, updates) {
    if (!currentWorkspaceId) {
      return;
    }

    const nextColumns = taskColumns.map((column) =>
      column.id === columnId ? { ...column, ...updates } : column
    );
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
  }

  function removeTaskColumn(columnId) {
    if (!currentWorkspaceId) {
      return;
    }

    const column = taskColumns.find((item) => item.id === columnId);
    if (!column) {
      return;
    }

    const fallbackColumnId =
      taskColumns.find((item) => item.id !== columnId && !item.isDone)?.id ||
      taskColumns.find((item) => item.id !== columnId)?.id ||
      columnId;

    meetingTasks
      .filter((task) => task.status === columnId)
      .forEach((task) => {
        updateTask(task.id, { status: fallbackColumnId });
      });

    const nextColumns = taskColumns.filter((item) => item.id !== columnId);
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
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

  function updateTranscriptSegment(segmentId, updates) {
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
          recordings: meeting.recordings.map((recording) =>
            recording.id !== selectedRecording.id
              ? recording
              : (() => {
                  const transcript = (recording.transcript || []).map((segment) =>
                    segment.id !== segmentId
                      ? segment
                      : {
                          ...segment,
                          ...updates,
                          verificationStatus:
                            updates.verificationStatus ||
                            (updates.text ? "verified" : segment.verificationStatus),
                          verificationReasons:
                            updates.verificationReasons || (updates.text ? [] : segment.verificationReasons),
                        }
                  );
                  return {
                    ...recording,
                    transcript,
                    reviewSummary: {
                      needsReview: transcript.filter(
                        (segment) => segment.verificationStatus === "review"
                      ).length,
                      approved: transcript.filter(
                        (segment) => segment.verificationStatus === "verified"
                      ).length,
                    },
                  };
                })()
          ),
        };
      })
    );
  }

  function exportTranscript() {
    if (!displayRecording) {
      return;
    }

    downloadTextFile(
      `${slugifyExportTitle(selectedMeeting?.title)}-transcript.txt`,
      recordingToText(displayRecording)
    );
  }

  function exportMeetingNotes() {
    if (!selectedMeeting) {
      return;
    }

    downloadTextFile(
      `${slugifyExportTitle(selectedMeeting.title)}-notes.txt`,
      buildMeetingNotesText(selectedMeeting, studioAnalysis, formatDateTime)
    );
  }

  function exportMeetingPdfFile() {
    if (!selectedMeeting) {
      return;
    }

    printMeetingPdf(selectedMeeting, displayRecording, displaySpeakerNames, formatDateTime, formatDuration);
  }

  function switchWorkspace(workspaceId) {
    if (!workspaceId || workspaceId === currentWorkspaceId) {
      return;
    }

    setSession((previous) =>
      previous
        ? {
            ...previous,
            workspaceId,
          }
        : previous
    );
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setWorkspaceMessage("");
  }

  function logout() {
    if (isRecording) {
      stopRecording();
    }

    setSession(null);
    setActiveTab("studio");
    setProfileMessage("");
    setSecurityMessage("");
    setPasswordDraft(EMPTY_PASSWORD_DRAFT);
    setGoogleCalendarEvents([]);
    setGoogleCalendarMessage("");
    setGoogleCalendarStatus("idle");
    setGoogleTaskLists([]);
    setSelectedGoogleTaskListId("");
    setGoogleTasksStatus("idle");
    setGoogleTasksMessage("");
    googleCalendarTokenRef.current = "";
    googleTasksTokenRef.current = "";
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

  async function connectGoogleTasks() {
    if (!currentUser) {
      return;
    }

    if (!googleEnabled) {
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Dodaj REACT_APP_GOOGLE_CLIENT_ID, aby laczyc Google Tasks.");
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      setGoogleTasksMessage("");
      const response = await requestGoogleTasksAccess({
        loginHint: currentUser.googleEmail || currentUser.email,
      });
      googleTasksTokenRef.current = response.access_token;
      const payload = await fetchGoogleTaskLists(response.access_token);
      const lists = payload.items || [];
      setGoogleTaskLists(lists);
      setSelectedGoogleTaskListId((previous) => previous || lists[0]?.id || "");
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage("Polaczono z Google Tasks.");
    } catch (error) {
      console.error("Google Tasks connect failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie polaczyc z Google Tasks.");
    }
  }

  async function importGoogleTasksFromList() {
    if (!currentUser || !googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      const payload = await fetchGoogleTasks(googleTasksTokenRef.current, selectedGoogleTaskListId);
      const selectedList = googleTaskLists.find((list) => list.id === selectedGoogleTaskListId) || {
        id: selectedGoogleTaskListId,
        title: "Google Tasks",
      };
      const importedTasks = (payload.items || []).map((task) =>
        createTaskFromGoogle(currentUser.id, task, selectedList, taskColumns, currentUser, currentWorkspaceId)
      );
      setManualTasks((previous) => upsertGoogleImportedTasks(previous, importedTasks, currentUser.id));
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(`Zaimportowano ${importedTasks.length} zadan z Google Tasks.`);
    } catch (error) {
      console.error("Google Tasks import failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie zaimportowac zadan z Google Tasks.");
    }
  }

  async function exportTasksToGoogle() {
    if (!googleTasksTokenRef.current || !selectedGoogleTaskListId) {
      return;
    }

    try {
      setGoogleTasksStatus("loading");
      const exportableTasks = meetingTasks.filter((task) => task.sourceType !== "google" && !task.completed);
      for (const task of exportableTasks) {
        const notes = [
          task.description,
          task.notes,
          task.tags?.length ? `Tagi: ${task.tags.join(", ")}` : "",
          `Priorytet: ${task.priority}`,
        ]
          .filter(Boolean)
          .join("\n\n");

        await createGoogleTask(googleTasksTokenRef.current, selectedGoogleTaskListId, {
          title: task.title,
          notes,
          due: task.dueDate ? new Date(task.dueDate).toISOString() : undefined,
        });
      }
      setGoogleTasksStatus("connected");
      setGoogleTasksMessage(`Wyeksportowano ${exportableTasks.length} otwartych zadan do Google Tasks.`);
    } catch (error) {
      console.error("Google Tasks export failed.", error);
      setGoogleTasksStatus("error");
      setGoogleTasksMessage("Nie udalo sie wyeksportowac zadan do Google Tasks.");
    }
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
        resetDraft={resetDraft}
        setResetDraft={setResetDraft}
        resetMessage={resetMessage}
        resetPreviewCode={resetPreviewCode}
        resetExpiresAt={resetExpiresAt}
        requestResetCode={requestResetCode}
        completeReset={completeReset}
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
              className={activeTab === "people" ? "tab-pill active" : "tab-pill"}
              onClick={() => setActiveTab("people")}
            >
              Osoby
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="status-chip">
            {speechRecognitionSupported ? "Live transcript ready" : "Chrome for transcript"}
          </div>
          <div className="status-chip">{googleEnabled ? "Google ready" : "Google env missing"}</div>
          {availableWorkspaces.length > 1 ? (
            <label className="workspace-switch">
              <span>Workspace</span>
              <select value={currentWorkspaceId || ""} onChange={(event) => switchWorkspace(event.target.value)}>
                {availableWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
          ) : currentWorkspace ? (
            <div className="status-chip">{currentWorkspace.name}</div>
          ) : null}
          <div className="user-card">
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="avatar" />
            ) : null}
            <div>
              <strong>{currentUser.name}</strong>
              <span>
                {currentUser.role || "No role"}
                {currentUser.provider === "google" ? " - Google sign-in" : ""}
              </span>
            </div>
            <button
              type="button"
              className="settings-button"
              aria-label="Otworz ustawienia"
              onClick={() => setActiveTab("profile")}
            >
              {"\u2699"}
            </button>
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
          tasks={meetingTasks}
          meetings={userMeetings}
          peopleOptions={taskPeople}
          tagOptions={taskTags}
          boardColumns={taskColumns}
          onCreateTask={createTaskFromComposer}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onMoveTaskToColumn={moveTaskToColumn}
          onCreateColumn={addTaskColumn}
          onUpdateColumn={changeTaskColumn}
          onDeleteColumn={removeTaskColumn}
          onOpenMeeting={openMeetingFromCalendar}
          defaultView={currentUser.preferredTaskView || "list"}
          googleTasksEnabled={googleEnabled}
          googleTasksStatus={googleTasksStatus}
          googleTasksMessage={googleTasksMessage}
          googleTaskLists={googleTaskLists}
          selectedGoogleTaskListId={selectedGoogleTaskListId}
          onSelectGoogleTaskList={setSelectedGoogleTaskListId}
          onConnectGoogleTasks={connectGoogleTasks}
          onImportGoogleTasks={importGoogleTasksFromList}
          onExportGoogleTasks={exportTasksToGoogle}
          workspaceName={currentWorkspace?.name || ""}
          workspaceInviteCode={currentWorkspace?.inviteCode || ""}
        />
      ) : activeTab === "people" ? (
        <PeopleTab profiles={peopleProfiles} onOpenMeeting={openMeetingFromCalendar} />
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
        <StudioTab
          currentUser={currentUser}
          currentWorkspace={currentWorkspace}
          currentWorkspaceMembers={currentWorkspaceMembers}
          setActiveTab={setActiveTab}
          meetingDraft={meetingDraft}
          setMeetingDraft={setMeetingDraft}
          saveMeeting={saveMeeting}
          workspaceMessage={workspaceMessage}
          userMeetings={userMeetings}
          selectedMeetingId={selectedMeetingId}
          selectMeeting={selectMeeting}
          selectedMeeting={selectedMeeting}
          displayRecording={displayRecording}
          studioAnalysis={studioAnalysis}
          isRecording={isRecording}
          analysisStatus={analysisStatus}
          elapsed={elapsed}
          visualBars={visualBars}
          stopRecording={stopRecording}
          startRecording={startRecording}
          recordPermission={recordPermission}
          speechRecognitionSupported={speechRecognitionSupported}
          liveText={liveText}
          recordingMessage={recordingMessage}
          selectedRecording={selectedRecording}
          displaySpeakerNames={displaySpeakerNames}
          selectedRecordingAudioUrl={selectedRecordingAudioUrl}
          updateTranscriptSegment={updateTranscriptSegment}
          renameSpeaker={renameSpeaker}
          selectedRecordingId={selectedRecordingId}
          setSelectedRecordingId={setSelectedRecordingId}
          exportTranscript={exportTranscript}
          exportMeetingNotes={exportMeetingNotes}
          exportMeetingPdfFile={exportMeetingPdfFile}
          setSelectedMeetingId={setSelectedMeetingId}
        />
      )}
    </div>
  );
}
