import { useCallback, useEffect, useRef, useState } from "react";

function revokeAudioUrl(url) {
  if (url && typeof URL !== "undefined" && URL.revokeObjectURL) {
    URL.revokeObjectURL(url);
  }
}

export default function useAudioHydration({ mediaService, userMeetings }) {
  const [audioUrls, setAudioUrls] = useState({});
  const [audioHydrationErrors, setAudioHydrationErrors] = useState({});
  const [audioHydrationStatusByRecordingId, setAudioHydrationStatusByRecordingId] = useState({});
  const audioUrlsRef = useRef({});
  const audioHydrationStatusRef = useRef({});

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    audioHydrationStatusRef.current = audioHydrationStatusByRecordingId;
  }, [audioHydrationStatusByRecordingId]);

  const hydrateRecordingAudio = useCallback(async (recordingId, options = {}) => {
    if (!recordingId || !mediaService?.getRecordingAudioBlob) return null;
    const force = Boolean(options.force);
    if (!force && audioUrlsRef.current[recordingId]) {
      return audioUrlsRef.current[recordingId];
    }
    if (!force && audioHydrationStatusRef.current[recordingId] === "loading") {
      return null;
    }

    setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: "loading" }));
    setAudioHydrationErrors((prev) => {
      if (!prev[recordingId]) return prev;
      const next = { ...prev };
      delete next[recordingId];
      return next;
    });

    try {
      const blob = await mediaService.getRecordingAudioBlob(recordingId);
      if (!blob || typeof URL === "undefined" || !URL.createObjectURL) {
        throw new Error("Audio blob jest niedostepny.");
      }

      const nextUrl = URL.createObjectURL(blob);
      setAudioUrls((prev) => {
        const existing = prev[recordingId];
        if (existing) {
          revokeAudioUrl(existing);
        }
        return { ...prev, [recordingId]: nextUrl };
      });
      setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: "ready" }));
      return nextUrl;
    } catch (error) {
      console.error(`Audio hydration failed for ${recordingId}.`, error);
      setAudioHydrationErrors((prev) => ({
        ...prev,
        [recordingId]: error.message || "Blad ladowania audio",
      }));
      setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: "error" }));
      return null;
    }
  }, [mediaService]);

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

    let cancelled = false;
    const recordingIds = new Set(userMeetings.flatMap((meeting) => (meeting.recordings || []).map((recording) => recording.id)));

    async function hydrateAudio() {
      for (const rid of recordingIds) {
        if (cancelled || audioUrlsRef.current[rid]) continue;
        if (audioHydrationStatusRef.current[rid] === "loading") continue;
        await hydrateRecordingAudio(rid);
      }

      if (cancelled) return;

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
    }

    hydrateAudio();
    return () => {
      cancelled = true;
    };
  }, [hydrateRecordingAudio, userMeetings]);

  useEffect(() => () => {
    Object.values(audioUrlsRef.current).forEach(revokeAudioUrl);
  }, []);

  const normalizeRecording = useCallback(async (recordingId) => {
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
  }, [hydrateRecordingAudio, mediaService]);

  function registerAudioUrl(recordingId, blob) {
    if (!recordingId || !blob || typeof URL === "undefined" || !URL.createObjectURL) {
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
    setAudioHydrationStatusByRecordingId((prev) => ({ ...prev, [recordingId]: "ready" }));
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

  return {
    audioUrls,
    audioHydrationErrors,
    audioHydrationStatusByRecordingId,
    normalizeRecording,
    registerAudioUrl,
    hydrateRecordingAudio,
    clearAudioHydrationError,
  };
}
