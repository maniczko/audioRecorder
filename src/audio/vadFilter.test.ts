import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filterSilence } from './vadFilter';
import type { VadFilterResult } from './vadFilter';

/**
 * Helper: create a mock AudioBuffer from Float32Array.
 */
function createMockAudioBuffer(samples: Float32Array, sampleRate: number) {
  return {
    sampleRate,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    length: samples.length,
    getChannelData: vi.fn().mockReturnValue(samples),
  };
}

/**
 * Helper: generate a sine wave at given amplitude (0-1) and length in seconds.
 */
function generateTone(durationS: number, sampleRate: number, amplitude: number): Float32Array {
  const samples = new Float32Array(Math.round(durationS * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin(2 * Math.PI * 440 * (i / sampleRate));
  }
  return samples;
}

/**
 * Helper: generate silence (zero samples).
 */
function generateSilence(durationS: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.round(durationS * sampleRate));
}

/**
 * Helper: concatenate Float32Arrays.
 */
function concat(...arrays: Float32Array[]): Float32Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

describe('vadFilter', () => {
  let mockClose: ReturnType<typeof vi.fn>;
  let mockDecodeAudioData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClose = vi.fn();
    mockDecodeAudioData = vi.fn();

    // Mock AudioContext on window — must be a real constructor (class/function)
    (window as any).AudioContext = class MockAudioContext {
      decodeAudioData = mockDecodeAudioData;
      close = mockClose;
    };
  });

  afterEach(() => {
    delete (window as any).AudioContext;
    vi.restoreAllMocks();
  });

  it('returns original blob when AudioContext is unavailable', async () => {
    delete (window as any).AudioContext;
    delete (window as any).webkitAudioContext;

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    expect(result.blob).toBe(blob);
    expect(result.removedS).toBe(0);
  });

  it('returns original blob on decode error', async () => {
    mockDecodeAudioData.mockRejectedValue(new Error('decode failed'));

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await filterSilence(blob);

    expect(result.blob).toBe(blob);
    expect(result.removedS).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('always closes AudioContext', async () => {
    mockDecodeAudioData.mockRejectedValue(new Error('fail'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    await filterSilence(blob);

    expect(mockClose).toHaveBeenCalled();
  });

  it('returns original blob for fully silent audio', async () => {
    const sr = 16000;
    const samples = generateSilence(5, sr);
    const audioBuffer = createMockAudioBuffer(samples, sr);
    mockDecodeAudioData.mockResolvedValue(audioBuffer);

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    expect(result.blob).toBe(blob);
    expect(result.originalDurationS).toBeCloseTo(5, 0);
    expect(result.removedS).toBe(0);
  });

  it('returns original blob when silence gap is less than 2 seconds', async () => {
    const sr = 16000;
    // 2s speech + 1.5s silence + 2s speech = not enough silence to remove
    const samples = concat(
      generateTone(2, sr, 0.5),
      generateSilence(1.5, sr),
      generateTone(2, sr, 0.5)
    );
    const audioBuffer = createMockAudioBuffer(samples, sr);
    mockDecodeAudioData.mockResolvedValue(audioBuffer);

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    expect(result.blob).toBe(blob);
    expect(result.removedS).toBe(0);
  });

  it('filters silence when gap exceeds 2 seconds', async () => {
    const sr = 16000;
    // 2s speech + 5s silence + 2s speech = 5s silence should be removed
    const samples = concat(
      generateTone(2, sr, 0.5),
      generateSilence(5, sr),
      generateTone(2, sr, 0.5)
    );
    const audioBuffer = createMockAudioBuffer(samples, sr);
    mockDecodeAudioData.mockResolvedValue(audioBuffer);

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    expect(result.blob).not.toBe(blob);
    expect(result.blob.type).toBe('audio/wav');
    expect(result.originalDurationS).toBeCloseTo(9, 0);
    expect(result.filteredDurationS).toBeLessThan(result.originalDurationS);
    expect(result.removedS).toBeGreaterThan(2);
  });

  it('preserves speech content in filtered output', async () => {
    const sr = 16000;
    const samples = concat(
      generateTone(3, sr, 0.5),
      generateSilence(10, sr),
      generateTone(3, sr, 0.5)
    );
    const audioBuffer = createMockAudioBuffer(samples, sr);
    mockDecodeAudioData.mockResolvedValue(audioBuffer);

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    // Filtered duration should be roughly the speech portion (3+3=6s) plus some padding
    expect(result.filteredDurationS).toBeGreaterThan(5);
    expect(result.filteredDurationS).toBeLessThan(10);
  });

  it('output blob contains valid WAV header', async () => {
    const sr = 16000;
    const samples = concat(
      generateTone(2, sr, 0.5),
      generateSilence(5, sr),
      generateTone(2, sr, 0.5)
    );
    const audioBuffer = createMockAudioBuffer(samples, sr);
    mockDecodeAudioData.mockResolvedValue(audioBuffer);

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    const arrayBuf = await result.blob.arrayBuffer();
    const view = new DataView(arrayBuf);

    // RIFF header
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe('RIFF');

    // WAVE format
    const wave = String.fromCharCode(
      view.getUint8(8),
      view.getUint8(9),
      view.getUint8(10),
      view.getUint8(11)
    );
    expect(wave).toBe('WAVE');

    // IEEE float format (3)
    expect(view.getUint16(20, true)).toBe(3);

    // Mono (1 channel)
    expect(view.getUint16(22, true)).toBe(1);

    // Sample rate matches
    expect(view.getUint32(24, true)).toBe(sr);
  });

  it('uses webkitAudioContext as fallback', async () => {
    delete (window as any).AudioContext;
    const sr = 16000;
    const samples = generateSilence(1, sr);
    const audioBuffer = createMockAudioBuffer(samples, sr);

    const localDecodeAudioData = vi.fn().mockResolvedValue(audioBuffer);
    const localClose = vi.fn();

    (window as any).webkitAudioContext = class MockWebkitAudioContext {
      decodeAudioData = localDecodeAudioData;
      close = localClose;
    };

    const blob = new Blob(['audio'], { type: 'audio/wav' });
    const result = await filterSilence(blob);

    expect(result.originalDurationS).toBeCloseTo(1, 0);
    delete (window as any).webkitAudioContext;
  });
});
