import { formatDuration } from './storage';

export const DEFAULT_BARS = Array.from({ length: 24 }, (_, index) => (index % 4 === 0 ? 24 : 10));

export function getSpeechRecognitionClass() {
  if (typeof window === 'undefined') {
    return null;
  }

  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function labelSpeaker(map, speakerId) {
  return map?.[String(speakerId)] || `Speaker ${Number(speakerId) + 1}`;
}

export function recordingToText(recording) {
  return (recording?.transcript || [])
    .map(
      (segment) =>
        `[${formatDuration(segment.timestamp)}] ${labelSpeaker(recording.speakerNames, segment.speakerId)}: ${segment.text}`
    )
    .join('\n');
}

export function recordingErrorMessage(error) {
  if (
    typeof window !== 'undefined' &&
    !window.isSecureContext &&
    window.location.hostname !== 'localhost'
  ) {
    return 'Nagrywanie mikrofonu wymaga bezpiecznego adresu https:// albo localhost.';
  }

  if (typeof window !== 'undefined' && typeof window.MediaRecorder === 'undefined') {
    return 'Ta przegladarka nie obsluguje zapisu audio przez MediaRecorder.';
  }

  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return '❌ Dostep do mikrofonu zablokowany. Aby odblokować: 1) Kliknij ikonę 🔒 obok adresu strony, 2) Wybierz "Zezwalaj" przy mikrofonie, 3) Odśwież stronę.';
    case 'NotFoundError':
      return 'Nie znaleziono zadnego mikrofonu. Podłącz mikrofon i spróbuj ponownie.';
    case 'NotReadableError':
      return 'Mikrofon jest teraz zajety przez inna aplikacje. Zamknij inne aplikacje uzywajace mikrofonu.';
    case 'AbortError':
      return 'Nagrywanie zostalo przerwane zanim zdazylo wystartowac.';
    default:
      return 'Nie udalo sie wlaczyc nagrywania. Spróbuj ponownie.';
  }
}
