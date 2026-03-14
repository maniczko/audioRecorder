import { buildGoogleCalendarUrl, downloadMeetingIcs } from "./lib/calendar";
import { createEmptyMeetingDraft } from "./lib/meeting";
import { labelSpeaker } from "./lib/recording";
import { formatDateTime, formatDuration } from "./lib/storage";

export default function StudioTab({
  currentUser,
  currentWorkspace,
  currentWorkspaceMembers,
  setActiveTab,
  meetingDraft,
  setMeetingDraft,
  saveMeeting,
  workspaceMessage,
  userMeetings,
  selectedMeetingId,
  selectMeeting,
  selectedMeeting,
  displayRecording,
  studioAnalysis,
  isRecording,
  analysisStatus,
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  recordingMessage,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  updateTranscriptSegment,
  renameSpeaker,
  selectedRecordingId,
  setSelectedRecordingId,
  exportTranscript,
  exportMeetingNotes,
  exportMeetingPdfFile,
  setSelectedMeetingId,
}) {
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Workspace</div>
              <h2>{currentWorkspace?.name || "Workspace owner"}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setActiveTab("profile")}>
              Otworz profil
            </button>
          </div>

          <div className="workspace-owner-card">
            <div className="user-card">
              {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} alt={currentUser.name} className="avatar" /> : null}
              <div>
                <strong>{currentUser.name}</strong>
                <span>
                  {currentUser.role || "Brak roli"}
                  {currentUser.company ? ` | ${currentUser.company}` : ""}
                </span>
              </div>
            </div>

            <div className="profile-quick-grid">
              <div className="task-detail-chip">
                <span>Email</span>
                <strong>{currentUser.email}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Kod dostepu</span>
                <strong>{currentWorkspace?.inviteCode || "Brak"}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Czlonkowie</span>
                <strong>{currentWorkspaceMembers.length}</strong>
              </div>
            </div>
            <div className="workspace-member-list">
              {currentWorkspaceMembers.map((member) => (
                <span key={member.id} className="task-tag-chip neutral">
                  {member.name || member.email}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Meeting brief</div>
              <h2>{selectedMeeting ? "Edytuj spotkanie" : "Nowe spotkanie"}</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setSelectedMeetingId(null);
                setSelectedRecordingId(null);
                setMeetingDraft(createEmptyMeetingDraft());
              }}
            >
              Nowe
            </button>
          </div>

          <div className="stack-form">
            <label>
              <span>Tytul</span>
              <input
                value={meetingDraft.title}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))}
              />
            </label>
            <label>
              <span>Kontekst</span>
              <textarea
                rows="3"
                value={meetingDraft.context}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))}
              />
            </label>
            <label>
              <span>Termin</span>
              <input
                type="datetime-local"
                value={meetingDraft.startsAt}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))}
              />
            </label>
            <label>
              <span>Czas (min)</span>
              <input
                type="number"
                min="15"
                step="15"
                value={meetingDraft.durationMinutes}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, durationMinutes: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Uczestnicy</span>
              <textarea
                rows="3"
                value={meetingDraft.attendees}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, attendees: event.target.value }))}
              />
            </label>
            <label>
              <span>Tagi</span>
              <textarea
                rows="2"
                value={meetingDraft.tags}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, tags: event.target.value }))}
                placeholder={"np. klient\nbudzet\nfollow-up"}
              />
            </label>
            <label>
              <span>Moje potrzeby</span>
              <textarea
                rows="4"
                value={meetingDraft.needs}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))}
                placeholder={"np. Decyzje budzetowe\nRyzyka wdrozenia"}
              />
            </label>
            <label>
              <span>Co wyciagnac po spotkaniu</span>
              <textarea
                rows="4"
                value={meetingDraft.desiredOutputs}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, desiredOutputs: event.target.value }))
                }
                placeholder={"np. Kolejne kroki\nOwnerzy zadan"}
              />
            </label>
            <label>
              <span>Lokalizacja</span>
              <input
                value={meetingDraft.location}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))}
              />
            </label>
            <button type="button" className="primary-button" onClick={saveMeeting}>
              Zapisz spotkanie
            </button>
          </div>

          {workspaceMessage ? <div className="inline-alert success">{workspaceMessage}</div> : null}
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Meetings</div>
              <h2>Lista spotkan</h2>
            </div>
          </div>
          <div className="meeting-list">
            {userMeetings.length ? (
              userMeetings.map((meeting) => (
                <button
                  type="button"
                  key={meeting.id}
                  className={meeting.id === selectedMeetingId ? "meeting-card active" : "meeting-card"}
                  onClick={() => selectMeeting(meeting)}
                >
                  <div className="meeting-card-top">
                    <strong>{meeting.title}</strong>
                    <span>{formatDateTime(meeting.startsAt)}</span>
                  </div>
                  <p>{meeting.context || "Brak kontekstu."}</p>
                  <div className="meeting-card-meta">
                    <span>{meeting.recordings.length} nagran</span>
                    <span>{meeting.speakerCount || 0} speakerow</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak spotkan</strong>
                <span>Utworz pierwsze spotkanie powyzej albo zaloguj sie przez Google.</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <main className="workspace-main">
        {selectedMeeting ? (
          <>
            <section className="hero-panel">
              <div>
                <div className="eyebrow">Active meeting</div>
                <h2>{selectedMeeting.title}</h2>
                <p>{selectedMeeting.context || "Dodaj kontekst, aby analiza lepiej rozumiala rozmowe."}</p>
              </div>
              <div className="hero-meta">
                <div className="metric-card">
                  <span>Start</span>
                  <strong>{formatDateTime(selectedMeeting.startsAt)}</strong>
                </div>
                <div className="metric-card">
                  <span>Czas</span>
                  <strong>{selectedMeeting.durationMinutes} min</strong>
                </div>
                <div className="metric-card">
                  <span>Diarization</span>
                  <strong>{selectedMeeting.speakerCount || 0} speakerow</strong>
                </div>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => window.open(buildGoogleCalendarUrl(selectedMeeting), "_blank", "noopener,noreferrer")}
                >
                  Google Calendar
                </button>
                <button type="button" className="secondary-button" onClick={() => downloadMeetingIcs(selectedMeeting)}>
                  ICS
                </button>
                <button type="button" className="secondary-button" onClick={exportTranscript} disabled={!displayRecording}>
                  Transkrypt TXT
                </button>
                <button type="button" className="secondary-button" onClick={exportMeetingNotes}>
                  Notatki TXT
                </button>
                <button type="button" className="secondary-button" onClick={exportMeetingPdfFile}>
                  PDF
                </button>
              </div>
            </section>

            <div className="main-grid">
              <section className="panel recorder-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Recorder</div>
                    <h2>Live capture</h2>
                  </div>
                  <div className="status-cluster">
                    <span className={isRecording ? "live-pill recording" : "live-pill"}>{isRecording ? "REC" : "Idle"}</span>
                    <span className="live-pill subtle">{analysisStatus === "analyzing" ? "Analyzing" : "Ready"}</span>
                  </div>
                </div>

                <div className="recorder-body">
                  <div className="timer">{formatDuration(elapsed)}</div>
                  <div className="visualizer">
                    {visualBars.map((height, index) => (
                      <span key={`${height}-${index}`} className="bar" style={{ height: `${height}px` }} />
                    ))}
                  </div>
                  <div className="button-row align-center">
                    <button
                      type="button"
                      className={isRecording ? "danger-button" : "primary-button"}
                      onClick={isRecording ? stopRecording : () => startRecording()}
                    >
                      {isRecording ? "Stop recording" : "Start recording"}
                    </button>
                    {!isRecording ? (
                      <button type="button" className="ghost-button" onClick={() => startRecording({ adHoc: true })}>
                        Nagranie ad hoc
                      </button>
                    ) : null}
                    <div className="microcopy">
                      {recordPermission === "denied"
                        ? "Mikrofon zablokowany. Odblokuj go przy pasku adresu."
                        : speechRecognitionSupported
                          ? "Live transcript wlacza sie automatycznie."
                          : "Audio zlapiesz normalnie, ale bez live transcriptu w tej przegladarce."}
                    </div>
                  </div>
                  {liveText ? <div className="live-text">Na zywo: {liveText}</div> : null}
                  {recordingMessage ? <div className="inline-alert info">{recordingMessage}</div> : null}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">What matters</div>
                    <h2>Potrzeby i outputy</h2>
                  </div>
                </div>
                <div className="chip-list">
                  {selectedMeeting.tags?.length
                    ? selectedMeeting.tags.map((tag) => (
                        <span className="task-tag-chip neutral" key={tag}>
                          #{tag}
                        </span>
                      ))
                    : null}
                  {selectedMeeting.needs.length ? (
                    selectedMeeting.needs.map((need) => (
                      <span className="need-chip" key={need}>
                        {need}
                      </span>
                    ))
                  ) : (
                    <span className="soft-copy">Dodaj potrzeby, aby analiza odpowiadala na nie osobno.</span>
                  )}
                </div>
                <div className="brief-columns">
                  <div>
                    <h3>Desired outputs</h3>
                    <ul className="clean-list">
                      {selectedMeeting.desiredOutputs.length ? (
                        selectedMeeting.desiredOutputs.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>Brak outputow.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3>Attendees</h3>
                    <ul className="clean-list">
                      {selectedMeeting.attendees.length ? (
                        selectedMeeting.attendees.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>Brak uczestnikow.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </section>

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
                          <span className={segment.verificationStatus === "review" ? "task-flag review" : "task-flag success"}>
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

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Insights</div>
                    <h2>Analiza spotkania</h2>
                  </div>
                  <div className="status-chip">{studioAnalysis?.mode || "waiting"}</div>
                </div>

                {studioAnalysis ? (
                  <div className="analysis-stack">
                    <div className="analysis-block">
                      <h3>Summary</h3>
                      <p>{studioAnalysis.summary}</p>
                    </div>
                    <div className="analysis-columns">
                      <div className="analysis-block">
                        <h3>Decisions</h3>
                        <ul className="clean-list">
                          {studioAnalysis.decisions?.length ? (
                            studioAnalysis.decisions.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>Brak decyzji.</li>
                          )}
                        </ul>
                      </div>
                      <div className="analysis-block">
                        <h3>Action items</h3>
                        <ul className="clean-list">
                          {studioAnalysis.actionItems?.length ? (
                            studioAnalysis.actionItems.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <li>Brak action items.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                    <div className="answers-grid">
                      {studioAnalysis.answersToNeeds?.length ? (
                        studioAnalysis.answersToNeeds.map((item) => (
                          <article className="answer-card" key={`${item.need}-${item.answer}`}>
                            <strong>{item.need}</strong>
                            <p>{item.answer}</p>
                          </article>
                        ))
                      ) : (
                        <div className="soft-copy">Brak odpowiedzi do potrzeb.</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-panel large">
                    <strong>Brak analizy</strong>
                    <span>Analiza pojawi sie po zatrzymaniu nagrania.</span>
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Speaker map</div>
                    <h2>Nazwij rozmowcow</h2>
                  </div>
                </div>
                <div className="speaker-editor-list">
                  {Object.entries(displaySpeakerNames).length ? (
                    Object.entries(displaySpeakerNames).map(([key, value]) => (
                      <label key={key} className="speaker-editor-row">
                        <span>Speaker {Number(key) + 1}</span>
                        <input value={value} onChange={(event) => renameSpeaker(key, event.target.value)} />
                      </label>
                    ))
                  ) : (
                    <div className="soft-copy">Mapa speakerow pojawi sie po pierwszym nagraniu.</div>
                  )}
                </div>
              </section>

              <section className="panel recordings-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Recordings</div>
                    <h2>Historia spotkania</h2>
                  </div>
                  <div className="status-chip">{selectedMeeting.recordings.length} zapisow</div>
                </div>
                <div className="recordings-list">
                  {selectedMeeting.recordings.length ? (
                    selectedMeeting.recordings.map((recording) => (
                      <button
                        type="button"
                        key={recording.id}
                        className={recording.id === selectedRecordingId ? "recording-card active" : "recording-card"}
                        onClick={() => setSelectedRecordingId(recording.id)}
                      >
                        <div className="recording-card-top">
                          <strong>{formatDateTime(recording.createdAt)}</strong>
                          <span>{formatDuration(recording.duration)}</span>
                        </div>
                        <p>{recording.analysis?.summary || "Nagranie bez summary."}</p>
                        <div className="meeting-card-meta">
                          <span>{recording.speakerCount || 0} speakerow</span>
                          <span>{recording.transcript.length} segmentow</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-panel">
                      <strong>Brak nagran</strong>
                      <span>Pierwsze nagranie pojawi sie tutaj.</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="hero-panel empty-workspace">
            <div className="eyebrow">Workspace</div>
            <h2>Utworz pierwsze spotkanie</h2>
            <p>
              Zacznij od briefu, potem uruchom recorder i przypnij rozmowe do konkretnego spotkania albo zaplanuj
              termin w zakladce Kalendarz.
            </p>
            <div className="button-row">
              <button type="button" className="primary-button" onClick={() => startRecording({ adHoc: true })}>
                Zacznij nagranie ad hoc
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setSelectedMeetingId(null);
                  setMeetingDraft(createEmptyMeetingDraft());
                }}
              >
                Przygotuj brief
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
