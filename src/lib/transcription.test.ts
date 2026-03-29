import { describe, it, expect, vi, beforeEach } from 'vitest';

let idCounter = 0;
vi.mock('./storage', () => ({
  createId: (prefix: string) => `${prefix}_${++idCounter}`,
}));

let mockSpeechRecognitionClass: any = null;
vi.mock('./recording', () => ({
  getSpeechRecognitionClass: () => mockSpeechRecognitionClass,
}));

vi.mock('./diarization', () => ({
  signatureAroundTimestamp: vi.fn((_timeline, _ts) => 'sig_mock'),
}));

import { TRANSCRIPTION_PROVIDER, createBrowserTranscriptionController } from './transcription';

function createMockSpeechRecognition() {
  return class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    onerror: any = null;
    onresult: any = null;
    onend: any = null;
    start = vi.fn();
    stop = vi.fn();
  };
}

describe('TRANSCRIPTION_PROVIDER', () => {
  it('has correct id and label', () => {
    expect(TRANSCRIPTION_PROVIDER.id).toBe('browser-local');
    expect(TRANSCRIPTION_PROVIDER.label).toBeTruthy();
  });
});

describe('createBrowserTranscriptionController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
    mockSpeechRecognitionClass = null;
  });

  it('returns null when SpeechRecognition is not available', () => {
    mockSpeechRecognitionClass = null;
    const result = createBrowserTranscriptionController({
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });
    expect(result).toBeNull();
  });

  it('returns controller with start/stop/setOnEnd/clearHandlers', () => {
    mockSpeechRecognitionClass = createMockSpeechRecognition();
    const controller = createBrowserTranscriptionController({
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });

    expect(controller).not.toBeNull();
    expect(controller!.recognition).toBeDefined();
    expect(typeof controller!.start).toBe('function');
    expect(typeof controller!.stop).toBe('function');
    expect(typeof controller!.setOnEnd).toBe('function');
    expect(typeof controller!.clearHandlers).toBe('function');
  });

  it('configures recognition with continuous, interimResults, and lang', () => {
    mockSpeechRecognitionClass = createMockSpeechRecognition();
    const controller = createBrowserTranscriptionController({
      lang: 'en-US',
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });

    expect(controller!.recognition.continuous).toBe(true);
    expect(controller!.recognition.interimResults).toBe(true);
    expect(controller!.recognition.lang).toBe('en-US');
  });

  it('start() and stop() delegate to recognition', () => {
    mockSpeechRecognitionClass = createMockSpeechRecognition();
    const controller = createBrowserTranscriptionController({
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });

    controller!.start();
    expect(controller!.recognition.start).toHaveBeenCalled();

    controller!.stop();
    expect(controller!.recognition.stop).toHaveBeenCalled();
  });

  it('setOnEnd sets recognition.onend', () => {
    mockSpeechRecognitionClass = createMockSpeechRecognition();
    const controller = createBrowserTranscriptionController({
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });

    const callback = vi.fn();
    controller!.setOnEnd(callback);
    expect(controller!.recognition.onend).toBe(callback);
  });

  it('clearHandlers nullifies onresult, onend, onerror', () => {
    mockSpeechRecognitionClass = createMockSpeechRecognition();
    const controller = createBrowserTranscriptionController({
      startTimeRef: { current: 0 },
      transcriptRef: { current: [] },
      signatureTimelineRef: { current: [] },
      onSegmentsChange: vi.fn(),
      onInterimChange: vi.fn(),
      onError: vi.fn(),
    });

    controller!.clearHandlers();
    expect(controller!.recognition.onresult).toBeNull();
    expect(controller!.recognition.onend).toBeNull();
    expect(controller!.recognition.onerror).toBeNull();
  });

  describe('onerror handler', () => {
    it('ignores no-speech and aborted errors', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      const onError = vi.fn();
      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 0 },
        transcriptRef: { current: [] },
        signatureTimelineRef: { current: [] },
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onError,
      });

      controller!.recognition.onerror({ error: 'no-speech' });
      controller!.recognition.onerror({ error: 'aborted' });
      expect(onError).not.toHaveBeenCalled();
    });

    it('maps network error to Polish message', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      const onError = vi.fn();
      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 0 },
        transcriptRef: { current: [] },
        signatureTimelineRef: { current: [] },
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onError,
      });

      controller!.recognition.onerror({ error: 'network' });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('połączenie'));
    });

    it('maps not-allowed error to permissions message', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      const onError = vi.fn();
      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 0 },
        transcriptRef: { current: [] },
        signatureTimelineRef: { current: [] },
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onError,
      });

      controller!.recognition.onerror({ error: 'not-allowed' });
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Mikrofon'));
    });
  });

  describe('onresult handler', () => {
    it('processes final results into segments', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      vi.spyOn(Date, 'now').mockReturnValue(5000);

      const transcriptRef = { current: [] as any[] };
      const onSegmentsChange = vi.fn();
      const onInterimChange = vi.fn();

      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 2000 },
        transcriptRef,
        signatureTimelineRef: { current: [] },
        onSegmentsChange,
        onInterimChange,
        onError: vi.fn(),
      });

      controller!.recognition.onresult({
        resultIndex: 0,
        results: [
          { 0: { transcript: ' Hello world ', confidence: 0.95 }, isFinal: true, length: 1 },
        ],
      });

      expect(transcriptRef.current).toHaveLength(1);
      expect(transcriptRef.current[0].text).toBe('Hello world');
      expect(transcriptRef.current[0].timestamp).toBe(3); // (5000-2000)/1000
      expect(transcriptRef.current[0].speakerId).toBe(0);
      expect(transcriptRef.current[0].signature).toBe('sig_mock');
      expect(onSegmentsChange).toHaveBeenCalledWith(transcriptRef.current);
      expect(onInterimChange).toHaveBeenCalledWith('');

      vi.restoreAllMocks();
    });

    it('processes interim results', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      const onInterimChange = vi.fn();

      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 0 },
        transcriptRef: { current: [] },
        signatureTimelineRef: { current: [] },
        onSegmentsChange: vi.fn(),
        onInterimChange,
        onError: vi.fn(),
      });

      controller!.recognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: 'partial text' }, isFinal: false, length: 1 }],
      });

      expect(onInterimChange).toHaveBeenCalledWith('partial text');
    });

    it('skips results with empty transcript', () => {
      mockSpeechRecognitionClass = createMockSpeechRecognition();
      const onSegmentsChange = vi.fn();
      const onInterimChange = vi.fn();

      const controller = createBrowserTranscriptionController({
        startTimeRef: { current: 0 },
        transcriptRef: { current: [] },
        signatureTimelineRef: { current: [] },
        onSegmentsChange,
        onInterimChange,
        onError: vi.fn(),
      });

      controller!.recognition.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: '   ' }, isFinal: true, length: 1 }],
      });

      expect(onSegmentsChange).not.toHaveBeenCalled();
    });
  });
});
