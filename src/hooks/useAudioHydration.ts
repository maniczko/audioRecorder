import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioBlob } from '../lib/audioStore';

function revokeAudioUrl(url: string) {
  if (url && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(url);
  }
}

interface UseAudioHydrationOptions {
  force?: boolean;
  priority?: boolean;
}

interface UseAudioHydrationParams {
  mediaService: any;
  userMeetings: any[];
}

export default function useAudioHydration({ mediaService, userMeetings }: UseAudioHydrationParams) {
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [audioHydrationErrors, setAudioHydrationErrors] = useState<Record<string, string>>({});
  const [audioHydrationStatusByRecordingId, setAudioHydrationStatusByRecordingId] = useState<
    Record<string, string>
  >({});
  const audioUrlsRef = useRef<Record<string, string>>({});
  const audioHydrationStatusRef = useRef<Record<string, string>>({});

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    audioHydrationStatusRef.current = audioHydrationStatusByRecordingId;
  }, [audioHydrationStatusByRecordingId]);

  const hydrateRecordingAudio = useCallback(
    async (recordingId: string, options: UseAudioHydrationOptions = {}) => {
      if (!recordingId || !mediaService?.getRecordingAudioBlob) return null;
      const force = Boolean(options.force);
      if (!force && audioUrlsRef.current[recordingId]) {
        return audioUrlsRef.current[recordingId];
      }
      const currentStatus = audioHydrationStatusRef.current[recordingId];
      if (!force && (currentStatus === 'loading' || currentStatus === 'error')) {
        return null;
      }

      // Update ref synchronously to prevent duplicate requests before React re-renders
      audioHydrationStatusRef.current = {
        ...audioHydrationStatusRef.current,
        [recordingId]: 'loading',
      };
      setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: 'loading' }));
      setAudioHydrationErrors((prev) => {
        if (!prev[recordingId]) return prev;
        const next = { ...prev };
        delete next[recordingId];
        return next;
      });

      try {
        let blob: Blob | null = null;

        // Prefer local IndexedDB audio first (ad-hoc/local recordings may not exist on backend yet).
        try {
          const localBlob = await getAudioBlob(recordingId);
          blob = localBlob instanceof Blob ? localBlob : null;
        } catch {
          blob = null;
        }

        if (!blob) {
          blob = await mediaService.getRecordingAudioBlob(recordingId);
        }

        if (!blob || typeof URL === 'undefined' || !URL.createObjectURL) {
          throw new Error('Audio blob jest niedostepny.');
        }

        const nextUrl = URL.createObjectURL(blob);
        audioUrlsRef.current = { ...audioUrlsRef.current, [recordingId]: nextUrl };
        setAudioUrls((prev) => {
          const existing = prev[recordingId];
          if (existing) {
            revokeAudioUrl(existing);
          }
          return { ...prev, [recordingId]: nextUrl };
        });
        audioHydrationStatusRef.current = {
          ...audioHydrationStatusRef.current,
          [recordingId]: 'ready',
        };
        setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: 'ready' }));
        return nextUrl;
      } catch (error) {
        const is404 = (error as any)?.status === 404;
        if (!is404) {
          console.warn(
            `Audio hydration failed for ${recordingId}:`,
            error instanceof Error ? error.message : error
          );
        }
        audioHydrationStatusRef.current = {
          ...audioHydrationStatusRef.current,
          [recordingId]: 'error',
        };
        setAudioHydrationErrors((prev) => ({
          ...prev,
          [recordingId]: error instanceof Error ? error.message : 'Blad ladowania audio',
        }));
        setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: 'error' }));
        return null;
      }
    },
    [mediaService]
  );

  useEffect(() => {
    if (!userMeetings.length) {
      setAudioUrls((prev) => {
        Object.values(prev).forEach(revokeAudioUrl);
        return {};
      });
      setAudioHydrationErrors({});
      setAudioHydrationStatusByRecordingId({});
      return;
    }

    const recordingIds = new Set(
      userMeetings.flatMap((meeting) => (meeting.recordings || []).map((recording) => recording.id))
    );
    setAudioUrls((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(prev).forEach(([rid, url]) => {
        if (!recordingIds.has(rid)) {
          revokeAudioUrl(url);
          delete next[rid];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setAudioHydrationStatusByRecordingId((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(prev).forEach((rid) => {
        if (!recordingIds.has(rid)) {
          delete next[rid];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setAudioHydrationErrors((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(prev).forEach((rid) => {
        if (!recordingIds.has(rid)) {
          delete next[rid];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [hydrateRecordingAudio, userMeetings]);

  useEffect(
    () => () => {
      Object.values(audioUrlsRef.current).forEach(revokeAudioUrl);
    },
    []
  );

  const normalizeRecording = useCallback(
    async (recordingId) => {
      if (!recordingId || !mediaService.normalizeRecordingAudio) return;
      await mediaService.normalizeRecordingAudio(recordingId);
      const old = audioUrlsRef.current[recordingId];
      if (old) {
        revokeAudioUrl(old);
        setAudioUrls((prev) => {
          const next = { ...prev };
          delete next[recordingId];
          return next;
        });
      }
      await hydrateRecordingAudio(recordingId, { force: true });
    },
    [hydrateRecordingAudio, mediaService]
  );

  function registerAudioUrl(recordingId, blob) {
    if (!recordingId || !blob || typeof URL === 'undefined' || !URL.createObjectURL) {
      return;
    }

    const nextUrl = URL.createObjectURL(blob);
    setAudioUrls((prev) => {
      if (prev[recordingId]) {
        revokeAudioUrl(nextUrl);
        return prev;
      }
      return {
        ...prev,
        [recordingId]: nextUrl,
      };
    });
    setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: 'ready' }));
    setAudioHydrationErrors((prev) => {
      if (!prev[recordingId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });
  }

  function clearAudioHydrationError(recordingId) {
    if (!recordingId) return;
    setAudioHydrationErrors((prev) => {
      if (!prev[recordingId]) return prev;
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });
  }

  function removeAudioUrl(recordingId) {
    if (!recordingId) return;

    const oldUrl = audioUrlsRef.current[recordingId];
    if (oldUrl) {
      revokeAudioUrl(oldUrl);
    }

    setAudioUrls((prev) => {
      if (!prev[recordingId]) return prev;
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });

    setAudioHydrationStatusByRecordingId((prev) => {
      if (!prev[recordingId]) return prev;
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });

    setAudioHydrationErrors((prev) => {
      if (!prev[recordingId]) return prev;
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });
  }

  return {
    audioUrls,
    audioHydrationErrors,
    audioHydrationStatusByRecordingId,
    normalizeRecording,
    registerAudioUrl,
    hydrateRecordingAudio,
    clearAudioHydrationError,
    removeAudioUrl,
  };
}
