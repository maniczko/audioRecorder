import { afterEach, describe, expect, it, vi } from 'vitest';

describe('aiTaskSuggestions browser AI fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not call Anthropic directly unless browser AI keys are explicitly enabled', async () => {
    vi.resetModules();
    vi.doMock('../services/config', () => ({
      API_BASE_URL: '',
    }));
    vi.doMock('../services/httpClient', () => ({
      apiRequest: vi.fn(),
    }));
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'sk-ant-test');
    vi.stubEnv('VITE_ALLOW_BROWSER_AI_KEYS', 'false');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as any);

    const { suggestTasksFromTranscript } = await import('./aiTaskSuggestions');
    const result = await suggestTasksFromTranscript([{ text: 'Anna will send the deck.' }]);

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
