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
  const reportedErrors = new Set<string>();
  let liveRecognitionRestartEnabled = true;

  function isTerminalLiveRecognitionError(error: string) {
    return ['network', 'service-not-allowed', 'language-not-supported'].includes(error);
  }

  recognition.onerror = (event) => {
    // "no-speech" is benign (silence); "aborted" happens on programmatic stop; both are expected.
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      if (isTerminalLiveRecognitionError(event.error)) {
        liveRecognitionRestartEnabled = false;
      }
      if (reportedErrors.has(event.error)) {
        return;
      }
      reportedErrors.add(event.error);
      console.warn('[SpeechRecognition] Live transcription degraded:', event.error);
      if (typeof onError === 'function') {
        const messages = {
          network: 'Transkrypcja live niedostepna - sprawdz polaczenie z internetem.',
          'not-allowed': 'Mikrofon zablokowany - sprawdz uprawnienia przegladarki.',
          'service-not-allowed': 'Usluga rozpoznawania mowy niedostepna w tej przegladarce.',
          'language-not-supported': 'Jezyk pl-PL nie jest obslugiwany przez te przegladarke.',
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
      recognition.onend = () => {
        if (liveRecognitionRestartEnabled) {
          callback();
        }
      };
    },
    clearHandlers() {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
    },
  };
}
