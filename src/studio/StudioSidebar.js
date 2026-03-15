import { useState } from "react";
import { formatDateTime } from "../lib/storage";

export default function StudioSidebar({
  currentWorkspacePermissions,
  isDetachedMeetingDraft,
  meetingDraft,
  setMeetingDraft,
  activeStoredMeetingDraft,
  clearMeetingDraft,
  saveMeeting,
  startNewMeetingDraft,
  workspaceMessage,
  selectedMeeting,
}) {
  const canEditWorkspace = Boolean(currentWorkspacePermissions?.canEditWorkspace);
  const [activeSection, setActiveSection] = useState("basic");

  return (
    <aside className="workspace-sidebar">
      <section className="panel">
        <div className="panel-header compact">
          <div>
            <div className="eyebrow">Meeting brief</div>
            <h2>{selectedMeeting ? "Edytuj spotkanie" : "Nowe spotkanie"}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={startNewMeetingDraft}>
            + Nowe
          </button>
        </div>

        <div className="brief-tab-bar">
          <button
            type="button"
            className={activeSection === "basic" ? "brief-tab active" : "brief-tab"}
            onClick={() => setActiveSection("basic")}
          >
            Podstawowe
          </button>
          <button
            type="button"
            className={activeSection === "advanced" ? "brief-tab active" : "brief-tab"}
            onClick={() => setActiveSection("advanced")}
          >
            Szczegóły
          </button>
          <span className="brief-autosave">
            {activeStoredMeetingDraft?.updatedAt ? `Zapisano ${formatDateTime(activeStoredMeetingDraft.updatedAt)}` : "Autosave aktywny"}
          </span>
        </div>

        {activeSection === "basic" ? (
          <div className="stack-form brief-form-section">
            <label>
              <span>Tytuł</span>
              <input
                value={meetingDraft.title}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="np. Spotkanie z klientem"
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Kontekst</span>
              <textarea
                rows="3"
                value={meetingDraft.context}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))}
                placeholder="O czym będzie to spotkanie?"
                disabled={!canEditWorkspace}
              />
            </label>
            <div className="brief-row">
              <label>
                <span>Termin</span>
                <input
                  type="datetime-local"
                  value={meetingDraft.startsAt}
                  onChange={(event) => setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))}
                  disabled={!canEditWorkspace}
                />
              </label>
              <label>
                <span>Czas</span>
                <div className="duration-picker">
                  <select
                    value={[15, 30, 45, 60].includes(Number(meetingDraft.durationMinutes)) ? String(meetingDraft.durationMinutes) : "custom"}
                    onChange={(event) => {
                      if (event.target.value !== "custom") {
                        setMeetingDraft((previous) => ({ ...previous, durationMinutes: Number(event.target.value) }));
                      }
                    }}
                    disabled={!canEditWorkspace}
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 godz</option>
                    <option value="custom">Własny</option>
                  </select>
                  {![15, 30, 45, 60].includes(Number(meetingDraft.durationMinutes)) && (
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={meetingDraft.durationMinutes}
                      onChange={(event) => setMeetingDraft((previous) => ({ ...previous, durationMinutes: event.target.value }))}
                      disabled={!canEditWorkspace}
                      placeholder="min"
                      className="duration-custom-input"
                    />
                  )}
                </div>
              </label>
            </div>
            <label>
              <span>Uczestnicy</span>
              <textarea
                rows="2"
                value={meetingDraft.attendees}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, attendees: event.target.value }))}
                placeholder={"np. Anna Kowalska\nJan Nowak"}
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Tagi</span>
              <input
                value={meetingDraft.tags}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, tags: event.target.value }))}
                placeholder="klient, budzet, follow-up"
                disabled={!canEditWorkspace}
              />
            </label>
          </div>
        ) : (
          <div className="stack-form brief-form-section">
            <label>
              <span>Moje potrzeby</span>
              <textarea
                rows="3"
                value={meetingDraft.needs}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))}
                placeholder={"np. Decyzje budzetowe\nRyzyka wdrozenia"}
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Co wyciagnac po spotkaniu</span>
              <textarea
                rows="3"
                value={meetingDraft.desiredOutputs}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, desiredOutputs: event.target.value }))}
                placeholder={"np. Kolejne kroki\nOwnerzy zadan"}
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Lokalizacja</span>
              <input
                value={meetingDraft.location}
                onChange={(event) => setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="np. Sala konferencyjna A"
                disabled={!canEditWorkspace}
              />
            </label>
          </div>
        )}

        <div className="button-row brief-actions">
          <button type="button" className="primary-button" onClick={saveMeeting} disabled={!canEditWorkspace || !meetingDraft.title?.trim()}>
            {isDetachedMeetingDraft ? "Utwórz spotkanie" : "Zapisz zmiany"}
          </button>
          <button type="button" className="ghost-button" onClick={clearMeetingDraft} disabled={!canEditWorkspace}>
            Wyczyść
          </button>
        </div>

        {workspaceMessage ? <div className="inline-alert success">{workspaceMessage}</div> : null}
      </section>
    </aside>
  );
}
