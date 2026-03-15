import { buildGoogleCalendarUrl, downloadMeetingIcs } from "../lib/calendar";
import { formatDateTime, formatDuration } from "../lib/storage";
import AiTaskSuggestionsPanel from "./AiTaskSuggestionsPanel";
import KpiDashboard from "./KpiDashboard";
import RecorderPanel from "./RecorderPanel";
import TranscriptPanel from "./TranscriptPanel";

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
  currentWorkspacePermissions,
  currentWorkspaceRole,
  currentWorkspace,
  userMeetings,
  meetingTasks,
  addRecordingMarker,
  deleteRecordingMarker,
  onCreateTask,
  peopleProfiles,
}) {
  if (!selectedMeeting) {
    return (
      <section className="hero-panel empty-workspace">
        <div className="eyebrow">Workspace</div>
        <h2>Utworz pierwsze spotkanie</h2>
        <p>
          Zacznij od briefu, potem uruchom recorder i przypnij rozmowe do konkretnego spotkania albo zaplanuj
          termin w zakladce Kalendarz.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => startRecording({ adHoc: true })}
            disabled={!currentWorkspacePermissions?.canRecordAudio}
          >
            Zacznij nagranie ad hoc
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
      </section>
    );
  }

  return (
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
          <div className="metric-card">
            <span>Rola</span>
            <strong>{currentWorkspaceRole || "member"}</strong>
          </div>
        </div>
        <div className="inline-alert info">
          Edycja: owner, admin, member. Usuwanie: owner, admin. Eksport: owner, admin, member.
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

      <KpiDashboard
        workspaceName={currentWorkspace?.name || ""}
        meetings={userMeetings}
        tasks={meetingTasks}
      />

      <div className="main-grid">
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
      </div>
    </>
  );
}
