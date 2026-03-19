import './styles/people.css';
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "./lib/storage";

const DISC_COLORS = { D: "#f17d72", I: "#ffd166", S: "#74d0bf", C: "#7b9eeb" };

const STYLE_LABELS = {
  communicationStyle: { direct: "Bezpośredni", diplomatic: "Dyplomatyczny", analytical: "Analityczny", expressive: "Ekspresywny" },
  decisionStyle: { "data-driven": "Oparty na danych", intuitive: "Intuicyjny", consensual: "Konsensusowy", authoritative: "Autorytatywny" },
  conflictStyle: { confrontational: "Konfrontacyjny", avoidant: "Unikający", collaborative: "Współpracujący", compromising: "Kompromisowy" },
  listeningStyle: { active: "Aktywny słuchacz", selective: "Selektywny", "task-focused": "Zadaniowy" },
};

function DiscRadarChart({ disc }) {
  const cx = 100, cy = 100, maxR = 70;
  const { D = 50, I = 50, S = 50, C = 50 } = disc || {};

  function pt(val, dir) {
    const r = (Math.min(100, Math.max(0, val)) / 100) * maxR;
    if (dir === "N") return [cx, cy - r];
    if (dir === "E") return [cx + r, cy];
    if (dir === "S") return [cx, cy + r];
    return [cx - r, cy];
  }

  const pts = [pt(D, "N"), pt(I, "E"), pt(S, "S"), pt(C, "W")];
  const poly = pts.map((p) => p.join(",")).join(" ");
  const rings = [25, 50, 75, 100];

  return (
    <svg viewBox="0 0 200 200" className="disc-radar" aria-label="Radar DISC">
      {rings.map((v) => {
        const r = (v / 100) * maxR;
        return (
          <polygon
            key={v}
            points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        );
      })}
      <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <polygon points={poly} fill="rgba(116,208,191,0.18)" stroke="rgba(116,208,191,0.75)" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={[DISC_COLORS.D, DISC_COLORS.I, DISC_COLORS.S, DISC_COLORS.C][i]} />
      ))}
      <text x={cx} y={cy - maxR - 11} textAnchor="middle" fill={DISC_COLORS.D} fontSize="13" fontWeight="700">D</text>
      <text x={cx + maxR + 13} y={cy + 5} textAnchor="start" fill={DISC_COLORS.I} fontSize="13" fontWeight="700">I</text>
      <text x={cx} y={cy + maxR + 19} textAnchor="middle" fill={DISC_COLORS.S} fontSize="13" fontWeight="700">S</text>
      <text x={cx - maxR - 13} y={cy + 5} textAnchor="end" fill={DISC_COLORS.C} fontSize="13" fontWeight="700">C</text>
      <text x={cx + 5} y={cy - maxR + 14} fill="rgba(255,255,255,0.55)" fontSize="10">{D}</text>
      <text x={cx + maxR - 6} y={cy - 5} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="10">{I}</text>
      <text x={cx + 5} y={cy + maxR - 4} fill="rgba(255,255,255,0.55)" fontSize="10">{S}</text>
      <text x={cx - maxR + 6} y={cy - 5} fill="rgba(255,255,255,0.55)" fontSize="10">{C}</text>
    </svg>
  );
}

function PsychProfilePanel({ person, onAnalyze, analyzing }) {
  const [showRedFlags, setShowRedFlags] = useState(false);
  const p = person.psychProfile;
  const canAnalyze = person.meetings.length >= 1;

  if (!p) {
    return (
      <div className="psych-empty-state">
        <p className="soft-copy">
          {canAnalyze
            ? `${person.meetings.length} spotkanie${person.meetings.length > 1 ? "ń" : ""} z tą osobą — gotowe do analizy.`
            : "Potrzeba co najmniej 1 spotkania, aby wygenerować profil."}
        </p>
        <button type="button" className="secondary-button" onClick={onAnalyze} disabled={!canAnalyze || analyzing}>
          {analyzing ? "Analizuję…" : "Generuj profil"}
        </button>
        {analyzing && <div className="psych-loading-bar" />}
      </div>
    );
  }

  return (
    <div className="psych-profile-content">
      <div className="psych-disc-section">
        <DiscRadarChart disc={p.disc} />
        <div className="psych-disc-info">
          <div className="psych-disc-style">{p.discStyle}</div>
          {p.discDescription && <p className="psych-disc-description">{p.discDescription}</p>}
          <div className="psych-disc-bars">
            {["D", "I", "S", "C"].map((key) => (
              <div key={key} className="psych-disc-bar-row">
                <span className={`psych-disc-label psych-disc-${key.toLowerCase()}`}>{key}</span>
                <div className="psych-disc-bar-track">
                  <div
                    className={`psych-disc-bar-fill psych-disc-fill-${key.toLowerCase()}`}
                    style={{ width: `${p.disc?.[key] || 0}%` }}
                  />
                </div>
                <span className="psych-disc-value">{p.disc?.[key] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {p.values?.length > 0 && (
        <div className="psych-section">
          <div className="psych-section-label">Wartości</div>
          <div className="psych-values-grid">
            {p.values.map((v, i) => (
              <div key={i} className="psych-value-card">
                {v.icon && <span className="psych-value-icon">{v.icon}</span>}
                <span className="psych-value-name">{v.value}</span>
                {v.quote && <span className="psych-value-quote">„{v.quote}"</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="psych-section">
        <div className="psych-section-label">Style</div>
        <div className="psych-style-badges">
          {[["Komunikacja", "communicationStyle"], ["Decyzje", "decisionStyle"], ["Konflikt", "conflictStyle"], ["Słuchanie", "listeningStyle"]].map(
            ([label, key]) =>
              p[key] ? (
                <div key={key} className="psych-style-badge">
                  <span className="psych-style-badge-label">{label}</span>
                  <span className="psych-style-badge-value">{STYLE_LABELS[key]?.[p[key]] || p[key]}</span>
                </div>
              ) : null
          )}
        </div>
      </div>

      {p.stressResponse && (
        <div className="psych-section">
          <div className="psych-section-label">Pod presją</div>
          <p className="psych-stress-text">{p.stressResponse}</p>
        </div>
      )}

      {(p.communicationDos?.length > 0 || p.communicationDonts?.length > 0 || p.workingWithTips?.length > 0) && (
        <div className="psych-section">
          <div className="psych-section-label">Jak z nią pracować</div>
          {(p.communicationDos?.length > 0 || p.communicationDonts?.length > 0) && (
            <div className="psych-tips-columns">
              {p.communicationDos?.length > 0 && (
                <div>
                  <div className="psych-tips-col-head psych-do">Do ✓</div>
                  <ul className="clean-list psych-tip-list">
                    {p.communicationDos.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}
              {p.communicationDonts?.length > 0 && (
                <div>
                  <div className="psych-tips-col-head psych-dont">Don't ✗</div>
                  <ul className="clean-list psych-tip-list">
                    {p.communicationDonts.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {p.workingWithTips?.length > 0 && (
            <ul className="clean-list psych-tips-main">
              {p.workingWithTips.map((tip, i) => (
                <li key={i} className="psych-tip-item">→ {tip}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {p.coachingNote && (
        <div className="psych-coaching-box">
          <span className="psych-coaching-icon">💡</span>
          <p>{p.coachingNote}</p>
        </div>
      )}

      {p.redFlags?.length > 0 && (
        <div className="psych-redflags-section">
          <button type="button" className="psych-redflags-toggle" onClick={() => setShowRedFlags((v) => !v)}>
            ⚠ Red flags ({p.redFlags.length}) {showRedFlags ? "▲" : "▼"}
          </button>
          {showRedFlags && (
            <ul className="clean-list psych-redflags-list">
              {p.redFlags.map((flag, i) => <li key={i}>{flag}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="psych-footer">
        <span>Na podstawie {p.meetingsAnalyzed || person.meetings.length} spotkań · model probabilistyczny</span>
        <button type="button" className="ghost-button" style={{ fontSize: "0.75rem" }} onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? "Aktualizuję…" : "Odśwież"}
        </button>
      </div>
    </div>
  );
}

export default function PeopleTab({ profiles, onOpenMeeting, onOpenTask, onCreateTask, onCreateMeeting, onUpdatePersonNotes, onAnalyzePersonProfile, externalSelectedPersonId, onPersonSelectionHandled }) {
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [query, setQuery] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [newNeedDraft, setNewNeedDraft] = useState("");
  const [newOutputDraft, setNewOutputDraft] = useState("");
  const [addingNeed, setAddingNeed] = useState(false);
  const [addingOutput, setAddingOutput] = useState(false);
  const [analyzingPsych, setAnalyzingPsych] = useState(false);
  const meetingsSectionRef = useRef(null);
  const tasksSectionRef = useRef(null);

  useEffect(() => {
    setAnalyzingPsych(false);
  }, [selectedPersonId]);

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

  async function handleAnalyzePsych() {
    if (!selectedPerson || !onAnalyzePersonProfile) return;
    setAnalyzingPsych(true);
    try {
      await onAnalyzePersonProfile(selectedPerson.id);
    } finally {
      setAnalyzingPsych(false);
    }
  }

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
                {typeof onCreateMeeting === "function" && (
                  <button
                    type="button"
                    className="people-add-task-btn"
                    onClick={() => onCreateMeeting(selectedPerson.name)}
                    title="Zaplanuj spotkanie z tą osobą"
                  >
                    + spotkanie
                  </button>
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

              <section className="panel psych-profile-panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Psychology</div>
                    <h2>Profil psychologiczny</h2>
                  </div>
                </div>
                <PsychProfilePanel
                  person={selectedPerson}
                  onAnalyze={handleAnalyzePsych}
                  analyzing={analyzingPsych}
                />
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
