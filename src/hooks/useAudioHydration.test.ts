import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useState, useCallback, useEffect, useRef } from 'react';

// Minimal reproduction of useAudioHydration's core logic
function useTestHook({ mediaService, userMeetings }) {
  const [audioUrls, setAudioUrls] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({});

  useEffect(() => {
    if (!userMeetings.length) {
      setAudioUrls({});
      setErrors({});
      setStatus({});
      return;
    }
  }, [userMeetings]);

  const hydrate = useCallback(
    async (recordingId) => {
      if (!recordingId || !mediaService?.getRecordingAudioBlob) return null;
      setStatus((prev) => ({ ...prev, [recordingId]: 'loading' }));
      try {
        const blob = await mediaService.getRecordingAudioBlob(recordingId);
        const url = URL.createObjectURL(blob);
        setAudioUrls((prev) => ({ ...prev, [recordingId]: url }));
        setStatus((prev) => ({ ...prev, [recordingId]: 'ready' }));
        return url;
      } catch (e) {
        setErrors((prev) => ({ ...prev, [recordingId]: e.message }));
        setStatus((prev) => ({ ...prev, [recordingId]: 'error' }));
        return null;
      }
    },
    [mediaService]
  );

  return { audioUrls, errors, status, hydrate };
}

describe('testHook', () => {
  beforeEach(() => {
    vi.useRealTimers();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('renders with empty state', () => {
    const service = { getRecordingAudioBlob: vi.fn() };
    const { result } = renderHook(() => useTestHook({ mediaService: service, userMeetings: [] }));
    expect(result.current.audioUrls).toEqual({});
  });
});
