import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeMeeting } from "../lib/analysis";
import { summarizeSpectrum } from "../lib/diarization";
import { DEFAULT_BARS, recordingErrorMessage } from "../lib/recording";
import { createId } from "../lib/storage";
import { createMediaService } from "../services/mediaService";

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
  const [recordingMeetingId, setRecordingMeetingId] = useState(null);

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
          const recordingId = createId("recording");
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const persisted = await mediaService.persistRecordingAudio(recordingId, blob, {
            workspaceId: targetMeeting?.workspaceId || activeMeeting?.workspaceId || "",
            meetingId: targetMeeting?.id || activeMeeting?.id || "",
          });
          const transcription = await mediaService.finalizeTranscription({
            recordingId,
            blob,
            meeting: targetMeeting,
            rawSegments: transcriptRef.current,
          });

          if (typeof URL !== "undefined" && URL.createObjectURL) {
            const nextAudioUrl = URL.createObjectURL(blob);
            setAudioUrls((previous) => ({
              ...previous,
              [recordingId]: nextAudioUrl,
            }));
          }

          setCurrentSegments(transcription.verifiedSegments);
          setAnalysisStatus("analyzing");

          let analysis;
          try {
            analysis = await analyzeMeeting({
              meeting: targetMeeting,
              segments: transcription.verifiedSegments,
              speakerNames: transcription.diarization.speakerNames,
              diarization: transcription.diarization,
            });
          } catch (error) {
            console.error("Meeting analysis failed.", error);
            analysis = buildFallbackAnalysis(
              "Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty do dalszej pracy.",
              transcription.diarization
            );
          }

          const recording = {
            id: recordingId,
            createdAt: new Date().toISOString(),
            duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
            transcript: transcription.verifiedSegments,
            speakerNames: analysis.speakerLabels || transcription.diarization.speakerNames,
            speakerCount: analysis.speakerCount || transcription.diarization.speakerCount,
            diarizationConfidence: transcription.diarization.confidence,
            reviewSummary:
              transcription.reviewSummary || {
                needsReview: transcription.verifiedSegments.filter(
                  (segment) => segment.verificationStatus === "review"
                ).length,
                approved: transcription.verifiedSegments.filter(
                  (segment) => segment.verificationStatus === "verified"
                ).length,
              },
            transcriptionProvider: transcription.providerId,
            transcriptionProviderLabel: transcription.providerLabel || transcription.providerId,
            pipelineStatus: transcription.pipelineStatus || "completed",
            storageMode: persisted.storageMode,
            analysis,
          };

          attachCompletedRecording(recordingMeetingIdRef.current, recording);
          setAnalysisStatus("done");
          setRecordingMessage(
            transcription.verifiedSegments.length
              ? transcription.verifiedSegments.some((segment) => segment.verificationStatus === "review")
                ? "Nagranie zapisane. Czesc transkrypcji oznaczylismy do dodatkowej weryfikacji."
                : "Nagranie zapisane, przeanalizowane i trwale zapisane."
              : "Audio zapisane, ale nie otrzymalismy jeszcze transkrypcji live."
          );
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
    speechRecognitionSupported: mediaService.supportsLiveTranscription(),
    startRecording,
    stopRecording,
    resetRecorderState,
  };
}
