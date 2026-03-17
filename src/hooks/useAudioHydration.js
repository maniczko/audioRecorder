import { useEffect, useRef, useState } from "react";

function revokeAudioUrl(url) {
  if (url && typeof URL !== "undefined" && URL.revokeObjectURL) {
    URL.revokeObjectURL(url);
  }
}

export default function useAudioHydration({ mediaService, userMeetings }) {
  const [audioUrls, setAudioUrls] = useState({});
  const [audioHydrationErrors, setAudioHydrationErrors] = useState({});
  const audioUrlsRef = useRef({});

  useEffect(() => {
    audioUrlsRef.current = audioUrls;
  }, [audioUrls]);

  useEffect(() => {
    if (!userMeetings.length) {
      setAudioUrls((prev) => {
        Object.values(prev).forEach(revokeAudioUrl);
        return {};
      });
      return;
    }

    let cancelled = false;
    const recordingIds = new Set(userMeetings.flatMap((m) => (m.recordings || []).map((r) => r.id)));

    async function hydrateAudio() {
      for (const rid of recordingIds) {
        if (cancelled || audioUrlsRef.current[rid]) continue;
        try {
          const blob = await mediaService.getRecordingAudioBlob(rid);
          if (!blob || cancelled || typeof URL === "undefined" || !URL.createObjectURL) continue;
          const url = URL.createObjectURL(blob);
          setAudioUrls((prev) => (prev[rid] ? (revokeAudioUrl(url), prev) : { ...prev, [rid]: url }));
        } catch (error) {
          console.error(`Audio hydration failed for ${rid}.`, error);
          setAudioHydrationErrors((prev) => ({ ...prev, [rid]: error.message || "Błąd ładowania audio" }));
        }
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
    }

    hydrateAudio();
    return () => { cancelled = true; };
  }, [mediaService, userMeetings]);

  // Clean up on unmount
  useEffect(() => () => {
    Object.values(audioUrlsRef.current).forEach(revokeAudioUrl);
  }, []);

  async function normalizeRecording(recordingId) {
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
    try {
      const blob = await mediaService.getRecordingAudioBlob(recordingId);
      if (blob && typeof URL !== "undefined" && URL.createObjectURL) {
        setAudioUrls((prev) => ({ ...prev, [recordingId]: URL.createObjectURL(blob) }));
      }
    } catch (error) {
      console.error(`Audio re-hydration after normalize failed for ${recordingId}.`, error);
    }
  }

  return {
    audioUrls,
    audioHydrationErrors,
    normalizeRecording,
  };
}
