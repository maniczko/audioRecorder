import { createId } from "./storage";
import { getSpeechRecognitionClass } from "./recording";
import { signatureAroundTimestamp } from "./diarization";

export const TRANSCRIPTION_PROVIDER = {
  id: "browser-local",
  label: "Browser STT + diarization + confidence scoring",
};

export function createBrowserTranscriptionController({
  lang = "pl-PL",
  startTimeRef,
  transcriptRef,
  signatureTimelineRef,
  onSegmentsChange,
  onInterimChange,
}) {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

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
          rawConfidence: Number(result[0]?.confidence || 0),
        };
        transcriptRef.current = [...transcriptRef.current, segment];
        onSegmentsChange([...transcriptRef.current]);
        onInterimChange("");
      } else {
        interim += `${text} `;
      }
    }

    onInterimChange(interim.trim());
  };

  return {
    recognition,
    start() {
      recognition.start();
    },
    stop() {
      recognition.stop();
    },
    setOnEnd(callback) {
      recognition.onend = callback;
    },
    clearHandlers() {
      recognition.onresult = null;
      recognition.onend = null;
    },
  };
}
