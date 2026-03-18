import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { labelSpeaker } from "../lib/recording";
import { formatDuration } from "../lib/storage";
import { getSpeakerColor } from "../lib/speakerColors";

const WAVEFORM_SVG_W = 1000;
const WAVEFORM_SVG_H = 80;
const WAVEFORM_NUM_BARS = 200;

function WaveformPanel({
  selectedRecording,
  selectedRecordingAudioUrl,
  audioRef,
  totalDuration,
  addRecordingMarker,
  deleteRecordingMarker,
  canEdit,
  transcript,
  displaySpeakerNames,
}) {
  const [waveformBars, setWaveformBars] = useState([]);
  const [isDecoding, setIsDecoding] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [addMarkerMode, setAddMarkerMode] = useState(false);
  const waveformRef = useRef(null);

  const markers = useMemo(() => {
    const raw = Array.isArray(selectedRecording?.markers) ? selectedRecording.markers : [];
    return raw
      .filter((m) => Number.isFinite(Number(m?.timestamp)) && Number(m.timestamp) >= 0)
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, [selectedRecording?.markers]);

  useEffect(() => {
    if (!selectedRecordingAudioUrl) {
      setWaveformBars([]);
      return undefined;
    }

    let cancelled = false;
    setIsDecoding(true);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      setIsDecoding(false);
      return undefined;
    }

    const audioContext = new AudioContextClass();

    fetch(selectedRecordingAudioUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => audioContext.decodeAudioData(buffer))
      .then((audioBuffer) => {
        if (cancelled) return;
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.max(1, Math.floor(channelData.length / WAVEFORM_NUM_BARS));
        const bars = [];
        for (let i = 0; i < WAVEFORM_NUM_BARS; i++) {
          let sum = 0;
          const base = i * step;
          for (let j = 0; j < step && base + j < channelData.length; j++) {
            sum += Math.abs(channelData[base + j]);
          }
          bars.push(sum / step);
        }
        const max = Math.max(...bars, 0.001);
        setWaveformBars(bars.map((bar) => bar / max));
      })
      .catch((error) => {
        if (!cancelled) console.error("Waveform decode error:", error);
      })
      .finally(() => {
        if (!cancelled) setIsDecoding(false);
        audioContext.close().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecordingAudioUrl]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return undefined;

    function handleTimeUpdate() {
      const dur = audio.duration || 0;
      if (dur > 0) setPlayhead(audio.currentTime / dur);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleWaveformClick(event) {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const clickTime = ratio * Math.max(totalDuration, 0);

    if (addMarkerMode && canEdit && typeof addRecordingMarker === "function") {
      addRecordingMarker({ timestamp: clickTime, label: `Marker ${formatDuration(clickTime)}` });
      setAddMarkerMode(false);
    } else {
      const audio = audioRef?.current;
      if (audio && audio.src) {
        audio.currentTime = Math.max(0, Math.min(audio.duration || 0, clickTime));
        audio.play().catch(() => {});
      }
    }
  }

  function handleSeekToMarker(marker) {
    const audio = audioRef?.current;
    if (!audio || !audio.src) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, Number(marker.timestamp)));
    audio.play().catch(() => {});
  }

  const barWidth = WAVEFORM_SVG_W / WAVEFORM_NUM_BARS;

  return (
    <div className="waveform-panel">
      <div className="waveform-toolbar">
        <span className="eyebrow">Waveform</span>
        <div className="status-cluster">
          {isDecoding ? <span className="soft-copy">Dekodowanie audio...</span> : null}
          {!isDecoding && waveformBars.length === 0 && selectedRecordingAudioUrl ? (
            <span className="soft-copy">Brak danych waveform</span>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className={addMarkerMode ? "pill active" : "pill"}
              onClick={() => setAddMarkerMode((prev) => !prev)}
            >
              {addMarkerMode ? "Kliknij na waveformie..." : "+ Dodaj marker"}
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={waveformRef}
        className={`waveform-svg-container${addMarkerMode ? " waveform-add-marker-mode" : ""}`}
        onClick={handleWaveformClick}
        role="presentation"
        aria-label="Waveform nagrania — kliknij aby przewinac audio"
      >
        <svg
          viewBox={`0 0 ${WAVEFORM_SVG_W} ${WAVEFORM_SVG_H}`}
          width="100%"
          height={WAVEFORM_SVG_H}
          preserveAspectRatio="none"
        >
          <rect x="0" y="0" width={WAVEFORM_SVG_W} height={WAVEFORM_SVG_H} fill="var(--surface-2, #12121f)" rx="4" />
          {waveformBars.map((bar, index) => {
            const barH = Math.max(2, bar * (WAVEFORM_SVG_H - 8));
            const y = (WAVEFORM_SVG_H - barH) / 2;
            const barTime = totalDuration > 0 ? (index / WAVEFORM_NUM_BARS) * totalDuration : -1;
            const seg = barTime >= 0 && Array.isArray(transcript)
              ? transcript.find((s) => s.timestamp <= barTime && s.endTimestamp > barTime)
              : null;
            const barColor = seg ? getSpeakerColor(seg.speakerId) : "var(--accent, #6366f1)";
            return (
              <rect
                key={index}
                x={index * barWidth + 0.5}
                y={y}
                width={Math.max(1, barWidth - 1)}
                height={barH}
                fill={barColor}
                opacity="0.8"
                rx="1"
              />
            );
          })}
          {playhead > 0 ? (
            <line
              x1={playhead * WAVEFORM_SVG_W}
              y1="0"
              x2={playhead * WAVEFORM_SVG_W}
              y2={WAVEFORM_SVG_H}
              stroke="var(--primary, #818cf8)"
              strokeWidth="2"
            />
          ) : null}
          {totalDuration > 0
            ? markers.map((marker) => {
                const x = (Number(marker.timestamp) / totalDuration) * WAVEFORM_SVG_W;
                return (
                  <g key={marker.id}>
                    <line x1={x} y1="0" x2={x} y2={WAVEFORM_SVG_H} stroke="#f59e0b" strokeWidth="2" />
                    <circle cx={x} cy={6} r={5} fill="#f59e0b" />
                  </g>
                );
              })
            : null}
        </svg>
      </div>

      {/* Speaker timeline bar */}
      {Array.isArray(transcript) && transcript.length > 0 && totalDuration > 0 ? (
        <div className="speaker-timeline-wrap">
          <svg
            className="speaker-timeline-svg"
            viewBox={`0 0 ${WAVEFORM_SVG_W} 12`}
            width="100%"
            height={12}
            preserveAspectRatio="none"
            onClick={handleWaveformClick}
            role="presentation"
            aria-label="Pasek mówców"
          >
            {transcript.map((seg) => {
              const x = (seg.timestamp / totalDuration) * WAVEFORM_SVG_W;
              const w = totalDuration > 0 
                ? Math.max(1, ((seg.endTimestamp - seg.timestamp) / totalDuration) * WAVEFORM_SVG_W)
                : 1;
              return (
                <rect
                  key={seg.id}
                  x={x}
                  y={0}
                  width={w}
                  height={12}
                  fill={getSpeakerColor(seg.speakerId)}
                  opacity={0.9}
                >
                  <title>{`${labelSpeaker(displaySpeakerNames, seg.speakerId)} — ${formatDuration(seg.timestamp)}–${formatDuration(seg.endTimestamp)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="speaker-legend">
            {[...new Map(transcript.map((s) => [String(s.speakerId), s])).values()].map((s) => (
              <span key={s.speakerId} className="speaker-legend-chip">
                <span
                  className="speaker-legend-dot"
                  style={{ background: getSpeakerColor(s.speakerId) }}
                />
                {labelSpeaker(displaySpeakerNames, s.speakerId)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {markers.length > 0 ? (
        <div className="waveform-markers-list">
          {markers.map((marker) => (
            <div key={marker.id} className="waveform-marker-item">
              <button
                type="button"
                className="ghost-button small"
                onClick={() => handleSeekToMarker(marker)}
                disabled={!selectedRecordingAudioUrl}
              >
                ▶ {formatDuration(Number(marker.timestamp))}
              </button>
              <span className="marker-label">{marker.label}</span>
              {marker.note ? <span className="soft-copy marker-note">{marker.note}</span> : null}
              {canEdit && typeof deleteRecordingMarker === "function" ? (
                <button
                  type="button"
                  className="ghost-button small"
                  onClick={() => deleteRecordingMarker(marker.id)}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSpeakerOptions(transcript, displaySpeakerNames) {
  const speakerIds = [...new Set((Array.isArray(transcript) ? transcript : []).map((segment) => String(segment.speakerId)))];
  return speakerIds.map((speakerId) => ({
    id: speakerId,
    label: labelSpeaker(displaySpeakerNames, speakerId),
  }));
}

function areSelectionsContiguous(transcript, selectedSegmentIds) {
  const selectedIds = new Set((Array.isArray(selectedSegmentIds) ? selectedSegmentIds : []).map(String));
  if (selectedIds.size < 2) {
    return false;
  }

  const selectedIndexes = (Array.isArray(transcript) ? transcript : [])
    .map((segment, index) => (selectedIds.has(segment.id) ? index : -1))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);

  if (!selectedIndexes.length) {
    return false;
  }

  return selectedIndexes.every((index, position) => index === selectedIndexes[0] + position);
}

function getSegmentEnd(segment, transcript, index, totalDuration) {
  const explicitEnd = Number(segment?.endTimestamp);
  if (Number.isFinite(explicitEnd) && explicitEnd > Number(segment?.timestamp || 0)) {
    return explicitEnd;
  }

  const nextStart = Number(transcript[index + 1]?.timestamp);
  if (Number.isFinite(nextStart) && nextStart > Number(segment?.timestamp || 0)) {
    return nextStart;
  }

  return Math.max(Number(segment?.timestamp || 0) + 2, totalDuration || 0);
}

export default function TranscriptPanel({
  displayRecording,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  selectedRecordingAudioError,
  audioRef,   // ← new prop
  updateTranscriptSegment,
  assignSpeakerToTranscriptSegments,
  mergeTranscriptSegments,
  splitTranscriptSegment,
  addRecordingMarker,
  deleteRecordingMarker,
  canEditTranscript = true,
  onNormalize,
}) {
  const activeReviewItemRef = useRef(null);
  const [filterMode, setFilterMode] = useState("all");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState("");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState([]);
  const [bulkSpeakerId, setBulkSpeakerId] = useState("");
  const [splitCursor, setSplitCursor] = useState({ segmentId: "", start: 0 });

  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normalizeError, setNormalizeError] = useState("");

  const transcript = useMemo(
    () => (Array.isArray(displayRecording?.transcript) ? displayRecording.transcript : []),
    [displayRecording?.transcript]
  );
  const speakerOptions = useMemo(
    () => normalizeSpeakerOptions(transcript, displaySpeakerNames),
    [displaySpeakerNames, transcript]
  );
  const filteredSegments = useMemo(() => {
    return transcript.filter((segment) => {
      if (filterMode === "review" && segment.verificationStatus !== "review") {
        return false;
      }

      if (filterMode === "verified" && segment.verificationStatus === "review") {
        return false;
      }

      if (speakerFilter !== "all" && String(segment.speakerId) !== String(speakerFilter)) {
        return false;
      }

      if (lowConfidenceOnly && Number(segment.verificationScore || 0) >= 0.6) {
        return false;
      }

      return true;
    });
  }, [filterMode, lowConfidenceOnly, speakerFilter, transcript]);
  const reviewSegments = useMemo(
    () => filteredSegments.filter((segment) => segment.verificationStatus === "review"),
    [filteredSegments]
  );
  const totalDuration = useMemo(() => {
    if (!transcript.length) {
      return 0;
    }

    return transcript.reduce((maxDuration, segment, index) => {
      return Math.max(maxDuration, getSegmentEnd(segment, transcript, index, 0));
    }, 0);
  }, [transcript]);
  const [rangeSelection, setRangeSelection] = useState({ start: 0, end: 0 });
  const timelineSegments = useMemo(
    () =>
      transcript.map((segment, index) => {
        const start = Math.max(0, Number(segment.timestamp || 0));
        const end = Math.max(start + 0.3, getSegmentEnd(segment, transcript, index, totalDuration));
        const safeDuration = Math.max(totalDuration, end, 1);
        return {
          ...segment,
          timelineStart: start,
          timelineEnd: end,
          left: `${(start / safeDuration) * 100}%`,
          width: `${Math.max(((end - start) / safeDuration) * 100, 3)}%`,
        };
      }),
    [totalDuration, transcript]
  );
  const normalizedRangeSelection = useMemo(() => {
    const start = Math.max(0, Math.min(Number(rangeSelection.start || 0), Number(rangeSelection.end || 0)));
    const end = Math.max(Number(rangeSelection.start || 0), Number(rangeSelection.end || 0));
    return {
      start,
      end: Math.min(Math.max(end, start), totalDuration || end),
    };
  }, [rangeSelection.end, rangeSelection.start, totalDuration]);
  const rangeSelectedSegments = useMemo(
    () =>
      timelineSegments.filter(
        (segment) =>
          segment.timelineEnd > normalizedRangeSelection.start &&
          segment.timelineStart < normalizedRangeSelection.end
      ),
    [normalizedRangeSelection.end, normalizedRangeSelection.start, timelineSegments]
  );
  const activeSegment =
    transcript.find((segment) => segment.id === activeSegmentId) ||
    filteredSegments[0] ||
    reviewSegments[0] ||
    null;

  const selectedCount = selectedSegmentIds.length;
  const canMergeSelection = areSelectionsContiguous(transcript, selectedSegmentIds);

  useEffect(() => {
    if (!totalDuration) {
      setRangeSelection({ start: 0, end: 0 });
      return;
    }

    setRangeSelection((previous) => {
      const nextEnd = previous.end ? Math.min(previous.end, totalDuration) : totalDuration;
      const nextStart = Math.min(previous.start, nextEnd);
      if (nextStart === previous.start && nextEnd === previous.end) {
        return previous;
      }

      return {
        start: nextStart,
        end: nextEnd,
      };
    });
  }, [totalDuration]);

  useEffect(() => {
    if (!filteredSegments.length) {
      setActiveSegmentId("");
      return;
    }

    if (!filteredSegments.some((segment) => segment.id === activeSegmentId)) {
      setActiveSegmentId(filteredSegments[0].id);
    }
  }, [activeSegmentId, filteredSegments]);

  useEffect(() => {
    if (!selectedSegmentIds.length) {
      return;
    }

    const visibleIds = new Set(transcript.map((segment) => segment.id));
    const nextSelection = selectedSegmentIds.filter((segmentId) => visibleIds.has(segmentId));
    if (nextSelection.length !== selectedSegmentIds.length) {
      setSelectedSegmentIds(nextSelection);
    }
  }, [selectedSegmentIds, transcript]);

  useEffect(() => {
    if (!speakerOptions.length) {
      setBulkSpeakerId("");
      return;
    }

    if (!speakerOptions.some((option) => option.id === bulkSpeakerId)) {
      setBulkSpeakerId(speakerOptions[0].id);
    }
  }, [bulkSpeakerId, speakerOptions]);

  useEffect(() => {
    if (!activeReviewItemRef.current) return;
    activeReviewItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeSegmentId]);

  useEffect(() => {
    function handleKeyDown(event) {
      const tag = (event.target?.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag) || event.target?.isContentEditable) return;

      const key = event.key;

      if (key === "]" || key === "ArrowRight") {
        event.preventDefault();
        const idx = reviewSegments.findIndex((s) => s.id === activeSegmentId);
        const next = reviewSegments[idx + 1] || reviewSegments[0];
        if (next) {
          setActiveSegmentId(next.id);
          playFromTimestamp(next.timestamp);
        }
        return;
      }

      if (key === "[" || key === "ArrowLeft") {
        event.preventDefault();
        const idx = reviewSegments.findIndex((s) => s.id === activeSegmentId);
        const prev = reviewSegments[idx > 0 ? idx - 1 : reviewSegments.length - 1];
        if (prev) {
          setActiveSegmentId(prev.id);
          playFromTimestamp(prev.timestamp);
        }
        return;
      }

      if (key === "a" && canEditTranscript) {
        const seg = reviewSegments.find((s) => s.id === activeSegmentId);
        if (seg) {
          updateTranscriptSegment(seg.id, { verificationStatus: "verified", verificationReasons: [] });
          const idx = reviewSegments.findIndex((s) => s.id === activeSegmentId);
          const next = reviewSegments[idx + 1] || reviewSegments[0];
          if (next && next.id !== seg.id) {
            setActiveSegmentId(next.id);
            playFromTimestamp(next.timestamp);
          }
        }
        return;
      }

      if (key === "s" && canEditTranscript) {
        const seg = reviewSegments.find((s) => s.id === activeSegmentId);
        if (seg) {
          updateTranscriptSegment(seg.id, {
            verificationStatus: "review",
            verificationReasons: seg.verificationReasons?.length ? seg.verificationReasons : ["oznaczone recznie do ponownego sprawdzenia"],
          });
          const idx = reviewSegments.findIndex((s) => s.id === activeSegmentId);
          const next = reviewSegments[idx + 1] || reviewSegments[0];
          if (next) {
            setActiveSegmentId(next.id);
            playFromTimestamp(next.timestamp);
          }
        }
        return;
      }

      if (key === " ") {
        event.preventDefault();
        const audio = audioRef.current;
        if (audio) {
          if (audio.paused) audio.play().catch(() => {});
          else audio.pause();
        }
        return;
      }

      if (key === "p") {
        const seg = reviewSegments.find((s) => s.id === activeSegmentId) || filteredSegments.find((s) => s.id === activeSegmentId);
        if (seg) playFromTimestamp(seg.timestamp);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSegmentId, canEditTranscript, filteredSegments, reviewSegments, updateTranscriptSegment]);

  function toggleSegmentSelection(segmentId) {
    setSelectedSegmentIds((previous) =>
      previous.includes(segmentId)
        ? previous.filter((value) => value !== segmentId)
        : [...previous, segmentId]
    );
    setActiveSegmentId(segmentId);
  }

  function playFromTimestamp(timestamp) {
    if (!audioRef.current) {
      return;
    }

    try {
      audioRef.current.currentTime = Math.max(0, Number(timestamp || 0));
      const playPromise = audioRef.current.play?.();
      if (playPromise?.catch) {
        playPromise.catch(() => undefined);
      }
    } catch (error) {
      console.error("Audio seek failed.", error);
    }
  }

  function activateSegment(segment) {
    if (!segment) {
      return;
    }

    setActiveSegmentId(segment.id);
    playFromTimestamp(segment.timestamp);
  }

  function handleMergeSelection() {
    if (!canMergeSelection || typeof mergeTranscriptSegments !== "function") {
      return;
    }

    mergeTranscriptSegments(selectedSegmentIds);
    setSelectedSegmentIds([]);
  }

  function handleApplySpeakerRange() {
    if (!selectedCount || !bulkSpeakerId || typeof assignSpeakerToTranscriptSegments !== "function") {
      return;
    }

    assignSpeakerToTranscriptSegments(selectedSegmentIds, Number(bulkSpeakerId));
  }

  function handleApplySpeakerToAudioRange() {
    if (!rangeSelectedSegments.length || !bulkSpeakerId || typeof assignSpeakerToTranscriptSegments !== "function") {
      return;
    }

    const nextSegmentIds = rangeSelectedSegments.map((segment) => segment.id);
    setSelectedSegmentIds(nextSegmentIds);
    assignSpeakerToTranscriptSegments(nextSegmentIds, Number(bulkSpeakerId));
  }

  function handleSplitActiveSegment() {
    if (!activeSegment || typeof splitTranscriptSegment !== "function") {
      return;
    }

    const fallbackIndex = Math.floor(String(activeSegment.text || "").length / 2);
    const splitIndex =
      splitCursor.segmentId === activeSegment.id
        ? clamp(Number(splitCursor.start || fallbackIndex), 1, Math.max(String(activeSegment.text || "").length - 1, 1))
        : fallbackIndex;

    splitTranscriptSegment(activeSegment.id, splitIndex);
  }

  return (
    <section className="panel transcript-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Transcript</div>
          <h2>{displayRecording ? "Kto co powiedzial" : "Brak nagrania"}</h2>
        </div>
        {selectedRecording ? (
          <div className="status-cluster">
            <span className="status-chip">{selectedRecording.speakerCount || 0} speakerow</span>
            <span className="status-chip">
              {Math.round((selectedRecording.diarizationConfidence || 0) * 100)}% confidence
            </span>
            {selectedRecording.transcriptionProviderLabel ? (
              <span className="status-chip">{selectedRecording.transcriptionProviderLabel}</span>
            ) : null}
            {selectedRecording.pipelineStatus ? (
              <span className="status-chip">{selectedRecording.pipelineStatus}</span>
            ) : null}
            {selectedRecording.reviewSummary?.needsReview ? (
              <span className="status-chip">
                {selectedRecording.reviewSummary.needsReview} fragmentow do sprawdzenia
              </span>
            ) : null}
            {onNormalize && selectedRecordingAudioUrl ? (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: "0.72rem" }}
                disabled={isNormalizing}
                onClick={async () => {
                  setIsNormalizing(true);
                  setNormalizeError("");
                  try {
                    await onNormalize(selectedRecording.id);
                  } catch (err) {
                    setNormalizeError(err.message || "Błąd normalizacji.");
                  } finally {
                    setIsNormalizing(false);
                  }
                }}
              >
                {isNormalizing ? "Normalizuję…" : "Normalizuj głośność"}
              </button>
            ) : null}
          </div>
        ) : null}
        {normalizeError ? (
          <div className="inline-alert error" style={{ margin: "4px 0 0" }}>{normalizeError}</div>
        ) : null}
      </div>

      {selectedRecording ? (
        <>
          <section className="transcript-timeline-panel">
            <WaveformPanel
              selectedRecording={selectedRecording}
              selectedRecordingAudioUrl={selectedRecordingAudioUrl}
              audioRef={audioRef}
              totalDuration={totalDuration}
              addRecordingMarker={addRecordingMarker}
              deleteRecordingMarker={deleteRecordingMarker}
              canEdit={canEditTranscript}
              transcript={transcript}
              displaySpeakerNames={displaySpeakerNames}
            />

            <div className="transcript-timeline-header">
              <div>
                <div className="eyebrow">Timeline review</div>
                <h3>Segmenty po czasie</h3>
              </div>
              <div className="status-cluster">
                <span className="status-chip">Zakres: {formatDuration(normalizedRangeSelection.start)} - {formatDuration(normalizedRangeSelection.end)}</span>
                <span className="status-chip">{rangeSelectedSegments.length} segmentow w zakresie</span>
              </div>
            </div>

            <div className="transcript-timeline-ruler" aria-label="Transcript timeline">
              <div
                className="transcript-range-highlight"
                style={{
                  left: `${((normalizedRangeSelection.start || 0) / Math.max(totalDuration || 1, 1)) * 100}%`,
                  width: `${(Math.max(normalizedRangeSelection.end - normalizedRangeSelection.start, 0) / Math.max(totalDuration || 1, 1)) * 100}%`,
                }}
              />
              {timelineSegments.map((segment) => (
                <button
                  type="button"
                  key={segment.id}
                  className={
                    segment.id === activeSegmentId
                      ? "timeline-segment active"
                      : segment.verificationStatus === "review"
                        ? "timeline-segment review"
                        : "timeline-segment"
                  }
                  style={{
                    left: segment.left,
                    width: segment.width,
                    background: getSpeakerColor(segment.speakerId),
                  }}
                  onClick={() => activateSegment(segment)}
                  aria-label={`Segment ${labelSpeaker(displaySpeakerNames, segment.speakerId)} ${formatDuration(segment.timestamp)}`}
                >
                  <span className="timeline-wave" />
                </button>
              ))}
            </div>

            <div className="transcript-range-editor">
              <label>
                <span>Poczatek zakresu</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(totalDuration, 1)}
                  step="0.5"
                  value={Math.min(normalizedRangeSelection.start, totalDuration)}
                  onChange={(event) =>
                    setRangeSelection((previous) => ({
                      ...previous,
                      start: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>Koniec zakresu</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(totalDuration, 1)}
                  step="0.5"
                  value={Math.min(normalizedRangeSelection.end || totalDuration, totalDuration)}
                  onChange={(event) =>
                    setRangeSelection((previous) => ({
                      ...previous,
                      end: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="transcript-range-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleApplySpeakerToAudioRange}
                  disabled={!rangeSelectedSegments.length || !bulkSpeakerId || !canEditTranscript}
                >
                  Przypisz speakera dla zakresu audio
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => activateSegment(rangeSelectedSegments[0] || activeSegment)}
                  disabled={!selectedRecordingAudioUrl || !rangeSelectedSegments.length}
                >
                  Odtworz od poczatku zakresu
                </button>
              </div>
            </div>
          </section>

          <section className="transcript-toolbar">
            <div className="review-filter-group">
              <button
                type="button"
                className={filterMode === "all" ? "pill active" : "pill"}
                onClick={() => setFilterMode("all")}
              >
                Wszystkie
              </button>
              <button
                type="button"
                className={filterMode === "review" ? "pill active" : "pill"}
                onClick={() => setFilterMode("review")}
              >
                Do review
              </button>
              <button
                type="button"
                className={filterMode === "verified" ? "pill active" : "pill"}
                onClick={() => setFilterMode("verified")}
              >
                Zweryfikowane
              </button>
            </div>

            <div className="transcript-advanced-filters">
              <label>
                <span>Speaker</span>
                <select value={speakerFilter} onChange={(event) => setSpeakerFilter(event.target.value)}>
                  <option value="all">Wszyscy</option>
                  {speakerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={lowConfidenceOnly ? "pill active" : "pill"}
                onClick={() => setLowConfidenceOnly((previous) => !previous)}
              >
                confidence {"<"} 60%
              </button>
            </div>
          </section>

          <section className="transcript-bulk-toolbar">
            <div className="transcript-selection-copy">
              <strong>{selectedCount} zaznaczonych</strong>
              <span>
                {canMergeSelection || selectedCount < 2
                  ? "Mozesz laczyc sasiednie segmenty i zmieniac speakera dla calego zakresu."
                  : "Laczyc mozna tylko segmenty stojace obok siebie w transkrypcji."}
              </span>
            </div>
            <div className="transcript-bulk-actions">
              <label>
                <span>Speaker dla zakresu</span>
                <select value={bulkSpeakerId} onChange={(event) => setBulkSpeakerId(event.target.value)}>
                  {speakerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                onClick={handleApplySpeakerRange}
                disabled={!selectedCount || !bulkSpeakerId || !canEditTranscript}
              >
                Zmien speakera zaznaczonych
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleMergeSelection}
                disabled={!canMergeSelection || !canEditTranscript}
              >
                Polacz zaznaczone
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleSplitActiveSegment}
                disabled={!activeSegment || String(activeSegment.text || "").length < 2 || !canEditTranscript}
              >
                Podziel aktywny segment
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => activeSegment && playFromTimestamp(activeSegment.timestamp)}
                disabled={!selectedRecordingAudioUrl || !activeSegment}
              >
                Odtworz od aktywnego
              </button>
              <button type="button" className="ghost-button" onClick={() => setSelectedSegmentIds([])} disabled={!selectedCount}>
                Wyczysc zaznaczenie
              </button>
            </div>
          </section>
        </>
      ) : null}


      <div className="ff-transcript-wrapper">
        <div className="ff-sticky-header">
          <div className="ff-tabs">
            <button className="ff-tab active" type="button">Transcript</button>
            <button className="ff-tab askfred" type="button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8Zm-3-9a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 9 11Zm6 0a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 15 11Zm-3 5.5a4.48 4.48 0 0 1-3.64-1.92l1.64-1.16A2.47 2.47 0 0 0 12 14.5a2.47 2.47 0 0 0 2-1.08l1.64 1.16A4.48 4.48 0 0 1 12 16.5Z" /></svg>
              AskFred
            </button>
            <div className="ff-header-actions">
              <button type="button" className="icon-button" aria-label="Wyszukaj">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              </button>
              <button type="button" className="icon-button" aria-label="Edytuj">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
            </div>
          </div>
          <div className="ff-search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Find or Replace" />
          </div>
        </div>

      <div className="transcript-list">
        {filteredSegments.length ? (
          filteredSegments.map((segment) => {
            const isSelected = selectedSegmentIds.includes(segment.id);
            const isActive = segment.id === activeSegmentId;

            return (
              <div
                key={segment.id}
                className={`fireflies-segment ${isActive ? "active" : ""} ${segment.verificationStatus === "review" ? "needs-review" : ""}`}
                onClick={() => !isActive && activateSegment(segment)}
              >
                <div className="fireflies-avatar" style={{ background: getSpeakerColor(segment.speakerId) }}>
                  {labelSpeaker(displaySpeakerNames, segment.speakerId).substring(0, 1).toUpperCase()}
                </div>
                
                <div className="fireflies-content">
                  <div className="fireflies-header">
                    <strong className="fireflies-speaker">
                      {labelSpeaker(displaySpeakerNames, segment.speakerId)}
                    </strong>
                    <svg className="fireflies-chevron" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
                    <span className="fireflies-dot">·</span>
                    <button
                      type="button"
                      className="fireflies-time"
                      onClick={(e) => {
                        e.stopPropagation();
                        playFromTimestamp(segment.timestamp);
                      }}
                      disabled={!selectedRecordingAudioUrl}
                      title="Odtwórz od tego momentu"
                    >
                      {formatDuration(segment.timestamp)}
                    </button>
                    {segment.verificationStatus === "review" && (
                      <span className="task-flag review" style={{ padding: "2px 6px", fontSize: "0.7rem", borderRadius: "4px" }}>
                        Do weryfikacji
                      </span>
                    )}
                    <label className="fireflies-select" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSegmentSelection(segment.id)}
                      />
                    </label>
                  </div>

                  <div className="fireflies-text-area">
                    <textarea
                      rows="2"
                      value={segment.text}
                      onFocus={() => setActiveSegmentId(segment.id)}
                      onSelect={(event) =>
                        setSplitCursor({
                          segmentId: segment.id,
                          start: event.currentTarget.selectionStart || 0,
                        })
                      }
                      onChange={(event) => updateTranscriptSegment(segment.id, { text: event.target.value })}
                      disabled={!canEditTranscript}
                      className="fireflies-textarea"
                    />
                  </div>

                  {segment.verificationReasons?.length > 0 && (
                    <div className="microcopy">Powód: {segment.verificationReasons.join(", ")}</div>
                  )}
                  {segment.verificationEvidence?.comparisonText && (
                    <div className="microcopy">Weryfikacja: {segment.verificationEvidence.comparisonText}</div>
                  )}

                  <div className="fireflies-actions">
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTranscriptSegment(segment.id, {
                          verificationStatus: "verified",
                          verificationReasons: [],
                        });
                      }}
                      disabled={!canEditTranscript}
                    >
                      Zatwierdź
                    </button>
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTranscriptSegment(segment.id, {
                          verificationStatus: "review",
                          verificationReasons: segment.verificationReasons?.length
                            ? segment.verificationReasons
                            : ["oznaczone ręcznie do ponownego sprawdzenia"],
                        });
                      }}
                      disabled={!canEditTranscript}
                    >
                      Oznacz do sprawdzenia
                    </button>
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={(e) => {
                        e.stopPropagation();
                        playFromTimestamp(segment.timestamp);
                      }}
                      disabled={!selectedRecordingAudioUrl}
                    >
                      Odtwórz od {formatDuration(segment.timestamp)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-panel large">
            <strong>Brak transkrypcji</strong>
            <span>Uruchom nagrywanie, aby przypiac pierwsza rozmowe.</span>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

TranscriptPanel.propTypes = {
  displayRecording: PropTypes.object,
  selectedRecording: PropTypes.object,
  displaySpeakerNames: PropTypes.object,
  selectedRecordingAudioUrl: PropTypes.string,
  selectedRecordingAudioError: PropTypes.string,
  audioRef: PropTypes.object,
  updateTranscriptSegment: PropTypes.func,
  assignSpeakerToTranscriptSegments: PropTypes.func,
  mergeTranscriptSegments: PropTypes.func,
  splitTranscriptSegment: PropTypes.func,
  addRecordingMarker: PropTypes.func,
  deleteRecordingMarker: PropTypes.func,
  canEditTranscript: PropTypes.bool,
  onNormalize: PropTypes.func,
};
