import { createId } from './storage';
import { getSpeechRecognitionClass } from './recording';
import { signatureAroundTimestamp } from './diarization';

export const TRANSCRIPTION_PROVIDER = {
  id: 'browser-local',
  label: 'Browser STT + diarization + confidence scoring',
};

export function createBrowserTranscriptionController({
  lang = 'pl-PL',
  startTimeRef,
  transcriptRef,
  signatureTimelineRef,
  onSegmentsChange,
  onInterimChange,
  onError,
}) {
  const SpeechRecognitionClass = getSpeechRecognitionClass();
  if (!SpeechRecognitionClass) {
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;

  recognition.onerror = (event) => {
    // "no-speech" is benign (silence); "aborted" happens on programmatic stop — both are expected
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      console.error('Speech recognition error:', event.error);
      if (typeof onError === 'function') {
        const messages = {
          network: 'Transkrypcja live niedostępna — sprawdź połączenie z internetem.',
          'not-allowed': 'Mikrofon zablokowany — sprawdź uprawnienia przeglądarki.',
          'service-not-allowed': 'Usługa rozpoznawania mowy niedostępna w tej przeglądarce.',
          'language-not-supported': 'Język pl-PL nie jest obsługiwany przez tę przeglądarkę.',
          aborted: null,
        };
        const msg = messages[event.error];
        if (msg) onError(msg);
      }
    }
  };

  recognition.onresult = (event) => {
    let interim = '';

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const text = result[0]?.transcript?.trim();
      if (!text) {
        continue;
      }

      if (result.isFinal) {
        const timestamp = (Date.now() - startTimeRef.current) / 1000;
        const segment = {
          id: createId('segment'),
          text,
          timestamp,
          speakerId: 0,
          signature: signatureAroundTimestamp(signatureTimelineRef.current, timestamp),
          rawConfidence: Number(result[0]?.confidence || 0),
        };
        transcriptRef.current = [...transcriptRef.current, segment];
        onSegmentsChange([...transcriptRef.current]);
        onInterimChange('');
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
      recognition.onerror = null;
    },
  };
}
