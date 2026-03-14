import { useEffect, useMemo, useState } from "react";
import { labelSpeaker } from "../lib/recording";
import { formatDuration } from "../lib/storage";

export default function TranscriptPanel({
  displayRecording,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  updateTranscriptSegment,
}) {
  const [filterMode, setFilterMode] = useState("all");
  const [activeReviewSegmentId, setActiveReviewSegmentId] = useState("");
  const transcript = useMemo(
    () => (Array.isArray(displayRecording?.transcript) ? displayRecording.transcript : []),
    [displayRecording?.transcript]
  );
  const reviewSegments = useMemo(
    () => transcript.filter((segment) => segment.verificationStatus === "review"),
    [transcript]
  );
  const visibleSegments = useMemo(() => {
    if (filterMode === "review") {
      return reviewSegments;
    }

    if (filterMode === "verified") {
      return transcript.filter((segment) => segment.verificationStatus !== "review");
    }

    return transcript;
  }, [filterMode, reviewSegments, transcript]);

  useEffect(() => {
    if (!reviewSegments.length) {
      setActiveReviewSegmentId("");
      return;
    }

    if (!reviewSegments.some((segment) => segment.id === activeReviewSegmentId)) {
      setActiveReviewSegmentId(reviewSegments[0].id);
    }
  }, [activeReviewSegmentId, reviewSegments]);

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
        <audio className="audio-player" controls src={selectedRecordingAudioUrl}>
          <track kind="captions" />
        </audio>
      ) : selectedRecording ? (
        <div className="soft-copy">Audio nie zostalo jeszcze zhydratowane do odsluchu w tej sesji.</div>
      ) : null}

      {selectedRecording ? (
        <section className="review-queue-panel">
          <div className="review-queue-header">
            <div>
              <div className="eyebrow">Review queue</div>
              <h3>Fragmenty wymagajace potwierdzenia</h3>
            </div>
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
          </div>

          {reviewSegments.length ? (
            <div className="review-queue-grid">
              <div className="review-queue-list">
                {reviewSegments.map((segment) => (
                  <button
                    type="button"
                    key={segment.id}
                    className={segment.id === activeReviewSegmentId ? "review-queue-item active" : "review-queue-item"}
                    onClick={() => setActiveReviewSegmentId(segment.id)}
                  >
                    <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                    <span>{formatDuration(segment.timestamp)}</span>
                    <p>{segment.text}</p>
                  </button>
                ))}
              </div>

              <div className="review-queue-detail">
                {reviewSegments
                  .filter((segment) => segment.id === activeReviewSegmentId)
                  .map((segment) => (
                    <article key={segment.id} className="review-detail-card">
                      <div className="segment-meta">
                        <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                        <span>{formatDuration(segment.timestamp)}</span>
                        <span className="task-flag review">
                          {Math.round((segment.verificationScore || 0) * 100)}% confidence
                        </span>
                      </div>
                      <p>{segment.text}</p>
                      {segment.verificationReasons?.length ? (
                        <div className="microcopy">Powody: {segment.verificationReasons.join(", ")}</div>
                      ) : null}
                      {segment.verificationEvidence?.comparisonText ? (
                        <div className="review-evidence">
                          <strong>Porownanie z przebiegiem weryfikujacym</strong>
                          <p>{segment.verificationEvidence.comparisonText}</p>
                        </div>
                      ) : null}
                      <div className="button-row">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() =>
                            updateTranscriptSegment(segment.id, {
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
                            updateTranscriptSegment(segment.id, {
                              verificationStatus: "review",
                              verificationReasons:
                                segment.verificationReasons?.length
                                  ? segment.verificationReasons
                                  : ["oznaczone recznie do ponownego sprawdzenia"],
                            })
                          }
                        >
                          Zostaw w review
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ) : (
            <div className="inline-alert success">Wszystkie fragmenty zostaly automatycznie oznaczone jako pewne.</div>
          )}
        </section>
      ) : null}

      <div className="transcript-list">
        {visibleSegments.length ? (
          visibleSegments.map((segment) => (
            <article
              key={segment.id}
              className={
                segment.verificationStatus === "review"
                  ? segment.id === activeReviewSegmentId
                    ? "segment-card needs-review active-review"
                    : "segment-card needs-review"
                  : "segment-card"
              }
            >
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
              <textarea
                rows="2"
                value={segment.text}
                onChange={(event) => updateTranscriptSegment(segment.id, { text: event.target.value })}
              />
              {segment.verificationReasons?.length ? (
                <div className="microcopy">Powod: {segment.verificationReasons.join(", ")}</div>
              ) : null}
              {segment.verificationEvidence?.comparisonText ? (
                <div className="microcopy">
                  Weryfikacja: {segment.verificationEvidence.comparisonText}
                </div>
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
              </div>
            </article>
          ))
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
