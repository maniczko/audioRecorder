import { labelSpeaker } from "../lib/recording";
import { formatDuration } from "../lib/storage";

export default function TranscriptPanel({
  displayRecording,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  updateTranscriptSegment,
}) {
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
        <div className="soft-copy">Audio jest dostepne tylko w aktualnej sesji przegladarki.</div>
      ) : null}

      <div className="transcript-list">
        {displayRecording?.transcript?.length ? (
          displayRecording.transcript.map((segment) => (
            <article
              key={segment.id}
              className={segment.verificationStatus === "review" ? "segment-card needs-review" : "segment-card"}
            >
              <div className="segment-meta">
                <strong>{labelSpeaker(displaySpeakerNames, segment.speakerId)}</strong>
                <span>{formatDuration(segment.timestamp)}</span>
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
