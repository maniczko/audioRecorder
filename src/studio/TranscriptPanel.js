import { useEffect, useMemo, useRef, useState } from "react";
import { labelSpeaker } from "../lib/recording";
import { formatDuration } from "../lib/storage";

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

export default function TranscriptPanel({
  displayRecording,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  updateTranscriptSegment,
  assignSpeakerToTranscriptSegments,
  mergeTranscriptSegments,
  splitTranscriptSegment,
}) {
  const audioRef = useRef(null);
  const [filterMode, setFilterMode] = useState("all");
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState("");
  const [selectedSegmentIds, setSelectedSegmentIds] = useState([]);
  const [bulkSpeakerId, setBulkSpeakerId] = useState("");
  const [splitCursor, setSplitCursor] = useState({ segmentId: "", start: 0 });

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
  const activeSegment =
    transcript.find((segment) => segment.id === activeSegmentId) ||
    filteredSegments[0] ||
    reviewSegments[0] ||
    null;
  const activeReviewSegment =
    reviewSegments.find((segment) => segment.id === activeSegmentId) || reviewSegments[0] || null;
  const selectedCount = selectedSegmentIds.length;
  const canMergeSelection = areSelectionsContiguous(transcript, selectedSegmentIds);

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
          </div>
        ) : null}
      </div>

      {selectedRecordingAudioUrl ? (
        <audio ref={audioRef} className="audio-player" controls src={selectedRecordingAudioUrl}>
          <track kind="captions" />
        </audio>
      ) : selectedRecording ? (
        <div className="soft-copy">Audio nie zostalo jeszcze zhydratowane do odsluchu w tej sesji.</div>
      ) : null}

      {selectedRecording ? (
        <>
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
                disabled={!selectedCount || !bulkSpeakerId}
              >
                Zmien speakera zaznaczonych
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleMergeSelection}
                disabled={!canMergeSelection}
              >
                Polacz zaznaczone
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleSplitActiveSegment}
                disabled={!activeSegment || String(activeSegment.text || "").length < 2}
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

      {selectedRecording ? (
        <section className="review-queue-panel">
          <div className="review-queue-header">
            <div>
              <div className="eyebrow">Review queue</div>
              <h3>Fragmenty wymagajace potwierdzenia</h3>
            </div>
          </div>

          {reviewSegments.length ? (
            <div className="review-queue-grid">
              <div className="review-queue-list">
                {reviewSegments.map((segment) => (
                  <button
                    type="button"
                    key={segment.id}
                    className={segment.id === activeReviewSegment?.id ? "review-queue-item active" : "review-queue-item"}
                    onClick={() => setActiveSegmentId(segment.id)}
                  >
                    <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                    <span>{formatDuration(segment.timestamp)}</span>
                    <p>{segment.text}</p>
                  </button>
                ))}
              </div>

              <div className="review-queue-detail">
                {activeReviewSegment ? (
                  <article className="review-detail-card">
                    <div className="segment-meta">
                      <strong>{labelSpeaker(displaySpeakerNames, activeReviewSegment.speakerId)}</strong>
                      <span>{formatDuration(activeReviewSegment.timestamp)}</span>
                      <span className="task-flag review">
                        {Math.round((activeReviewSegment.verificationScore || 0) * 100)}% confidence
                      </span>
                    </div>
                    <p>{activeReviewSegment.text}</p>
                    {activeReviewSegment.verificationReasons?.length ? (
                      <div className="microcopy">Powody: {activeReviewSegment.verificationReasons.join(", ")}</div>
                    ) : null}
                    {activeReviewSegment.verificationEvidence?.comparisonText ? (
                      <div className="review-evidence">
                        <strong>Porownanie z przebiegiem weryfikujacym</strong>
                        <p>{activeReviewSegment.verificationEvidence.comparisonText}</p>
                      </div>
                    ) : null}
                    <div className="button-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          updateTranscriptSegment(activeReviewSegment.id, {
                            verificationStatus: "verified",
                            verificationReasons: [],
                          })
                        }
                      >
                        Potwierdz fragment
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          updateTranscriptSegment(activeReviewSegment.id, {
                            verificationStatus: "review",
                            verificationReasons:
                              activeReviewSegment.verificationReasons?.length
                                ? activeReviewSegment.verificationReasons
                                : ["oznaczone recznie do ponownego sprawdzenia"],
                          })
                        }
                      >
                        Zostaw w review
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => playFromTimestamp(activeReviewSegment.timestamp)}
                        disabled={!selectedRecordingAudioUrl}
                      >
                        Odtworz od {formatDuration(activeReviewSegment.timestamp)}
                      </button>
                    </div>
                  </article>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="inline-alert success">Po obecnych filtrach nie ma fragmentow wymagajacych review.</div>
          )}
        </section>
      ) : null}

      <div className="transcript-list">
        {filteredSegments.length ? (
          filteredSegments.map((segment) => {
            const isSelected = selectedSegmentIds.includes(segment.id);
            const isActive = segment.id === activeSegmentId;

            return (
              <article
                key={segment.id}
                className={
                  segment.verificationStatus === "review"
                    ? isActive
                      ? "segment-card needs-review active-review"
                      : "segment-card needs-review"
                    : isActive
                      ? "segment-card active-review"
                      : "segment-card"
                }
              >
                <div className="segment-card-top">
                  <label className="segment-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSegmentSelection(segment.id)}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span>Zaznacz</span>
                  </label>
                  <div className="segment-meta">
                    <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                    <span>{formatDuration(segment.timestamp)}</span>
                    <span>{Math.round((segment.verificationScore || 0) * 100)}%</span>
                    <span
                      className={segment.verificationStatus === "review" ? "task-flag review" : "task-flag success"}
                    >
                      {segment.verificationStatus === "review" ? "Do weryfikacji" : "Zweryfikowane"}
                    </span>
                  </div>
                </div>
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
                />
                {segment.verificationReasons?.length ? (
                  <div className="microcopy">Powod: {segment.verificationReasons.join(", ")}</div>
                ) : null}
                {segment.verificationEvidence?.comparisonText ? (
                  <div className="microcopy">Weryfikacja: {segment.verificationEvidence.comparisonText}</div>
                ) : null}
                <div className="button-row">
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() =>
                      updateTranscriptSegment(segment.id, {
                        verificationStatus: "verified",
                        verificationReasons: [],
                      })
                    }
                  >
                    Zatwierdz
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() =>
                      updateTranscriptSegment(segment.id, {
                        verificationStatus: "review",
                        verificationReasons:
                          segment.verificationReasons?.length
                            ? segment.verificationReasons
                            : ["oznaczone recznie do ponownego sprawdzenia"],
                      })
                    }
                  >
                    Oznacz do sprawdzenia
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => playFromTimestamp(segment.timestamp)}
                    disabled={!selectedRecordingAudioUrl}
                  >
                    Odtworz od {formatDuration(segment.timestamp)}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty-panel large">
            <strong>Brak transkrypcji</strong>
            <span>Uruchom nagrywanie, aby przypiac pierwsza rozmowe.</span>
          </div>
        )}
      </div>
    </section>
  );
}
