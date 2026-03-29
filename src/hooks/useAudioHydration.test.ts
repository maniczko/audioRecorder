import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAudioHydration from './useAudioHydration';

let blobCounter = 0;

// Non-empty meetings so the mount-time useEffect goes through the "else" branch
// where functional updaters return `prev` (same reference) → no re-render triggered.
// Empty userMeetings causes setAudioUrls(() => ({})) which returns a NEW {} reference,
// forcing a re-render that blocks under vitest's global fakeTimers + React 19 scheduler.
const STABLE_MEETINGS = [{ id: 'm1', recordings: [] as any[] }];

function makeService(overrides: Record<string, any> = {}) {
  return {
    getRecordingAudioBlob: vi.fn().mockResolvedValue(new Blob(['audio'])),
    normalizeRecordingAudio: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useAudioHydration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    blobCounter = 0;
    globalThis.URL.createObjectURL = vi.fn(() => `blob:url-${++blobCounter}`);
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('returns empty initial state', () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    expect(result.current.audioUrls).toEqual({});
    expect(result.current.audioHydrationErrors).toEqual({});
    expect(result.current.audioHydrationStatusByRecordingId).toEqual({});
  });

  it('hydrateRecordingAudio creates object URL and returns it', async () => {
    const service = makeService();
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    let url: string | null = null;
    await act(async () => {
      url = await result.current.hydrateRecordingAudio('rec-1');
    });

    expect(url).toBe('blob:url-1');
    expect(service.getRecordingAudioBlob).toHaveBeenCalledWith('rec-1');
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('skips fetch when already loaded (returns cached URL)', async () => {
    const service = makeService();
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });
    service.getRecordingAudioBlob.mockClear();

    let url: string | null = null;
    await act(async () => {
      url = await result.current.hydrateRecordingAudio('rec-1');
    });
    expect(url).toBe('blob:url-1');
    expect(service.getRecordingAudioBlob).not.toHaveBeenCalled();
  });

  it('force option re-fetches and revokes old URL', async () => {
    const service = makeService();
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });

    let url: string | null = null;
    await act(async () => {
      url = await result.current.hydrateRecordingAudio('rec-1', { force: true });
    });

    expect(url).toBe('blob:url-2');
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
  });

  it('sets error on blob fetch failure', async () => {
    const service = makeService({
      getRecordingAudioBlob: vi.fn().mockRejectedValue(new Error('Network fail')),
    });
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    let url: string | null = null;
    await act(async () => {
      url = await result.current.hydrateRecordingAudio('rec-1');
    });
    expect(url).toBeNull();
    expect(result.current.audioHydrationErrors['rec-1']).toBe('Network fail');
    expect(result.current.audioHydrationStatusByRecordingId['rec-1']).toBe('error');
  });

  it('returns null for empty recordingId', async () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      expect(await result.current.hydrateRecordingAudio('')).toBeNull();
    });
  });

  it('returns null without getRecordingAudioBlob method', async () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: {} as any, userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      expect(await result.current.hydrateRecordingAudio('rec-1')).toBeNull();
    });
  });

  it('registerAudioUrl calls createObjectURL with the blob', async () => {
    const blob = new Blob(['data']);
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      result.current.registerAudioUrl('rec-2', blob);
    });
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('registerAudioUrl skips when URL already exists and revokes duplicate', async () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    // Hydrate first to populate audioUrls ref
    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });
    // Register a duplicate — should revoke the new blob URL
    await act(async () => {
      result.current.registerAudioUrl('rec-1', new Blob(['dup']));
    });
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-2');
  });

  it('removeAudioUrl revokes and clears state', async () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });
    await act(async () => {
      result.current.removeAudioUrl('rec-1');
    });
    expect(result.current.audioUrls['rec-1']).toBeUndefined();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
  });

  it('clearAudioHydrationError clears error', async () => {
    const service = makeService({
      getRecordingAudioBlob: vi.fn().mockRejectedValue(new Error('oops')),
    });
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });
    expect(result.current.audioHydrationErrors['rec-1']).toBe('oops');
    await act(async () => {
      result.current.clearAudioHydrationError('rec-1');
    });
    expect(result.current.audioHydrationErrors['rec-1']).toBeUndefined();
  });

  it('cleans up stale URLs when meetings change', async () => {
    const meetings = [{ id: 'm1', recordings: [{ id: 'rec-1' }] }];
    const { result, rerender } = renderHook(
      ({ m }) => useAudioHydration({ mediaService: makeService(), userMeetings: m }),
      { initialProps: { m: meetings } }
    );
    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });

    // Change meetings to one without that recording → stale URL cleaned up
    rerender({ m: [{ id: 'm2', recordings: [{ id: 'rec-other' }] }] });
    expect(result.current.audioUrls['rec-1']).toBeUndefined();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
  });

  it('normalizeRecording re-hydrates after normalization', async () => {
    const service = makeService();
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-1');
    });
    await act(async () => {
      await result.current.normalizeRecording('rec-1');
    });
    expect(service.normalizeRecordingAudio).toHaveBeenCalledWith('rec-1');
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1');
    // Second createObjectURL call produces url-2
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('registerAudioUrl ignores null/undefined inputs', async () => {
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: makeService(), userMeetings: STABLE_MEETINGS })
    );
    await act(async () => {
      result.current.registerAudioUrl('', new Blob(['data']));
      result.current.registerAudioUrl('rec-1', null);
    });
    expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled();
  });
});
