import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAudioHydration from './useAudioHydration';

const mockGetAudioBlob = vi.hoisted(() => vi.fn());

vi.mock('../lib/audioStore', () => ({
  getAudioBlob: mockGetAudioBlob,
}));

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
    mockGetAudioBlob.mockReset();
    mockGetAudioBlob.mockResolvedValue(null);
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

  it('uses local IndexedDB blob first and skips remote fetch', async () => {
    const service = makeService();
    mockGetAudioBlob.mockResolvedValueOnce(new Blob(['local-audio']));
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    let url: string | null = null;
    await act(async () => {
      url = await result.current.hydrateRecordingAudio('rec-local');
    });

    expect(url).toBe('blob:url-1');
    expect(mockGetAudioBlob).toHaveBeenCalledWith('rec-local');
    expect(service.getRecordingAudioBlob).not.toHaveBeenCalled();
  });

  it('falls back to remote fetch when local blob is missing', async () => {
    const service = makeService({
      getRecordingAudioBlob: vi.fn().mockResolvedValue(new Blob(['remote-audio'])),
    });
    mockGetAudioBlob.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-remote');
    });

    expect(mockGetAudioBlob).toHaveBeenCalledWith('rec-remote');
    expect(service.getRecordingAudioBlob).toHaveBeenCalledWith('rec-remote');
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

  // -----------------------------------------------------------------
  // Issue #0 - missing audio retried on every render after 404
  // Date: 2026-04-05
  // Bug: remote audio 404s were treated as generic errors in the UI flow,
  //      so consumers could keep retrying hydration on re-render.
  // Fix: hydration stores the error state and subsequent non-forced calls
  //      short-circuit until the user explicitly retries.
  // -----------------------------------------------------------------
  it('Regression: #0 - does not refetch after a 404 until forced', async () => {
    const notFoundError = Object.assign(new Error('Nie znaleziono nagrania.'), { status: 404 });
    const service = makeService({
      getRecordingAudioBlob: vi.fn().mockRejectedValue(notFoundError),
    });
    const { result } = renderHook(() =>
      useAudioHydration({ mediaService: service, userMeetings: STABLE_MEETINGS })
    );

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-404');
    });

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-404');
    });

    expect(service.getRecordingAudioBlob).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.hydrateRecordingAudio('rec-404', { force: true });
    });

    expect(service.getRecordingAudioBlob).toHaveBeenCalledTimes(2);
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
