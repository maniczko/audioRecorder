import { useEffect, useRef, useState } from "react";
import { DEFAULT_BARS, recordingErrorMessage } from "../lib/recording";
import { summarizeSpectrum } from "../lib/diarization";
import { createNoiseReducerNode, isRnnoiseNode, requestNoiseReducerStatus } from "../audio/noiseReducerNode";

// Amplitude below this (0–255 scale) is considered silence (~4%)
const SILENCE_AMPLITUDE_THRESHOLD = 10;
// How often to update the silence countdown display (every N frames)
const SILENCE_CHECK_INTERVAL_FRAMES = 20;

export default function useAudioHardware({
  mediaService,
  onRecordingStop,
  onSegmentsChange,
  onInterimChange,
  onMessageChange,
  silenceAutoStopMinutes = 3,
}: {
  mediaService: any;
  onRecordingStop: (data: any) => void;
  onSegmentsChange: (segs: any[]) => void;
  onInterimChange: (text: string) => void;
  onMessageChange: (msg: string) => void;
  silenceAutoStopMinutes?: number | "off";
}) {
  const [recordPermission, setRecordPermission] = useState("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);
  // null = no warning; number = seconds until auto-stop
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const [voiceActivityStatus, setVoiceActivityStatus] = useState<"active" | "idle" | "unsupported">("unsupported");

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const noiseReducerRef = useRef<any>(null);
  const vadIntervalRef = useRef<any>(null);
  const frameRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const chunksRef = useRef([]);
  const transcriptRef = useRef([]);
  const signatureTimelineRef = useRef([]);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const pauseTimeRef = useRef(0);
  const totalPausedTimeRef = useRef(0);
  const mimeTypeRef = useRef("audio/webm");
  const lastActiveTimeRef = useRef(Date.now());
  const silenceFrameCountRef = useRef(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return undefined;
    let mounted = true;
    let permissionStatus;
    async function syncPermission() {
      try {
        permissionStatus = await navigator.permissions.query({ name: "microphone" });
        if (!mounted) return;
        setRecordPermission(permissionStatus.state);
        permissionStatus.onchange = () => setRecordPermission(permissionStatus.state);
      } catch (error) {
        console.error("Microphone permission query failed.", error);
      }
    }
    syncPermission();
    return () => {
      mounted = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, []);

  function cleanupRecorder() {
    if (typeof window !== "undefined") {
      window.cancelAnimationFrame(frameRef.current);
      window.clearInterval(timerRef.current);
      window.clearInterval(vadIntervalRef.current);
    }
    frameRef.current = null;
    timerRef.current = null;
    vadIntervalRef.current = null;

    if (recognitionRef.current) {
      recognitionRef.current.clearHandlers?.();
      try {
        recognitionRef.current.stop();
      } catch (e) {}
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
    if (noiseReducerRef.current && typeof noiseReducerRef.current === "object") {
      noiseReducerRef.current.onstatus = null;
    }
    noiseReducerRef.current = null;
    mediaRecorderRef.current = null;
    setVoiceActivityStatus("unsupported");
  }

  function pumpVisualizer() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setVisualBars(Array.from({ length: 24 }, (_, i) => {
      const srcIdx = Math.floor((i / 24) * data.length);
      return Math.max(6, (data[srcIdx] / 255) * 58) as any;
    }));

    if (isRecordingRef.current) {
      signatureTimelineRef.current.push({
        timestamp: (Date.now() - startTimeRef.current) / 1000,
        signature: summarizeSpectrum(data),
      });
      if (signatureTimelineRef.current.length > 1200) {
        signatureTimelineRef.current = signatureTimelineRef.current.slice(-900);
      }

      // Silence auto-stop: track last active (non-silent) moment
      if (!isPausedRef.current && silenceAutoStopMinutes !== "off" && silenceAutoStopMinutes > 0) {
        const maxAmplitude = data.reduce((m, v) => Math.max(m, v), 0);
        if (maxAmplitude > SILENCE_AMPLITUDE_THRESHOLD) {
          lastActiveTimeRef.current = Date.now();
        }
        // Throttle countdown updates to avoid excessive re-renders
        silenceFrameCountRef.current += 1;
        if (silenceFrameCountRef.current >= SILENCE_CHECK_INTERVAL_FRAMES) {
          silenceFrameCountRef.current = 0;
          const silenceSecs = (Date.now() - lastActiveTimeRef.current) / 1000;
          const autoStopSecs = (silenceAutoStopMinutes as number) * 60;
          if (silenceSecs >= autoStopSecs) {
            // Auto-stop: too long without audio
            setSilenceCountdown(null);
            stopRecording();
          } else if (silenceSecs >= autoStopSecs - 30) {
            // 30s warning countdown
            setSilenceCountdown(Math.ceil(autoStopSecs - silenceSecs));
          } else {
            setSilenceCountdown(null);
          }
        }
      }
    }
    if (typeof window !== "undefined") {
      frameRef.current = window.requestAnimationFrame(pumpVisualizer);
    }
  }

  function resetSilenceTimer() {
    lastActiveTimeRef.current = Date.now();
    setSilenceCountdown(null);
  }

  async function startRecording(meetingId) {
    if (recordPermission === "denied") {
      onMessageChange("Mikrofon jest zablokowany w przeglądarce. Kliknij ikonę kłódki przy adresie strony i zezwól na mikrofon.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      onMessageChange("Ta przeglądarka nie obsługuje dostępu do mikrofonu.");
      return;
    }
    if (typeof window !== "undefined" && typeof window.MediaRecorder === "undefined") {
      onMessageChange("Ta przeglądarka nie obsługuje nagrywania audio przez MediaRecorder.");
      return;
    }

    cleanupRecorder();
    setRecordPermission("loading");
    onMessageChange("");
    onInterimChange("");
    onSegmentsChange([]);
    setVisualBars(DEFAULT_BARS);
    chunksRef.current = [];
    transcriptRef.current = [];
    signatureTimelineRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 } },
      });
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext unavailable");

      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const noiseReducer = await createNoiseReducerNode(audioContext);
      let recordStream = stream;
      if (noiseReducer) {
        const destination = audioContext.createMediaStreamDestination();
        source.connect(noiseReducer);
        noiseReducer.connect(analyser);
        noiseReducer.connect(destination);
        recordStream = destination.stream;
        noiseReducerRef.current = noiseReducer;
        if (isRnnoiseNode(noiseReducer)) {
          setVoiceActivityStatus("idle");
          noiseReducer.onstatus = (event) => {
            const vadProbability = Number(event?.data?.vadProb ?? 0);
            setVoiceActivityStatus(vadProbability >= 0.55 ? "active" : "idle");
          };
          requestNoiseReducerStatus(noiseReducer);
          vadIntervalRef.current = window.setInterval(() => {
            requestNoiseReducerStatus(noiseReducer);
          }, 350);
        } else {
          setVoiceActivityStatus("unsupported");
        }
      } else {
        source.connect(analyser);
        setVoiceActivityStatus("unsupported");
      }

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const bestMime = (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported)
        ? preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || "" : "";
      const recorder = new MediaRecorder(recordStream, { ...(bestMime ? { mimeType: bestMime } : {}), audioBitsPerSecond: 128000 });
      mimeTypeRef.current = recorder.mimeType || bestMime || "audio/webm";
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const finalDuration = Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000);
        onRecordingStop({
          meetingId,
          chunks: chunksRef.current,
          mimeType: recorder.mimeType || "audio/webm",
          rawSegments: transcriptRef.current,
          duration: finalDuration,
        });
        setIsRecording(false);
        setIsPaused(false);
        setRecordPermission("granted");
        cleanupRecorder();
        setVisualBars(DEFAULT_BARS);
      };

      recorder.start(900);

      const controller = mediaService.createLiveController({
        lang: "pl-PL",
        startTimeRef,
        transcriptRef,
        signatureTimelineRef,
        onSegmentsChange,
        onInterimChange,
        onError: onMessageChange,
      });

      if (controller) {
        controller.setOnEnd(() => {
          if (isRecordingRef.current) {
            try { controller.start(); } catch (e) {}
          }
        });
        recognitionRef.current = controller;
        controller.start();
      }

      startTimeRef.current = Date.now();
      totalPausedTimeRef.current = 0;
      lastActiveTimeRef.current = Date.now();
      setSilenceCountdown(null);
      setElapsed(0);
      setIsRecording(true);
      setIsPaused(false);
      setRecordPermission("granted");
      timerRef.current = window.setInterval(() => {
        if (isRecordingRef.current && !isPausedRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current - totalPausedTimeRef.current) / 1000));
        }
      }, 300);
      pumpVisualizer();
    } catch (error) {
      console.error("Recording start failed.", error);
      cleanupRecorder();
      setIsRecording(false);
      setRecordPermission("denied");
      onMessageChange(recordingErrorMessage(error));
      setVisualBars(DEFAULT_BARS);
    }
  }

  function stopRecording() {
    setIsRecording(false);
    setIsPaused(false);
    onInterimChange("");
    if (typeof window !== "undefined") window.clearInterval(timerRef.current);
    try { if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop(); } catch (e) {}
    try { recognitionRef.current?.stop(); } catch (e) {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function pauseRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      pauseTimeRef.current = Date.now();
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.warn("Pause recognition failed:", error);
      }
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      totalPausedTimeRef.current += Date.now() - pauseTimeRef.current;
      lastActiveTimeRef.current = Date.now();
      setSilenceCountdown(null);
      try {
        recognitionRef.current?.start();
      } catch (error) {
        console.warn("Resume recognition failed:", error);
      }
    }
  }

  return {
    recordPermission,
    isRecording,
    isPaused,
    elapsed,
    visualBars,
      silenceCountdown,
      voiceActivityStatus,
      chunksRef,
    mimeTypeRef,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cleanupRecorder,
    resetSilenceTimer,
  };
}
