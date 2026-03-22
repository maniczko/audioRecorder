import { useEffect, useRef, useState } from "react";
import { DEFAULT_BARS, recordingErrorMessage } from "../lib/recording";
import { summarizeSpectrum } from "../lib/diarization";
import { createNoiseReducerNode } from "../audio/noiseReducerNode";


export default function useAudioHardware({
  mediaService,
  onRecordingStop,
  onSegmentsChange,
  onInterimChange,
  onMessageChange,
}) {
  const [recordPermission, setRecordPermission] = useState("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [visualBars, setVisualBars] = useState(DEFAULT_BARS);

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
  const isRecordingRef = useRef(false);
  const mimeTypeRef = useRef("audio/webm");

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

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
    }
    frameRef.current = null;
    timerRef.current = null;

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
    mediaRecorderRef.current = null;
  }

  function pumpVisualizer() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setVisualBars(Array.from({ length: 24 }, (_, i) => {
      const srcIdx = Math.floor((i / 24) * data.length);
      return Math.max(6, (data[srcIdx] / 255) * 58);
    }));

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

  async function startRecording(meetingId) {
    if (recordPermission === "denied") {
      onMessageChange("Mikrofon jest zablokowany w przegladarce. Kliknij ikone klodki przy adresie strony i zezwol na mikrofon.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      onMessageChange("Ta przegladarka nie obsluguje dostepu do mikrofonu.");
      return;
    }
    if (typeof window !== "undefined" && typeof window.MediaRecorder === "undefined") {
      onMessageChange("Ta przegladarka nie obsluguje nagrywania audio przez MediaRecorder.");
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
        // 16 kHz matches the Whisper/VAD pipeline — avoids expensive server-side resampling.
        // Browsers that don't support 16 kHz fall back to their native rate automatically.
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 }, sampleRate: { ideal: 16000 } },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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
      } else {
        source.connect(analyser);
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
        onRecordingStop({
          meetingId,
          chunks: chunksRef.current,
          mimeType: recorder.mimeType || "audio/webm",
          rawSegments: transcriptRef.current,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        });
        setIsRecording(false);
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
      setElapsed(0);
      setIsRecording(true);
      setRecordPermission("granted");
      timerRef.current = window.setInterval(() => {
        if (isRecordingRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
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
    onInterimChange("");
    if (typeof window !== "undefined") window.clearInterval(timerRef.current);
    try { if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current.stop(); } catch (e) {}
    try { recognitionRef.current?.stop(); } catch (e) {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  return {
    recordPermission,
    isRecording,
    elapsed,
    visualBars,
    chunksRef,
    mimeTypeRef,
    startRecording,
    stopRecording,
    cleanupRecorder,
  };
}
