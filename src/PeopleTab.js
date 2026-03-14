import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "./lib/storage";

export default function PeopleTab({ profiles, onOpenMeeting }) {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [query, setQuery] = useState("");

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

  const selectedPerson = visibleProfiles.find((profile) => profile.id === selectedPersonId) || visibleProfiles[0] || null;

  return (
    <div className="people-layout">
      <aside className="people-sidebar">
        <section className="tasks-brand-panel">
          <div className="eyebrow">People</div>
          <h2>Relacje, potrzeby i ownership</h2>
          <p>Lista osob budowana z uczestnikow spotkan, rozmowcow i ownerow zadan. To jeden punkt odniesienia dla spotkan i follow-upow.</p>
        </section>

        <section className="tasks-list-panel">
          <label className="people-search-field">
            <span>Szukaj osoby</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="np. Anna" />
          </label>

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
                    <span className="status-chip">{selectedPerson.meetings.length} spotkan</span>
                    <span className="status-chip">{selectedPerson.openTasks} otwartych zadan</span>
                    <span className="status-chip">{selectedPerson.completedTasks} zakonczonych</span>
                  </div>
                </div>
              </div>

              <div className="profile-hero-side">
                <div className="profile-stat-card">
                  <span>Nastepne spotkanie</span>
                  <strong>{selectedPerson.nextMeeting ? formatDateTime(selectedPerson.nextMeeting.startsAt) : "Brak"}</strong>
                </div>
                <div className="profile-stat-card">
                  <span>Potrzeby</span>
                  <strong>{selectedPerson.needs[0] || "Brak danych"}</strong>
                </div>
                <div className="profile-stat-card">
                  <span>Najwazniejszy output</span>
                  <strong>{selectedPerson.outputs[0] || "Brak danych"}</strong>
                </div>
              </div>
            </section>

            <div className="people-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">AI profile</div>
                    <h2>Charakterystyka</h2>
                  </div>
                </div>

                <div className="analysis-block">
                  <p>{selectedPerson.summary}</p>
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
                    <h3>Potrzeby</h3>
                    <ul className="clean-list">
                      {selectedPerson.needs.length ? selectedPerson.needs.map((need) => <li key={need}>{need}</li>) : <li>Brak danych.</li>}
                    </ul>
                  </div>
                  <div>
                    <h3>Outputy</h3>
                    <ul className="clean-list">
                      {selectedPerson.outputs.length ? selectedPerson.outputs.map((item) => <li key={item}>{item}</li>) : <li>Brak danych.</li>}
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

              <section className="panel">
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

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <h2>Zadania tej osoby</h2>
                  </div>
                </div>

                <div className="people-task-list">
                  {selectedPerson.tasks.length ? (
                    selectedPerson.tasks.map((task) => (
                      <div key={task.id} className="person-task-card">
                        <div className="kanban-card-top">
                          <strong>{task.title}</strong>
                          <span className={`task-status-chip ${task.status}`}>{task.completed ? "Done" : task.priority}</span>
                        </div>
                        <p>{task.description || task.sourceMeetingTitle}</p>
                        <div className="chip-list">
                          {(task.tags || []).map((tag) => (
                            <span key={`${task.id}-${tag}`} className="task-tag-chip neutral">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
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
