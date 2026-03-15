import { formatDateTime } from "../lib/storage";
import { getMeetingLastActivity } from "../lib/activityFeed";

export default function StudioSidebar({
  currentUser,
  currentWorkspace,
  currentWorkspaceMembers,
  setActiveTab,
  meetingDraft,
  setMeetingDraft,
  activeStoredMeetingDraft,
  clearMeetingDraft,
  saveMeeting,
  startNewMeetingDraft,
  workspaceMessage,
  workspaceActivity = [],
  userMeetings,
  selectedMeetingId,
  selectMeeting,
  selectedMeeting,
}) {
  return (
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
          <button type="button" className="ghost-button" onClick={startNewMeetingDraft}>
            Nowe
          </button>
        </div>

        <div className="studio-draft-toolbar">
          <span className="microcopy">
            Autosave {activeStoredMeetingDraft?.updatedAt ? `zapisany ${formatDateTime(activeStoredMeetingDraft.updatedAt)}` : "aktywny"}
          </span>
          <button type="button" className="ghost-button" onClick={clearMeetingDraft}>
            Wyczyść draft
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
          <div className="button-row">
            <button type="button" className="primary-button" onClick={saveMeeting}>
              Zapisz spotkanie
            </button>
            <button type="button" className="ghost-button" onClick={clearMeetingDraft}>
              Odrzuć zmiany
            </button>
          </div>
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
            userMeetings.map((meeting) => {
              const lastActivity = getMeetingLastActivity(meeting, currentWorkspaceMembers);
              return (
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
                  {lastActivity ? (
                    <small className="meeting-activity-copy">
                      Ostatnia aktywnosc: {lastActivity.actor} - {lastActivity.message}
                    </small>
                  ) : null}
                  <div className="meeting-card-meta">
                    <span>{meeting.recordings.length} nagran</span>
                    <span>{meeting.speakerCount || 0} speakerow</span>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="empty-panel">
              <strong>Brak spotkan</strong>
              <span>Utworz pierwsze spotkanie powyzej albo zaloguj sie przez Google.</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header compact">
          <div>
            <div className="eyebrow">Workspace feed</div>
            <h2>Aktywnosc zespolu</h2>
          </div>
        </div>
        <div className="workspace-activity-list">
          {workspaceActivity.length ? (
            workspaceActivity.slice(0, 6).map((entry) => (
              <article key={entry.id} className={`workspace-activity-card ${entry.tone || "neutral"}`}>
                <strong>{entry.actor}</strong>
                <span>{entry.message}</span>
                <small>
                  {entry.entityType === "meeting" ? "Spotkanie" : "Zadanie"}: {entry.title}
                </small>
              </article>
            ))
          ) : (
            <div className="empty-panel">
              <strong>Brak aktywnosci</strong>
              <span>Nowe spotkania, komentarze i zmiany statusow pojawia sie tutaj.</span>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
