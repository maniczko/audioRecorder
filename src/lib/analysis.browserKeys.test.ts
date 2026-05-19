import { afterEach, describe, expect, it, vi } from 'vitest';

describe('analysis browser AI fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not call Anthropic directly when the browser-key opt-in is disabled', async () => {
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

    const { analyzeMeeting } = await import('./analysis');
    const result = await analyzeMeeting({
      meeting: { id: 'm1', title: 'Planning' },
      segments: [{ speakerId: 0, text: 'We need a plan.', timestamp: 0 }],
      speakerNames: { '0': 'Anna' },
      diarization: { speakerCount: 1 },
    });

    expect(result.mode).toMatch(/fallback|local/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
