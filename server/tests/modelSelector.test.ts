import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockConfig = vi.hoisted(() => ({
  VOICELOG_STT_MODEL_FAST: 'whisper-tiny',
  VOICELOG_STT_MODEL_FULL: 'whisper-1',
}));

vi.mock('../config.ts', () => ({
  get config() {
    return mockConfig;
  },
}));

describe('modelSelector.ts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('returns fast model for "fast" mode', async () => {
    const { getSttModelForProcessingMode } = await import('../stt/modelSelector.js');
    expect(getSttModelForProcessingMode('fast')).toBe('whisper-tiny');
  });

  test('returns full model for "full" mode', async () => {
    const { getSttModelForProcessingMode } = await import('../stt/modelSelector.js');
    expect(getSttModelForProcessingMode('full')).toBe('whisper-1');
  });

  test('returns default fast model when config not customized', async () => {
    const { getSttModelForProcessingMode } = await import('../stt/modelSelector.js');
    expect(getSttModelForProcessingMode('fast')).toBe('whisper-tiny');
  });

  test('returns default full model when config not customized', async () => {
    const { getSttModelForProcessingMode } = await import('../stt/modelSelector.js');
    expect(getSttModelForProcessingMode('full')).toBe('whisper-1');
  });

  test('shouldUseFastModel returns true for "fast"', async () => {
    const { shouldUseFastModel } = await import('../stt/modelSelector.js');
    expect(shouldUseFastModel('fast')).toBe(true);
  });

  test('shouldUseFastModel returns false for "full"', async () => {
    const { shouldUseFastModel } = await import('../stt/modelSelector.js');
    expect(shouldUseFastModel('full')).toBe(false);
  });

  test('shouldUseFastModel returns false for unknown mode', async () => {
    const { shouldUseFastModel } = await import('../stt/modelSelector.js');
    expect(shouldUseFastModel('unknown')).toBe(false);
  });
});
