import { useEffect, useRef, useState } from "react";

// ~4 × 900ms timeslice chunks ≈ 3.6 s of audio per request
const CHUNK_WINDOW = 4;
const POLL_INTERVAL_MS = 3000;

/**
 * Periodically sends the last ~3 s of recorded MediaRecorder chunks to the
 * server for Whisper-based live captioning. Returns the most-recent caption.
 *
 * @param {object}  params
 * @param {React.MutableRefObject<Blob[]>} params.chunksRef     — shared ref from useRecorder
 * @param {boolean} params.isRecording
 * @param {boolean} params.enabled        — false when local mode or user toggled off
 * @param {function(Blob): Promise<string>} params.transcribeLive
 * @param {string}  [params.mimeType]     — MIME type for the Blob constructor
 */
export default function useLiveTranscript({
  chunksRef,
  isRecording,
  enabled,
  transcribeLive,
  mimeType,
}) {
  const [caption, setCaption] = useState("");
  const inflightRef = useRef(false);
  // Keep a stable ref to the transcribeLive fn to avoid restarting the interval
  // every render when the caller passes an inline-bound function.
  const transcribeLiveRef = useRef(transcribeLive);
  useEffect(() => {
    transcribeLiveRef.current = transcribeLive;
  });

  useEffect(() => {
    if (!isRecording || !enabled || !transcribeLive) {
      setCaption("");
      return undefined;
    }

    const id = setInterval(async () => {
      if (inflightRef.current) return;
      const allChunks = chunksRef.current || [];
      if (allChunks.length < 2) return;

      const window = allChunks.slice(-CHUNK_WINDOW);
      const blob = new Blob(window, { type: mimeType || "audio/webm" });
      if (blob.size < 500) return;

      inflightRef.current = true;
      try {
        const text = await transcribeLiveRef.current(blob);
        if (text) setCaption(text);
      } catch (_) {
        // Silent — never disrupt the recording session
      } finally {
        inflightRef.current = false;
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      setCaption("");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, enabled, mimeType]);

  return caption;
}
