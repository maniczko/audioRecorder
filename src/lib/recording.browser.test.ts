/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BARS,
  getSpeechRecognitionClass,
  labelSpeaker,
  recordingErrorMessage,
  recordingToText,
} from './recording';

describe('recording (browser)', () => {
  it('DEFAULT_BARS has 24 entries with higher every 4th value', () => {
    expect(DEFAULT_BARS).toHaveLength(24);
    expect(DEFAULT_BARS[0]).toBe(24);
    expect(DEFAULT_BARS[1]).toBe(10);
    expect(DEFAULT_BARS[4]).toBe(24);
  });

  it('getSpeechRecognitionClass returns SpeechRecognition when available', () => {
    (window as any).SpeechRecognition = function MockSR() {};
    expect(getSpeechRecognitionClass()).toBe((window as any).SpeechRecognition);
  });

  it('getSpeechRecognitionClass falls back to webkitSpeechRecognition', () => {
    delete (window as any).SpeechRecognition;
    (window as any).webkitSpeechRecognition = function MockWebkitSR() {};
    expect(getSpeechRecognitionClass()).toBe((window as any).webkitSpeechRecognition);
  });

  it('labelSpeaker resolves map values or defaults', () => {
    expect(labelSpeaker({ '0': 'Anna' }, 0)).toBe('Anna');
    expect(labelSpeaker({}, 1)).toBe('Speaker 2');
  });

  it('recordingToText formats transcript lines', () => {
    const recording = {
      transcript: [
        { timestamp: 65, speakerId: 0, text: 'Hello' },
        { timestamp: 125, speakerId: 1, text: 'World' },
      ],
      speakerNames: { '0': 'Anna', '1': 'Jan' },
    };
    const text = recordingToText(recording);
    expect(text).toContain('[01:05] Anna: Hello');
    expect(text).toContain('[02:05] Jan: World');
  });

  it('recordingErrorMessage returns secure-context warning', () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { hostname: 'example.com' },
      configurable: true,
    });
    expect(recordingErrorMessage(null)).toBe(
      'Nagrywanie mikrofonu wymaga bezpiecznego adresu https:// albo localhost.'
    );
  });

  it('recordingErrorMessage returns MediaRecorder warning', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      configurable: true,
    });
    const originalRecorder = (window as any).MediaRecorder;
    delete (window as any).MediaRecorder;
    expect(recordingErrorMessage(null)).toBe(
      'Ta przegladarka nie obsluguje zapisu audio przez MediaRecorder.'
    );
    (window as any).MediaRecorder = originalRecorder;
  });

  it('recordingErrorMessage maps common error names', () => {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      configurable: true,
    });
    (window as any).MediaRecorder = (window as any).MediaRecorder || function Dummy() {};

    expect(recordingErrorMessage({ name: 'NotAllowedError' })).toBe(
      'Dostep do mikrofonu jest zablokowany. Odblokuj go przy ikonie klodki obok adresu strony.'
    );
    expect(recordingErrorMessage({ name: 'NotFoundError' })).toBe(
      'Nie znaleziono zadnego mikrofonu.'
    );
    expect(recordingErrorMessage({ name: 'NotReadableError' })).toBe(
      'Mikrofon jest teraz zajety przez inna aplikacje.'
    );
    expect(recordingErrorMessage({ name: 'AbortError' })).toBe(
      'Nagrywanie zostalo przerwane zanim zdazylo wystartowac.'
    );
    expect(recordingErrorMessage({ name: 'OtherError' })).toBe('Nie udalo sie wlaczyc nagrywania.');
  });
});
