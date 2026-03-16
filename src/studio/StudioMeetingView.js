import { useEffect, useRef, useState } from "react";
import { buildGoogleCalendarUrl, downloadMeetingIcs } from "../lib/calendar";
import { formatDateTime, formatDuration } from "../lib/storage";
import AiTaskSuggestionsPanel from "./AiTaskSuggestionsPanel";
import RecorderPanel from "./RecorderPanel";
import TranscriptPanel from "./TranscriptPanel";

function MeetingPicker({ selectedMeeting, userMeetings, selectMeeting, startNewMeetingDraft, selectedRecordingId, setSelectedRecordingId }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const sorted = [...userMeetings].sort(
    (a, b) => new Date(b.startsAt || b.createdAt) - new Date(a.startsAt || a.createdAt)
  );
  const filtered = query.trim()
    ? sorted.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : sorted.slice(0, 10);

  const recordings = selectedMeeting?.recordings || [];

  return (
    <div className="studio-picker-header" ref={ref}>
      <div className="studio-picker-header-top">
        <div className="studio-picker-header-info">
          <div className="eyebrow">Studio</div>
          <h2 className="studio-picker-header-title">
            {selectedMeeting ? selectedMeeting.title : "Wybierz spotkanie"}
          </h2>
          {selectedMeeting && (
            <div className="studio-picker-header-meta">
              <span>{formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt)}</span>
              <span>{selectedMeeting.durationMinutes} min</span>
              <span>{recordings.length} nagran</span>
            </div>
          )}
        </div>
        <div className="studio-picker-header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            Zmień ▾
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={startNewMeetingDraft}
          >
            + Nowe
          </button>
        </div>
        {open && (
          <div className="studio-picker-dropdown" role="listbox">
            <input
              className="studio-picker-search"
              type="search"
              placeholder="Szukaj spotkania…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="studio-picker-list">
              {filtered.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  role="option"
                  aria-selected={selectedMeeting?.id === meeting.id}
                  className={`studio-picker-item${selectedMeeting?.id === meeting.id ? " active" : ""}`}
                  onClick={() => {
                    selectMeeting(meeting);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="studio-picker-item-title">{meeting.title}</span>
                  <span className="studio-picker-item-date">
                    {formatDateTime(meeting.startsAt || meeting.createdAt)}
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="studio-picker-empty">Brak wyników</div>
              )}
            </div>
          </div>
        )}
      </div>

      {recordings.length > 0 && (
        <div className="studio-recordings-table-wrap">
          <table className="studio-recordings-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Czas</th>
                <th>Speakerzy</th>
                <th>Segmenty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recordings.map((rec) => (
                <tr
                  key={rec.id}
                  className={rec.id === selectedRecordingId ? "active" : ""}
                  onClick={() => setSelectedRecordingId(rec.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{formatDateTime(rec.createdAt)}</td>
                  <td>{formatDuration(rec.duration)}</td>
                  <td>{rec.speakerCount || 0}</td>
                  <td>{rec.transcript?.length || 0}</td>
                  <td>
                    <span className={`status-chip status-chip-sm ${rec.pipelineStatus || "done"}`}>
                      {rec.pipelineStatus || "done"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function tagStyle(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return {
    color: `hsl(${h},62%,62%)`,
    background: `hsla(${h},62%,45%,0.13)`,
    border: `1px solid hsla(${h},62%,55%,0.28)`,
  };
}

export default function StudioMeetingView({
  selectedMeeting,
  displayRecording,
  studioAnalysis,
  isRecording,
  analysisStatus,
  activeQueueItem,
  selectedMeetingQueue,
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
  retryRecordingQueueItem,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  recordingMessage,
  selectedRecording,
  displaySpeakerNames,
  selectedRecordingAudioUrl,
  updateTranscriptSegment,
  assignSpeakerToTranscriptSegments,
  mergeTranscriptSegments,
  splitTranscriptSegment,
  renameSpeaker,
  selectedRecordingId,
  setSelectedRecordingId,
  exportTranscript,
  exportMeetingNotes,
  exportMeetingPdfFile,
  startNewMeetingDraft,
  selectMeeting,
  currentWorkspacePermissions,
  currentWorkspaceRole,
  currentWorkspace,
  userMeetings,
  meetingTasks,
  addRecordingMarker,
  deleteRecordingMarker,
  onCreateTask,
  peopleProfiles,
  addMeetingComment,
  currentUserName,
  meetingDraft,
  setMeetingDraft,
  saveMeeting,
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [addNeedOpen, setAddNeedOpen] = useState(false);
  const [needDraft, setNeedDraft] = useState("");
  const [addConcernOpen, setAddConcernOpen] = useState(false);
  const [concernDraft, setConcernDraft] = useState("");

  function handleAddComment() {
    if (!commentDraft.trim() || !addMeetingComment) return;
    addMeetingComment(selectedMeeting.id, commentDraft.trim(), currentUserName || "Ty");
    setCommentDraft("");
  }

  const picker = (
    <MeetingPicker
      selectedMeeting={selectedMeeting}
      userMeetings={userMeetings}
      selectMeeting={selectMeeting}
      startNewMeetingDraft={startNewMeetingDraft}
      selectedRecordingId={selectedRecordingId}
      setSelectedRecordingId={setSelectedRecordingId}
    />
  );

  if (!selectedMeeting) {
    return (
      <>
        {picker}
        <section className="hero-panel empty-workspace">
          <div className="empty-workspace-inner">
            <div className="eyebrow">Studio</div>
            <h2>Wybierz lub utwórz spotkanie</h2>
            <p>Zacznij od briefu albo uruchom nagranie ad hoc — spotkanie zostanie utworzone automatycznie.</p>
            <div className="button-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => startRecording({ adHoc: true })}
                disabled={!currentWorkspacePermissions?.canRecordAudio}
              >
                ⬤ Nagraj ad hoc
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={startNewMeetingDraft}
                disabled={!currentWorkspacePermissions?.canEditWorkspace}
              >
                Przygotuj brief
              </button>
            </div>
          </div>
        </section>
        <RecordingsLibrary
          userMeetings={userMeetings}
          selectedRecordingId={selectedRecordingId}
          setSelectedRecordingId={setSelectedRecordingId}
          selectMeeting={selectMeeting}
        />
      </>
    );
  }

  return (
    <>
      {picker}
      <RecorderPanel
        isRecording={isRecording}
        analysisStatus={analysisStatus}
        activeQueueItem={activeQueueItem}
        selectedMeetingQueue={selectedMeetingQueue}
        elapsed={elapsed}
        visualBars={visualBars}
        stopRecording={stopRecording}
        startRecording={startRecording}
        retryRecordingQueueItem={retryRecordingQueueItem}
        recordPermission={recordPermission}
        speechRecognitionSupported={speechRecognitionSupported}
        liveText={liveText}
        recordingMessage={recordingMessage}
        canRecord={currentWorkspacePermissions?.canRecordAudio}
      />

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
            <strong>{selectedMeeting.speakerCount || 0} rozmówców</strong>
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
          <button
            type="button"
            className="secondary-button"
            onClick={exportTranscript}
            disabled={!displayRecording || !currentWorkspacePermissions?.canExportWorkspaceData}
          >
            Transkrypt TXT
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={exportMeetingNotes}
            disabled={!currentWorkspacePermissions?.canExportWorkspaceData}
          >
            Notatki TXT
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={exportMeetingPdfFile}
            disabled={!currentWorkspacePermissions?.canExportWorkspaceData}
          >
            PDF
          </button>
        </div>
      </section>


      <div className="main-grid">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Kontekst spotkania</div>
              <h2>Potrzeby i obawy</h2>
            </div>
          </div>
          {selectedMeeting.tags?.length ? (
            <div className="chip-list">
              {selectedMeeting.tags.map((tag) => (
                <span className="task-tag-chip" key={tag} style={tagStyle(tag)}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="brief-columns two-col">
            <div className="brief-col">
              <div className="brief-col-head">
                <span className="brief-col-label">Potrzeby</span>
                <button
                  type="button"
                  className="what-matters-add-btn"
                  onClick={() => setAddNeedOpen((v) => !v)}
                  title="Dodaj potrzebę"
                >
                  +
                </button>
              </div>
              {addNeedOpen && (
                <form
                  className="what-matters-add-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!needDraft.trim()) return;
                    const current = (meetingDraft?.needs || "");
                    const updated = current ? current.trim() + "\n" + needDraft.trim() : needDraft.trim();
                    const newDraft = { ...meetingDraft, needs: updated };
                    setMeetingDraft(() => newDraft);
                    setNeedDraft("");
                    setAddNeedOpen(false);
                    saveMeeting(newDraft);
                  }}
                >
                  <input
                    autoFocus
                    value={needDraft}
                    onChange={(e) => setNeedDraft(e.target.value)}
                    placeholder="np. Decyzje budzetowe"
                  />
                  <button type="submit" className="ghost-button">Dodaj</button>
                </form>
              )}
              <ul className="clean-list">
                {selectedMeeting.needs.length ? (
                  selectedMeeting.needs.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li className="soft-copy">Brak potrzeb.</li>
                )}
              </ul>
            </div>

            <div className="brief-col">
              <div className="brief-col-head">
                <span className="brief-col-label">Obawy</span>
                <button
                  type="button"
                  className="what-matters-add-btn concern"
                  onClick={() => setAddConcernOpen((v) => !v)}
                  title="Dodaj obawę"
                >
                  +
                </button>
              </div>
              {addConcernOpen && (
                <form
                  className="what-matters-add-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!concernDraft.trim()) return;
                    const current = (meetingDraft?.concerns || "");
                    const updated = current ? current.trim() + "\n" + concernDraft.trim() : concernDraft.trim();
                    const newDraft = { ...meetingDraft, concerns: updated };
                    setMeetingDraft(() => newDraft);
                    setConcernDraft("");
                    setAddConcernOpen(false);
                    saveMeeting(newDraft);
                  }}
                >
                  <input
                    autoFocus
                    value={concernDraft}
                    onChange={(e) => setConcernDraft(e.target.value)}
                    placeholder="np. Ryzyko budzetu"
                  />
                  <button type="submit" className="ghost-button">Dodaj</button>
                </form>
              )}
              <ul className="clean-list">
                {(selectedMeeting.concerns || []).length ? (
                  (selectedMeeting.concerns || []).map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li className="soft-copy">Brak obaw.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        <TranscriptPanel
          displayRecording={displayRecording}
          selectedRecording={selectedRecording}
          displaySpeakerNames={displaySpeakerNames}
          selectedRecordingAudioUrl={selectedRecordingAudioUrl}
          updateTranscriptSegment={updateTranscriptSegment}
          assignSpeakerToTranscriptSegments={assignSpeakerToTranscriptSegments}
          mergeTranscriptSegments={mergeTranscriptSegments}
          splitTranscriptSegment={splitTranscriptSegment}
          addRecordingMarker={addRecordingMarker}
          deleteRecordingMarker={deleteRecordingMarker}
          canEditTranscript={currentWorkspacePermissions?.canEditWorkspace}
        />

        <AiTaskSuggestionsPanel
          selectedRecording={selectedRecording}
          displaySpeakerNames={displaySpeakerNames}
          peopleProfiles={peopleProfiles}
          onCreateTask={onCreateTask}
          canEdit={currentWorkspacePermissions?.canEditWorkspace}
        />

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

        {studioAnalysis && (
          <>
            {(studioAnalysis.openQuestions?.length > 0 || studioAnalysis.risks?.length > 0 || studioAnalysis.blockers?.length > 0) && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Risk radar</div>
                    <h2>Ryzyka i blokery</h2>
                  </div>
                </div>
                <div className="analysis-columns">
                  {studioAnalysis.risks?.length > 0 && (
                    <div className="analysis-block">
                      <h3>Ryzyka</h3>
                      <ul className="clean-list">
                        {studioAnalysis.risks.map((r, i) => (
                          <li key={i} className="risk-item">
                            <span className={`risk-severity risk-${r.severity || "medium"}`}>{r.severity || "medium"}</span>
                            {r.risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {studioAnalysis.blockers?.length > 0 && (
                    <div className="analysis-block">
                      <h3>Blokery</h3>
                      <ul className="clean-list">
                        {studioAnalysis.blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {studioAnalysis.openQuestions?.length > 0 && (
                  <div className="analysis-block">
                    <h3>Otwarte pytania</h3>
                    <ul className="clean-list open-questions-list">
                      {studioAnalysis.openQuestions.map((q, i) => (
                        <li key={i} className="open-question-item">
                          <span className="open-question-text">{q.question}</span>
                          {q.askedBy && <span className="open-question-by">{q.askedBy}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {studioAnalysis.participantInsights?.length > 0 && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Dynamics</div>
                    <h2>Dynamika rozmowy</h2>
                  </div>
                  {studioAnalysis.energyLevel && (
                    <span className={`status-chip energy-${studioAnalysis.energyLevel}`}>
                      energia: {studioAnalysis.energyLevel}
                    </span>
                  )}
                </div>
                <div className="participant-insights-list">
                  {studioAnalysis.participantInsights.map((p, i) => (
                    <div key={i} className="participant-insight-row">
                      <div className="participant-insight-name">{p.speaker}</div>
                      <div className="participant-talk-wrap">
                        <div className="participant-talk-bar" style={{ width: `${Math.round((p.talkRatio || 0) * 100)}%` }} />
                        <span className="participant-talk-pct">{Math.round((p.talkRatio || 0) * 100)}%</span>
                      </div>
                      <span className={`participant-stance stance-${p.stance || "neutral"}`}>{p.stance || "neutral"}</span>
                      {p.mainTopic && <span className="participant-topic">{p.mainTopic}</span>}
                    </div>
                  ))}
                </div>
                {studioAnalysis.tensions?.length > 0 && (
                  <div className="analysis-block" style={{ marginTop: 14 }}>
                    <h3>Napięcia</h3>
                    <ul className="clean-list">
                      {studioAnalysis.tensions.map((t, i) => (
                        <li key={i} className="tension-item">
                          <strong>{t.topic}</strong>
                          {t.between?.length > 0 && <span className="tension-between"> — {t.between.join(" vs ")}</span>}
                          <span className={`tension-resolved ${t.resolved ? "yes" : "no"}`}>
                            {t.resolved ? "rozwiązane" : "otwarte"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {studioAnalysis.keyQuotes?.length > 0 && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Quotes</div>
                    <h2>Kluczowe cytaty</h2>
                  </div>
                </div>
                <div className="key-quotes-list">
                  {studioAnalysis.keyQuotes.map((q, i) => (
                    <article key={i} className="quote-card">
                      <blockquote>„{q.quote}"</blockquote>
                      <footer>
                        <strong>{q.speaker}</strong>
                        {q.why && <span>{q.why}</span>}
                      </footer>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {(studioAnalysis.suggestedAgenda?.length > 0 || studioAnalysis.coachingTip || studioAnalysis.terminology?.length > 0 || studioAnalysis.contextLinks?.length > 0) && (
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Next steps</div>
                    <h2>Następne spotkanie</h2>
                  </div>
                  {studioAnalysis.meetingType && studioAnalysis.meetingType !== "other" && (
                    <span className="status-chip">{studioAnalysis.meetingType}</span>
                  )}
                </div>
                {studioAnalysis.suggestedAgenda?.length > 0 && (
                  <div className="analysis-block">
                    <h3>Proponowana agenda</h3>
                    <ol className="clean-list suggested-agenda-list">
                      {studioAnalysis.suggestedAgenda.map((item, i) => <li key={i}>{item}</li>)}
                    </ol>
                  </div>
                )}
                {studioAnalysis.coachingTip && (
                  <div className="coaching-tip-box">
                    <span className="coaching-tip-icon">💡</span>
                    <p>{studioAnalysis.coachingTip}</p>
                  </div>
                )}
                {(studioAnalysis.terminology?.length > 0 || studioAnalysis.contextLinks?.length > 0) && (
                  <div className="analysis-columns">
                    {studioAnalysis.terminology?.length > 0 && (
                      <div className="analysis-block">
                        <h3>Terminologia</h3>
                        <div className="chip-list">
                          {studioAnalysis.terminology.map((t) => (
                            <span key={t} className="task-tag-chip neutral">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {studioAnalysis.contextLinks?.length > 0 && (
                      <div className="analysis-block">
                        <h3>Nawiązania</h3>
                        <ul className="clean-list">
                          {studioAnalysis.contextLinks.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}

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
            {selectedMeetingQueue.length ? (
              selectedMeetingQueue.map((item) => (
                <article key={item.recordingId} className={`recording-card pending ${item.status}`}>
                  <div className="recording-card-top">
                    <strong>{item.meetingTitle}</strong>
                    <span>{item.status}</span>
                  </div>
                  <p>
                    Status kolejki: {item.status}
                    {item.errorMessage ? ` | ${item.errorMessage}` : ""}
                  </p>
                  <div className="meeting-card-meta">
                    <span>Proba {Math.max(1, item.attempts || 0)}</span>
                    <span>{formatDuration(item.duration || 0)}</span>
                  </div>
                  {item.status === "failed" ? (
                    <div className="button-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => retryRecordingQueueItem(item.recordingId)}
                      >
                        Ponow upload
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : null}
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
                    <span>{recording.pipelineStatus || "done"}</span>
                  </div>
                </button>
              ))
            ) : !selectedMeetingQueue.length ? (
              <div className="empty-panel">
                <strong>Brak nagran</strong>
                <span>Pierwsze nagranie pojawi sie tutaj.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Discussion</div>
              <h2>Komentarze</h2>
            </div>
            <div className="status-chip">{(selectedMeeting.comments || []).length}</div>
          </div>
          <div className="meeting-comment-create">
            <textarea
              rows="3"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Dodaj komentarz... użyj @imię aby wspomnieć osobę"
              disabled={!currentWorkspacePermissions?.canEditWorkspace}
            />
            <button
              type="button"
              className="secondary-button small"
              onClick={handleAddComment}
              disabled={!commentDraft.trim()}
            >
              Dodaj
            </button>
          </div>
          <div className="meeting-comments-list">
            {(selectedMeeting.comments || []).length ? (
              [...selectedMeeting.comments].reverse().map((comment) => (
                <article key={comment.id} className="meeting-comment-card">
                  <div className="meeting-comment-meta">
                    <strong>{comment.author}</strong>
                    <small>{formatDateTime(comment.createdAt)}</small>
                  </div>
                  <p>{comment.text}</p>
                  {comment.mentions?.length > 0 && (
                    <div className="meeting-comment-mentions">
                      {comment.mentions.map((m) => (
                        <span key={m} className="mention-chip">@{m}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak komentarzy</strong>
                <span>Dodaj komentarz lub ustalenie do tego spotkania.</span>
              </div>
            )}
          </div>
        </section>
      </div>

    </>
  );
}

function RecordingsLibrary({ userMeetings, selectedRecordingId, setSelectedRecordingId, selectMeeting }) {
  const allRecordings = userMeetings.flatMap((m) =>
    (m.recordings || []).map((r) => ({ ...r, meetingId: m.id, meetingTitle: m.title }))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!allRecordings.length) return null;

  return (
    <section className="panel recordings-library">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Library</div>
          <h2>Wszystkie nagrania</h2>
        </div>
        <div className="status-chip">{allRecordings.length}</div>
      </div>
      <div className="studio-recordings-table-wrap">
        <table className="studio-recordings-table">
          <thead>
            <tr>
              <th>Spotkanie</th>
              <th>Data</th>
              <th>Czas</th>
              <th>Speakerzy</th>
              <th>Segmenty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allRecordings.map((rec) => (
              <tr
                key={rec.id}
                className={rec.id === selectedRecordingId ? "active" : ""}
                onClick={() => {
                  const meeting = userMeetings.find((m) => m.id === rec.meetingId);
                  if (meeting) selectMeeting(meeting);
                  setSelectedRecordingId(rec.id);
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="recordings-library-meeting">{rec.meetingTitle}</td>
                <td>{formatDateTime(rec.createdAt)}</td>
                <td>{formatDuration(rec.duration)}</td>
                <td>{rec.speakerCount || 0}</td>
                <td>{rec.transcript?.length || 0}</td>
                <td>
                  <span className={`status-chip status-chip-sm ${rec.pipelineStatus || "done"}`}>
                    {rec.pipelineStatus || "done"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
