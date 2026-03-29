import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSpeechRecognitionClass,
  labelSpeaker,
  recordingToText,
  recordingErrorMessage,
  DEFAULT_BARS,
} from './recording';

vi.mock('./storage', () => ({
  formatDuration: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
}));

describe('recording', () => {
  // --- DEFAULT_BARS ---
  describe('DEFAULT_BARS', () => {
    it('has 24 elements', () => {
      expect(DEFAULT_BARS).toHaveLength(24);
    });

    it('alternates 24 and 10 (every 4th is 24)', () => {
      expect(DEFAULT_BARS[0]).toBe(24);
      expect(DEFAULT_BARS[1]).toBe(10);
      expect(DEFAULT_BARS[4]).toBe(24);
      expect(DEFAULT_BARS[3]).toBe(10);
    });
  });

  // --- getSpeechRecognitionClass ---
  describe('getSpeechRecognitionClass', () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
      if (originalWindow) {
        globalThis.window = originalWindow;
      }
    });

    it('returns SpeechRecognition when available', () => {
      const FakeSR = class {};
      (window as any).SpeechRecognition = FakeSR;
      expect(getSpeechRecognitionClass()).toBe(FakeSR);
      delete (window as any).SpeechRecognition;
    });

    it('returns webkitSpeechRecognition as fallback', () => {
      delete (window as any).SpeechRecognition;
      const FakeWebkit = class {};
      (window as any).webkitSpeechRecognition = FakeWebkit;
      expect(getSpeechRecognitionClass()).toBe(FakeWebkit);
      delete (window as any).webkitSpeechRecognition;
    });

    it('returns null when neither is available', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      expect(getSpeechRecognitionClass()).toBeNull();
    });
  });

  // --- labelSpeaker ---
  describe('labelSpeaker', () => {
    it('returns mapped name from speaker map', () => {
      expect(labelSpeaker({ '0': 'Anna', '1': 'Jan' }, 0)).toBe('Anna');
    });

    it('returns "Speaker N" when map is undefined', () => {
      expect(labelSpeaker(undefined, 0)).toBe('Speaker 1');
    });

    it('returns "Speaker N" when speakerId not in map', () => {
      expect(labelSpeaker({ '0': 'Anna' }, 5)).toBe('Speaker 6');
    });

    it('handles string speakerId', () => {
      expect(labelSpeaker({ '2': 'Kasia' }, '2')).toBe('Kasia');
    });

    it('converts numeric speakerId to string key lookup', () => {
      expect(labelSpeaker({ '3': 'Piotr' }, 3)).toBe('Piotr');
    });
  });

  // --- recordingToText ---
  describe('recordingToText', () => {
    it('returns empty string for recording with empty transcript', () => {
      expect(recordingToText({ transcript: [] })).toBe('');
    });

    it('returns empty string for null recording', () => {
      expect(recordingToText(null)).toBe('');
    });

    it('returns empty string for undefined recording', () => {
      expect(recordingToText(undefined)).toBe('');
    });

    it('formats transcript segments correctly', () => {
      const recording = {
        transcript: [
          { timestamp: 60000, speakerId: 0, text: 'Hello' },
          { timestamp: 120000, speakerId: 1, text: 'Hi there' },
        ],
        speakerNames: { '0': 'Anna', '1': 'Jan' },
      };
      const result = recordingToText(recording);
      expect(result).toBe('[1:00] Anna: Hello\n[2:00] Jan: Hi there');
    });

    it('uses Speaker N fallback when no speakerNames', () => {
      const recording = {
        transcript: [{ timestamp: 0, speakerId: 0, text: 'Test' }],
      };
      const result = recordingToText(recording);
      expect(result).toContain('Speaker 1');
    });
  });

  // --- recordingErrorMessage ---
  describe('recordingErrorMessage', () => {
    let originalIsSecureContext: boolean;

    beforeEach(() => {
      originalIsSecureContext = window.isSecureContext;
      // jsdom doesn't define MediaRecorder — mock it so the error function
      // reaches the switch statement instead of short-circuiting.
      (window as any).MediaRecorder = class {};
    });

    afterEach(() => {
      Object.defineProperty(window, 'isSecureContext', {
        value: originalIsSecureContext,
        configurable: true,
      });
      delete (window as any).MediaRecorder;
    });

    it('returns NotAllowedError message', () => {
      const result = recordingErrorMessage({ name: 'NotAllowedError' });
      expect(result).toContain('zablokowany');
    });

    it('returns SecurityError message (same as NotAllowedError)', () => {
      const result = recordingErrorMessage({ name: 'SecurityError' });
      expect(result).toContain('zablokowany');
    });

    it('returns NotFoundError message', () => {
      const result = recordingErrorMessage({ name: 'NotFoundError' });
      expect(result).toContain('mikrofonu');
    });

    it('returns NotReadableError message', () => {
      const result = recordingErrorMessage({ name: 'NotReadableError' });
      expect(result).toContain('zajety');
    });

    it('returns AbortError message', () => {
      const result = recordingErrorMessage({ name: 'AbortError' });
      expect(result).toContain('przerwane');
    });

    it('returns default message for unknown error', () => {
      const result = recordingErrorMessage({ name: 'SomethingElse' });
      expect(result).toContain('Nie udalo sie');
    });

    it('returns default message when error is null', () => {
      const result = recordingErrorMessage(null);
      expect(result).toContain('Nie udalo sie');
    });
  });
});
