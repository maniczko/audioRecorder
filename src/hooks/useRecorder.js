import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeMeeting } from "../lib/analysis";
import { getAudioBlob, saveAudioBlob } from "../lib/audioStore";
import { summarizeSpectrum } from "../lib/diarization";
import { DEFAULT_BARS, recordingErrorMessage } from "../lib/recording";
import {
  buildRecordingQueueSummary,
  createRecordingQueueItem,
  getNextProcessableRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  getRecordingQueueForMeeting,
  normalizeRecordingPipelineStatus,
  removeRecordingQueueItem,
  updateRecordingQueueItem,
  upsertRecordingQueueItem,
} from "../lib/recordingQueue";
import { createId, STORAGE_KEYS } from "../lib/storage";
import { createMediaService } from "../services/mediaService";
import { createNoiseReducerNode } from "../audio/noiseReducerNode";
import useStoredState from "./useStoredState";

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

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export default function useRecorder({
  selectedMeeting,
  userMeetings,
  createAdHocMeeting,
  attachCompletedRecording,
}) {
  const mediaService = useMemo(() => createMediaService(), []);
  const [recordPermission, setRecordPermission] = useState("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const [audioUrls, setAudioUrls] = useState({});
  const [audioHydrationErrors, setAudioHydrationErrors] = useState({});
  const [recordingMeetingId, setRecordingMeetingId] = useState(null);
  const [recordingQueue, setRecordingQueue] = useStoredState(STORAGE_KEYS.recordingQueue, []);

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
  const queueProcessingRef = useRef(false);
  const userMeetingsRef = useRef(userMeetings);
  const normalizedQueue = useMemo(() => recordingQueue, [recordingQueue]);
  const queueSummary = useMemo(() => buildRecordingQueueSummary(normalizedQueue), [normalizedQueue]);

  useEffect(() => {
    userMeetingsRef.current = userMeetings;
  }, [userMeetings]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

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
          const blob = await mediaService.getRecordingAudioBlob(recordingId);
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
          setAudioHydrationErrors((prev) => ({ ...prev, [recordingId]: error.message || "Błąd ładowania audio" }));
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
  }, [mediaService, userMeetings]);

  useEffect(() => {
    const nextItem = getNextProcessableRecordingQueueItem(normalizedQueue, (item) =>
      Boolean(resolveMeetingForQueueItem(item)?.id)
    );
    if (!nextItem || queueProcessingRef.current) {
      const blockedItem = getNextPendingRecordingQueueItem(normalizedQueue);
      if (blockedItem && !queueProcessingRef.current && !resolveMeetingForQueueItem(blockedItem)?.id) {
        updateQueueItem(blockedItem.recordingId, {
          status: "failed",
          errorMessage: "Nie znaleziono spotkania dla wpisu kolejki. Sprobuj nagrac ponownie.",
        });
        setAnalysisStatus("error");
        setRecordingMessage("Jeden z wpisow kolejki nie ma juz przypisanego spotkania i zostal oznaczony jako failed.");
      }
      return undefined;
    }

    queueProcessingRef.current = true;
    setAnalysisStatus(nextItem.status === "uploading" ? "uploading" : nextItem.status === "processing" ? "processing" : "queued");

    let syncThrew = false;
    try {
      const jobPromise = processQueueItem(nextItem);
      Promise.resolve(jobPromise).finally(() => {
        queueProcessingRef.current = false;
      });
    } catch (err) {
      syncThrew = true;
      queueProcessingRef.current = false;
      console.error("Queue processing sync error.", err);
    }
    if (syncThrew) return undefined;

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQueue, userMeetings]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(frameRef.current);
        window.clearInterval(timerRef.current);
      }
      Object.values(audioUrlsRef.current).forEach((url) => revokeAudioUrl(url));
    },
    []
  );

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

  function updateQueueItem(recordingId, updates) {
    setRecordingQueue((previous) => updateRecordingQueueItem(previous, recordingId, updates));
  }

  function removeQueueItem(recordingId) {
    setRecordingQueue((previous) => removeRecordingQueueItem(previous, recordingId));
  }

  function resolveMeetingForQueueItem(item) {
    return userMeetingsRef.current.find((meeting) => meeting.id === item.meetingId) || item.meetingSnapshot || null;
  }

  async function buildRecordingFromQueueItem(item, transcription) {
    const targetMeeting = resolveMeetingForQueueItem(item);
    if (!targetMeeting?.id) {
      throw new Error("Nie znaleziono spotkania dla nagrania w kolejce.");
    }

    const verifiedSegments = Array.isArray(transcription.verifiedSegments) ? transcription.verifiedSegments : [];
    setCurrentSegments(verifiedSegments);
    setAnalysisStatus("processing");

    let analysis;
    try {
      analysis = await analyzeMeeting({
        meeting: targetMeeting,
        segments: verifiedSegments,
        speakerNames: transcription.diarization?.speakerNames || {},
        diarization: transcription.diarization || {},
      });
    } catch (error) {
      console.error("Meeting analysis failed.", error);
      analysis = buildFallbackAnalysis(
        "Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty do dalszej pracy.",
        transcription.diarization || { speakerNames: {}, speakerCount: 0 }
      );
    }

    return {
      id: item.recordingId,
      createdAt: item.createdAt || new Date().toISOString(),
      duration: item.duration || 0,
      transcript: verifiedSegments,
      speakerNames: analysis.speakerLabels || transcription.diarization?.speakerNames || {},
      speakerCount: analysis.speakerCount || transcription.diarization?.speakerCount || 0,
      diarizationConfidence: transcription.diarization?.confidence || 0,
      reviewSummary:
        transcription.reviewSummary || {
          needsReview: verifiedSegments.filter((segment) => segment.verificationStatus === "review").length,
          approved: verifiedSegments.filter((segment) => segment.verificationStatus === "verified").length,
        },
      transcriptionProvider: transcription.providerId,
      transcriptionProviderLabel: transcription.providerLabel || transcription.providerId,
      pipelineStatus: "done",
      storageMode: mediaService.mode === "remote" ? "remote" : "indexeddb",
      analysis,
    };
  }

  async function pollRemoteTranscription(recordingId) {
    let attempts = 0;
    while (attempts < 120) {
      attempts += 1;
      const result = await mediaService.getTranscriptionJobStatus(recordingId);
      const status = normalizeRecordingPipelineStatus(result?.pipelineStatus);
      if (status === "done") {
        return {
          ...result,
          pipelineStatus: "done",
        };
      }
      if (status === "failed") {
        throw new Error(result?.errorMessage || "Serwer nie zakonczyl transkrypcji.");
      }

      updateQueueItem(recordingId, {
        status,
        errorMessage: "",
      });
      await sleep(1500);
    }

    throw new Error("Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.");
  }

  async function processQueueItem(item) {
    const targetMeeting = resolveMeetingForQueueItem(item);
    if (!targetMeeting?.id) {
      return false;
    }

    const localBlob = await getAudioBlob(item.recordingId);
    if (!localBlob) {
      updateQueueItem(item.recordingId, {
        status: "failed",
        errorMessage: "Brakuje lokalnego audio dla tego wpisu kolejki.",
      });
      return true;
    }

    try {
      if (!item.uploaded) {
        updateQueueItem(item.recordingId, {
          status: "uploading",
          attempts: (item.attempts || 0) + 1,
          errorMessage: "",
        });
        await mediaService.persistRecordingAudio(item.recordingId, localBlob, {
          workspaceId: targetMeeting.workspaceId || item.workspaceId || "",
          meetingId: targetMeeting.id,
        });
      }

      updateQueueItem(item.recordingId, {
        status: "processing",
        uploaded: true,
        errorMessage: "",
      });

      const started =
        item.uploaded && item.status === "processing"
          ? await mediaService.getTranscriptionJobStatus(item.recordingId)
          : await mediaService.startTranscriptionJob({
              recordingId: item.recordingId,
              blob: localBlob,
              meeting: targetMeeting,
              rawSegments: item.rawSegments,
            });
      const startStatus = normalizeRecordingPipelineStatus(started?.pipelineStatus);
      const transcription =
        startStatus === "done"
          ? {
              ...started,
              pipelineStatus: "done",
            }
          : await pollRemoteTranscription(item.recordingId);

      const recording = await buildRecordingFromQueueItem(item, transcription);
      attachCompletedRecording(targetMeeting.id, recording);
      removeQueueItem(item.recordingId);
      setAnalysisStatus("done");
      setRecordingMessage(
        recording.transcript.some((segment) => segment.verificationStatus === "review")
          ? "Nagranie czeka czesciowo na review."
          : ""
      );
      return true;
    } catch (error) {
      console.error("Recording queue item failed.", error);
      updateQueueItem(item.recordingId, {
        status: "failed",
        errorMessage: error.message || "Nie udalo sie przetworzyc nagrania.",
      });
      setAnalysisStatus("error");
      setRecordingMessage(
        error.message
          ? `Nagranie czeka w kolejce z bledem: ${error.message}`
          : "Nagranie czeka w kolejce z bledem. Mozesz sprobowac ponownie."
      );
      return true;
    }
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
    setRecordingMeetingId(activeMeeting.id);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Mono avoids unnecessary stereo DSP chains on some OS drivers
          // that can interfere with echo cancellation.
          // 48 kHz is the native rate for most hardware and avoids resampling
          // artefacts before MediaRecorder encoding.
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext unavailable");
      }

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      // Try to insert spectral-subtraction noise reducer between source and recorder.
      // Falls back gracefully to raw stream if AudioWorklet is unavailable.
      const noiseReducer = await createNoiseReducerNode(audioContext);
      let recordStream = stream;

      if (noiseReducer) {
        const destination = audioContext.createMediaStreamDestination();
        source.connect(noiseReducer);
        noiseReducer.connect(analyser);
        noiseReducer.connect(destination);
        recordStream = destination.stream;
      } else {
        source.connect(analyser);
      }

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(recordStream);
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
          const recordingId = createId("recording");
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (typeof URL !== "undefined" && URL.createObjectURL) {
            const nextAudioUrl = URL.createObjectURL(blob);
            setAudioUrls((previous) => ({
              ...previous,
              [recordingId]: nextAudioUrl,
            }));
          }
          await saveAudioBlob(recordingId, blob);
          setRecordingQueue((previous) =>
            upsertRecordingQueueItem(
              previous,
              createRecordingQueueItem({
                recordingId,
                meeting: targetMeeting,
                mimeType: recorder.mimeType || "audio/webm",
                rawSegments: transcriptRef.current,
                duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
              })
            )
          );
          setAnalysisStatus("queued");
          setRecordingMessage("Nagranie trafilo do kolejki. Upload rozpocznie sie automatycznie.");
        } catch (error) {
          console.error("Recording finalization failed.", error);
          setAnalysisStatus("error");
          setRecordingMessage(
            error.message
              ? `Audio zapisano, ale finalizacja nagrania nie powiodla sie: ${error.message}`
              : "Audio zapisano, ale finalizacja nagrania nie powiodla sie."
          );
        } finally {
          setIsRecording(false);
          setRecordingMeetingId(null);
          setRecordPermission("granted");
          cleanupRecorder();
          setVisualBars(DEFAULT_BARS);
        }
      };

      recorder.start(900);

      const controller = mediaService.createLiveController({
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
      setRecordingMeetingId(null);
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

  function resetRecorderState() {
    setRecordingMessage("");
    setLiveText("");
    setCurrentSegments([]);
    setAnalysisStatus("idle");
    setElapsed(0);
    setVisualBars(DEFAULT_BARS);
    setRecordingMeetingId(null);
  }

  async function normalizeRecording(recordingId) {
    if (!recordingId || !mediaService.normalizeRecordingAudio) {
      return;
    }
    await mediaService.normalizeRecordingAudio(recordingId);
    // Re-hydrate audio so the player picks up the normalized file
    const oldUrl = audioUrlsRef.current[recordingId];
    if (oldUrl) {
      revokeAudioUrl(oldUrl);
      setAudioUrls((prev) => {
        const next = { ...prev };
        delete next[recordingId];
        return next;
      });
    }
    try {
      const blob = await mediaService.getRecordingAudioBlob(recordingId);
      if (blob && typeof URL !== "undefined" && URL.createObjectURL) {
        const nextUrl = URL.createObjectURL(blob);
        setAudioUrls((prev) => ({ ...prev, [recordingId]: nextUrl }));
      }
    } catch (error) {
      console.error(`Audio re-hydration after normalize failed for ${recordingId}.`, error);
    }
  }

  function retryRecordingQueueItem(recordingId) {
    updateQueueItem(recordingId, {
      status: "queued",
      uploaded: false,
      errorMessage: "",
    });
    setRecordingMessage("Ponawiamy nagranie z kolejki audio.");
    setAnalysisStatus("queued");
  }

  const selectedMeetingQueue = useMemo(
    () => getRecordingQueueForMeeting(normalizedQueue, selectedMeeting?.id || ""),
    [normalizedQueue, selectedMeeting?.id]
  );
  const activeQueueItem = useMemo(() => getNextPendingRecordingQueueItem(normalizedQueue), [normalizedQueue]);

  return {
    recordPermission,
    isRecording,
    elapsed,
    visualBars,
    liveText,
    currentSegments,
    recordingMeetingId,
    analysisStatus,
    recordingMessage,
    audioUrls,
    audioHydrationErrors,
    recordingQueue: normalizedQueue,
    queueSummary,
    selectedMeetingQueue,
    activeQueueItem,
    speechRecognitionSupported: mediaService.supportsLiveTranscription(),
    startRecording,
    stopRecording,
    retryRecordingQueueItem,
    normalizeRecording,
    resetRecorderState,
  };
}
