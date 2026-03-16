import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "./lib/storage";

export default function PeopleTab({ profiles, onOpenMeeting, onOpenTask, onCreateTask, onUpdatePersonNotes, externalSelectedPersonId, onPersonSelectionHandled }) {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [query, setQuery] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [newNeedDraft, setNewNeedDraft] = useState("");
  const [newOutputDraft, setNewOutputDraft] = useState("");
  const [addingNeed, setAddingNeed] = useState(false);
  const [addingOutput, setAddingOutput] = useState(false);
  const meetingsSectionRef = useRef(null);
  const tasksSectionRef = useRef(null);

  const visibleProfiles = useMemo(() => {
    const term = String(query || "").trim().toLowerCase();
    if (!term) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const haystack = `${profile.name} ${profile.summary} ${(profile.tags || []).join(" ")}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [profiles, query]);

  useEffect(() => {
    if (!visibleProfiles.length) {
      setSelectedPersonId("");
      return;
    }

    if (!visibleProfiles.some((profile) => profile.id === selectedPersonId)) {
      setSelectedPersonId(visibleProfiles[0].id);
    }
  }, [selectedPersonId, visibleProfiles]);

  useEffect(() => {
    if (!externalSelectedPersonId) {
      return;
    }

    const matchingProfile = profiles.find((profile) => profile.id === externalSelectedPersonId);
    if (!matchingProfile) {
      onPersonSelectionHandled?.();
      return;
    }

    setQuery("");
    setSelectedPersonId(matchingProfile.id);
    onPersonSelectionHandled?.();
  }, [externalSelectedPersonId, onPersonSelectionHandled, profiles]);

  const selectedPerson = visibleProfiles.find((profile) => profile.id === selectedPersonId) || visibleProfiles[0] || null;

  return (
    <div className="people-layout">
      <aside className="people-sidebar">
        <section className="tasks-list-panel">
          <div className="people-search-wrap">
            <span className="people-search-icon" aria-hidden="true">⌕</span>
            <input
              className="people-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj po imieniu…"
              autoFocus={false}
            />
            {query && (
              <button
                type="button"
                className="people-search-clear"
                onClick={() => setQuery("")}
                aria-label="Wyczyść wyszukiwanie"
              >
                ×
              </button>
            )}
          </div>

          <div className="people-list">
            {visibleProfiles.length ? (
              visibleProfiles.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  className={selectedPerson?.id === profile.id ? "person-row active" : "person-row"}
                  onClick={() => setSelectedPersonId(profile.id)}
                >
                  <div>
                    <strong>{profile.name}</strong>
                    <span>{profile.meetings.length} spotkan • {profile.tasks.length} zadan</span>
                  </div>
                  <span className="task-filter-count">{profile.openTasks}</span>
                </button>
              ))
            ) : (
              <div className="task-empty-state">
                <strong>Brak osob</strong>
                <span>Dodaj uczestnikow do spotkan albo przypisz taski, aby tu sie pojawili.</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="people-main">
        {selectedPerson ? (
          <>
            <section className="profile-hero people-hero">
              <div className="profile-hero-main">
                <div className="profile-avatar-fallback">{selectedPerson.name.slice(0, 1)}</div>
                <div>
                  <div className="eyebrow">Osoba</div>
                  <h2>{selectedPerson.name}</h2>
                  <p>{selectedPerson.summary}</p>
                  <div className="status-cluster">
                    <button type="button" className="status-chip status-chip-link" onClick={() => meetingsSectionRef.current?.scrollIntoView({ behavior: "smooth" })}>
                      {selectedPerson.meetings.length} spotkan
                    </button>
                    <button type="button" className="status-chip status-chip-link" onClick={() => tasksSectionRef.current?.scrollIntoView({ behavior: "smooth" })}>
                      {selectedPerson.openTasks} otwartych zadan
                    </button>
                    <span className="status-chip">{selectedPerson.completedTasks} zakonczonych</span>
                  </div>
                </div>
              </div>

              <div className="profile-hero-side">
                {selectedPerson.nextMeeting ? (
                  <button
                    type="button"
                    className="profile-stat-card profile-stat-link"
                    onClick={() => onOpenMeeting(selectedPerson.nextMeeting.id)}
                  >
                    <span>Nastepne spotkanie</span>
                    <strong>{formatDateTime(selectedPerson.nextMeeting.startsAt)}</strong>
                  </button>
                ) : (
                  <div className="profile-stat-card">
                    <span>Nastepne spotkanie</span>
                    <strong>Brak</strong>
                  </div>
                )}
              </div>
            </section>

            <div className="people-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">AI profile</div>
                    <h2>Charakterystyka</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    style={{fontSize:"0.8rem"}}
                    onClick={() => { setSummaryDraft(selectedPerson.summary); setEditingSummary(true); }}
                    title="Edytuj profil"
                  >
                    Edytuj
                  </button>
                </div>

                <div className="analysis-block">
                  {editingSummary ? (
                    <div className="profile-edit-form">
                      <textarea
                        className="profile-summary-edit"
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                      <div className="button-row">
                        <button type="button" className="ghost-button" style={{fontSize:"0.8rem"}} onClick={() => setEditingSummary(false)}>Anuluj</button>
                      </div>
                    </div>
                  ) : (
                    <p>{selectedPerson.summary}</p>
                  )}
                </div>

                <div className="chip-list">
                  {selectedPerson.traits.length ? (
                    selectedPerson.traits.map((trait) => (
                      <span key={trait} className="task-tag-chip neutral">
                        {trait}
                      </span>
                    ))
                  ) : (
                    <span className="soft-copy">Potrzeba wiecej spotkan, aby lepiej scharakteryzowac te osobe.</span>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Expectations</div>
                    <h2>Potrzeby i oczekiwania</h2>
                  </div>
                </div>

                <div className="brief-columns">
                  <div>
                    <div className="brief-col-head">
                      <h3>Potrzeby</h3>
                      <button
                        type="button"
                        className="what-matters-add-btn"
                        onClick={() => { setAddingNeed(true); setNewNeedDraft(""); }}
                        title="Dodaj potrzebę"
                      >+</button>
                    </div>
                    {addingNeed && (
                      <form
                        className="person-notes-add-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const val = newNeedDraft.trim();
                          if (!val) return;
                          onUpdatePersonNotes?.(selectedPerson.id, { needs: [...selectedPerson.needs, val] });
                          setAddingNeed(false);
                          setNewNeedDraft("");
                        }}
                      >
                        <input
                          autoFocus
                          value={newNeedDraft}
                          onChange={(e) => setNewNeedDraft(e.target.value)}
                          placeholder="np. Jasne priorytety"
                        />
                        <button type="submit" className="ghost-button">Dodaj</button>
                        <button type="button" className="ghost-button" onClick={() => setAddingNeed(false)}>×</button>
                      </form>
                    )}
                    <ul className="clean-list person-notes-list">
                      {selectedPerson.needs.length ? selectedPerson.needs.map((need) => (
                        <li key={need} className="person-notes-item">
                          <span>{need}</span>
                          <button
                            type="button"
                            className="person-notes-remove"
                            onClick={() => onUpdatePersonNotes?.(selectedPerson.id, { needs: selectedPerson.needs.filter((n) => n !== need) })}
                            title="Usuń"
                          >×</button>
                        </li>
                      )) : <li className="soft-copy">Brak danych.</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="brief-col-head">
                      <h3>Outputy</h3>
                      <button
                        type="button"
                        className="what-matters-add-btn"
                        onClick={() => { setAddingOutput(true); setNewOutputDraft(""); }}
                        title="Dodaj output"
                      >+</button>
                    </div>
                    {addingOutput && (
                      <form
                        className="person-notes-add-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const val = newOutputDraft.trim();
                          if (!val) return;
                          onUpdatePersonNotes?.(selectedPerson.id, { outputs: [...selectedPerson.outputs, val] });
                          setAddingOutput(false);
                          setNewOutputDraft("");
                        }}
                      >
                        <input
                          autoFocus
                          value={newOutputDraft}
                          onChange={(e) => setNewOutputDraft(e.target.value)}
                          placeholder="np. Lista decyzji"
                        />
                        <button type="submit" className="ghost-button">Dodaj</button>
                        <button type="button" className="ghost-button" onClick={() => setAddingOutput(false)}>×</button>
                      </form>
                    )}
                    <ul className="clean-list person-notes-list">
                      {selectedPerson.outputs.length ? selectedPerson.outputs.map((item) => (
                        <li key={item} className="person-notes-item">
                          <span>{item}</span>
                          <button
                            type="button"
                            className="person-notes-remove"
                            onClick={() => onUpdatePersonNotes?.(selectedPerson.id, { outputs: selectedPerson.outputs.filter((o) => o !== item) })}
                            title="Usuń"
                          >×</button>
                        </li>
                      )) : <li className="soft-copy">Brak danych.</li>}
                    </ul>
                  </div>
                </div>

                <div className="chip-list">
                  {selectedPerson.tags.map((tag) => (
                    <span key={tag} className="task-tag-chip neutral">
                      #{tag}
                    </span>
                  ))}
                </div>
              </section>

              <section className="panel" ref={meetingsSectionRef}>
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Meetings</div>
                    <h2>Historia spotkan</h2>
                  </div>
                </div>

                <div className="agenda-list">
                  {selectedPerson.meetings.length ? (
                    selectedPerson.meetings.slice(0, 8).map((meeting) => (
                      <button
                        type="button"
                        key={meeting.id}
                        className="agenda-card"
                        onClick={() => onOpenMeeting(meeting.id)}
                      >
                        <strong>{meeting.title}</strong>
                        <span>{formatDateTime(meeting.startsAt)}</span>
                        <p>{meeting.context || "Brak dodatkowego kontekstu."}</p>
                      </button>
                    ))
                  ) : (
                    <div className="empty-panel">
                      <strong>Brak spotkan</strong>
                      <span>Ta osoba nie pojawila sie jeszcze w zadnym spotkaniu.</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="panel" ref={tasksSectionRef}>
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <h2>Zadania tej osoby</h2>
                  </div>
                  {typeof onCreateTask === "function" && (
                    <button
                      type="button"
                      className="people-add-task-btn"
                      onClick={() => onCreateTask({ owner: selectedPerson.name, title: `Zadanie dla ${selectedPerson.name}` })}
                      title="Dodaj zadanie dla tej osoby"
                    >
                      + zadanie
                    </button>
                  )}
                </div>

                <div className="people-task-list">
                  {selectedPerson.tasks.length ? (
                    selectedPerson.tasks.map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        className="person-task-card person-task-card-clickable"
                        onClick={() => typeof onOpenTask === "function" && onOpenTask(task.id)}
                        title="Przejdź do zadania"
                      >
                        <div className="kanban-card-top">
                          <strong>{task.title}</strong>
                          <span className={`task-status-chip ${task.status}`}>{task.completed ? "Done" : task.priority}</span>
                        </div>
                        {(task.description || (task.sourceType !== "manual" && task.sourceMeetingTitle)) ? (
                          <p>{task.description || task.sourceMeetingTitle}</p>
                        ) : null}
                        <div className="chip-list">
                          {(task.tags || []).map((tag) => (
                            <span key={`${task.id}-${tag}`} className="task-tag-chip neutral">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="empty-panel">
                      <strong>Brak zadan</strong>
                      <span>Na razie nic nie jest przypisane do tej osoby.</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <section className="hero-panel empty-workspace">
            <div className="eyebrow">Osoby</div>
            <h2>Dodaj uczestnikow do spotkan</h2>
            <p>Gdy pojawia sie ludzie w spotkaniach i taskach, tutaj zbuduje sie ich profil roboczy.</p>
          </section>
        )}
      </section>
    </div>
  );
}
