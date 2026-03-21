import './styles/profile.css';
import { useEffect, useRef, useState } from "react";
import { formatDateTime } from "./lib/storage";
import './ProfileTabStyles.css';

function VoiceProfilesSection({ sessionToken, apiBaseUrl }) {
  const [profiles, setProfiles] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speakerName, setSpeakerName] = useState("");
  const [status, setStatus] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!sessionToken || !apiBaseUrl) return;
    fetch(`${apiBaseUrl}/voice-profiles`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((r) => r.json())
      .then((data) => setProfiles(data.profiles || []))
      .catch(() => {});
  }, [sessionToken, apiBaseUrl]);

  async function startRecording() {
    if (!speakerName.trim()) { setStatus("Podaj imię osoby przed nagraniem."); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { setStatus("Brak dostępu do mikrofonu."); return; }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
      setElapsed(0);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setStatus("Przetwarzanie…");
      try {
        const res = await fetch(`${apiBaseUrl}/voice-profiles`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": blob.type,
            "X-Speaker-Name": speakerName.trim(),
          },
          body: blob,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Błąd serwera.");
        setProfiles((prev) => [data, ...prev]);
        setSpeakerName("");
        setStatus(data.hasEmbedding ? "Profil głosowy zapisany i gotowy." : "Profil zapisany. Zainstaluj ffmpeg dla automatycznego rozpoznawania.");
      } catch (err) {
        setStatus(`Błąd: ${err.message}`);
      }
    };
    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 300);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function deleteProfile(id) {
    await fetch(`${apiBaseUrl}/voice-profiles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  function formatElapsed(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">AI</div>
          <h2>Profile głosowe</h2>
        </div>
        <span className="status-chip">{profiles.length}</span>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "12px" }}>
        Nagraj 15–30 sekund głosu każdej osoby. AI automatycznie rozpozna je w przyszłych transkrypcjach.
      </p>
      <div className="stack-form" style={{ marginBottom: "16px" }}>
        <label>
          <span>Imię osoby</span>
          <input
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            placeholder="np. Marek"
            disabled={isRecording}
          />
        </label>
        <div className="button-row">
          {isRecording ? (
            <>
              <button type="button" className="danger-button" onClick={stopRecording}>
                ■ Stop ({formatElapsed(elapsed)})
              </button>
              <span style={{ fontSize: "0.82rem", color: "var(--accent)" }}>Nagrywa…</span>
            </>
          ) : (
            <button type="button" className="primary-button" onClick={startRecording} disabled={!speakerName.trim()}>
              ● Nagraj głos
            </button>
          )}
        </div>
        {status ? <div className={`inline-alert ${status.startsWith("Błąd") ? "error" : "info"}`}>{status}</div> : null}
      </div>

      {profiles.length > 0 && (
        <ul className="voice-profile-list">
          {profiles.map((p) => (
            <li key={p.id} className="voice-profile-item">
              <span className="voice-profile-avatar">{p.speakerName.slice(0, 2).toUpperCase()}</span>
              <div className="voice-profile-info">
                <strong>{p.speakerName}</strong>
                <span>{new Date(p.createdAt).toLocaleDateString("pl-PL")}</span>
              </div>
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: "0.78rem" }}
                onClick={() => deleteProfile(p.id)}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VocabularyManagerSection({ vocabulary, onUpdateVocabulary }) {
  const [newTerm, setNewTerm] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    const term = newTerm.trim();
    if (term && !vocabulary.includes(term)) {
      onUpdateVocabulary([...vocabulary, term]);
      setNewTerm("");
    }
  }

  function removeTerm(term) {
    onUpdateVocabulary(vocabulary.filter((t) => t !== term));
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Audio Engine</div>
          <h2>Słownik (Vocabulary)</h2>
        </div>
        <span className="status-chip">{vocabulary.length}</span>
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "12px" }}>
        Dodaj nazwy projektów, żargon techniczny lub nazwiska. AI będzie ich używać do poprawy celności transkrypcji.
      </p>

      <form className="stack-form" style={{ marginBottom: "16px" }} onSubmit={handleAdd}>
        <div className="button-row" style={{ gap: "8px" }}>
          <input
            style={{ flex: 1 }}
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="np. Antigravity, Kubernetes, Kowalski"
          />
          <button type="submit" className="secondary-button" disabled={!newTerm.trim()}>
            Dodaj
          </button>
        </div>
      </form>

      <div className="chip-list" style={{ marginTop: "8px" }}>
        {vocabulary.length > 0 ? (
          vocabulary.map((term) => (
            <span key={term} className="task-tag-chip neutral" style={{ paddingRight: "4px" }}>
              {term}
              <button
                type="button"
                style={{ marginLeft: "6px", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                onClick={() => removeTerm(term)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Brak słów w słowniku.</p>
        )}
      </div>
    </section>
  );
}

function TagManagerSection({ allTags, onRenameTag, onDeleteTag }) {
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(tag) {
    setEditingTag(tag);
    setEditValue(tag);
  }

  function commitEdit(tag) {
    if (editValue.trim() && editValue.trim() !== tag) {
      onRenameTag(tag, editValue.trim().toLowerCase());
    }
    setEditingTag(null);
    setEditValue("");
  }

  function handleKeyDown(e, tag) {
    if (e.key === "Enter") commitEdit(tag);
    if (e.key === "Escape") { setEditingTag(null); setEditValue(""); }
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Workspace</div>
          <h2>Zarządzanie tagami</h2>
        </div>
        <span className="status-chip">{allTags.length}</span>
      </div>

      {allTags.length === 0 ? (
        <div className="integration-card">
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            Brak tagów w workspace. Dodaj tagi do zadań lub spotkań.
          </p>
        </div>
      ) : (
        <div className="tag-manager-list">
          {allTags.map(({ tag, taskCount, meetingCount }) => (
            <div key={tag} className="tag-manager-row">
              {editingTag === tag ? (
                <input
                  className="tag-manager-edit-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(tag)}
                  onKeyDown={(e) => handleKeyDown(e, tag)}
                />
              ) : (
                <button
                  type="button"
                  className="tag-manager-name"
                  onClick={() => startEdit(tag)}
                  title="Kliknij, aby zmienić nazwę"
                >
                  #{tag}
                </button>
              )}
              <div className="tag-manager-counts">
                {taskCount > 0 && (
                  <span className="tag-count-chip tasks">{taskCount} {taskCount === 1 ? "zadanie" : "zadań"}</span>
                )}
                {meetingCount > 0 && (
                  <span className="tag-count-chip meetings">{meetingCount} {meetingCount === 1 ? "spotkanie" : "spotkań"}</span>
                )}
              </div>
              <button
                type="button"
                className="tag-manager-delete"
                title={`Usuń tag #${tag}`}
                onClick={() => onDeleteTag(tag)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function integrationStatusLabel(status, connectedCount) {
  if (connectedCount) {
    return `${connectedCount} wydarzen w kalendarzu`;
  }

  if (status === "connected") {
    return "Polaczone, ale w tym miesiacu nie ma jeszcze wydarzen.";
  }

  if (status === "loading") {
    return "Trwa pobieranie wydarzen";
  }

  return "Kalendarz nie jest jeszcze podpiety";
}

function ChangelogSection() {
  const [expandedVersion, setExpandedVersion] = useState("v1.5.0");
  
  const changelogData = [
    {
      version: "v1.5.0",
      date: "20 marca 2026",
      title: "Uporządkowanie Nagrań i Filtrowanie",
      changes: [
        "Jeden zintegrowany widok nagrań i spotkań zamiast dwóch oddzielnych paneli",
        "Dodano możliwość filtrowania spotkań i nagrań po wybranej dacie (kalendarzyk)",
        "Rozwinięto widok tabeli o tagi oraz możliwość natychmiastowego filtrowania (dropdown tagów)",
        "Nowe chipy tagów widoczne bezpośrednio na liście bez wchodzenia w detale",
        "Wyeliminowano błędy Service Workera i przystosowano testy Playwright E2E"
      ]
    },
    {
      version: "v1.4.2",
      date: "19 marca 2026",
      title: "Audio Pipeline i Backend",
      changes: [
        "Przeprowadzono migrację bazy IndexedDB do produkcyjnego silnika SQLite + Hono",
        "Uporządkowano zarządzanie zduplikowanymi plikami logiki i poprawiono deploy na Vercel",
        "Wprowadzono stabilny routing oraz natywne asercje w procesach rejestracji i resetu haseł",
        "Zaimplementowano poprawki estetyki dashboardu dla Google Login"
      ]
    },
    {
      version: "v1.4.0",
      date: "18 marca 2026",
      title: "Core UX",
      changes: [
        "Odtwarzacz plików reaguje asynchronicznie i naprawiono testy widoczności status bara",
        "Refaktoryzacja bazy E2E – zadania potwierdzane są klasą complete zamiast toggle'a"
      ]
    }
  ];

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Dziennik zmian</div>
          <h2>Changelog</h2>
        </div>
      </div>
      <div className="integration-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {changelogData.map((item, idx) => {
          const isExpanded = expandedVersion === item.version || (idx === 0 && !expandedVersion);
          return (
            <div key={idx} style={{ borderBottom: idx < changelogData.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: idx < changelogData.length - 1 ? '16px' : '0' }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setExpandedVersion(isExpanded ? null : item.version)}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{item.version} - {item.title}</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '4px' }}>{item.date}</p>
                </div>
                <span style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>
                  {isExpanded ? '▴' : '▾'}
                </span>
              </div>
              
              {isExpanded && (
                <ul style={{ marginTop: '12px', paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {item.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProfileTab({
  currentUser,
  profileDraft,
  setProfileDraft,
  saveProfile,
  profileMessage,
  googleEnabled,
  googleCalendarStatus,
  googleCalendarMessage,
  googleCalendarEventsCount,
  googleCalendarLastSyncedAt,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  refreshGoogleCalendar,
  passwordDraft,
  setPasswordDraft,
  updatePassword,
  securityMessage,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  googleTasksLastSyncedAt,
  googleTaskLists = [],
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
  onRefreshGoogleTasks,
  workspaceRole,
  onLogout,
  theme,
  onSetTheme,
  layoutPreset = "default",
  onSetLayoutPreset,
  allTags = [],
  onRenameTag,
  onDeleteTag,
  vocabulary = [],
  onUpdateVocabulary,
  sessionToken,
  apiBaseUrl,
}) {
  const canManagePassword = Boolean(currentUser?.passwordHash);

  return (
    <div className="profile-layout">
      <section className="profile-hero">
        <div className="profile-hero-main">
          {profileDraft.avatarUrl ? (
            <img src={profileDraft.avatarUrl} alt={profileDraft.name || currentUser.email} className="profile-avatar-lg" />
          ) : (
            <div className="profile-avatar-fallback">{(profileDraft.name || currentUser.email || "U").slice(0, 1)}</div>
          )}

          <div>
            <div className="eyebrow">Profil</div>
            <h2>{profileDraft.name || "Uzupelnij dane konta"}</h2>
            <p>
              {profileDraft.role || "Dodaj role"}{profileDraft.company ? ` w ${profileDraft.company}` : ""}
            </p>
            <div className="status-cluster">
              <span className="status-chip">{currentUser.provider === "google" ? "Google account" : "Local account"}</span>
              <span className="status-chip">{currentUser.email}</span>
              <span className="status-chip">{profileDraft.preferredTaskView === "kanban" ? "Kanban default" : "Lista default"}</span>
            </div>
          </div>
        </div>

        <div className="profile-hero-side">
          <div className="profile-stat-card">
            <span>Powiadomienia</span>
            <strong>{profileDraft.notifyDailyDigest ? "Wlaczone" : "Wylaczone"}</strong>
          </div>
          <div className="profile-stat-card">
            <span>Auto task capture</span>
            <strong>{profileDraft.autoTaskCapture ? "Aktywne" : "Reczne"}</strong>
          </div>
          <div className="profile-stat-card">
            <span>Timezone</span>
            <strong>{profileDraft.timezone || "Europe/Warsaw"}</strong>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Account</div>
              <h2>Dane podstawowe</h2>
            </div>
          </div>

          <form className="stack-form" onSubmit={saveProfile}>
            <label>
              <span>Imie i nazwisko</span>
              <input
                value={profileDraft.name}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, name: event.target.value }))}
              />
            </label>
            <label>
              <span>Rola</span>
              <input
                value={profileDraft.role}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, role: event.target.value }))}
              />
            </label>
            <label>
              <span>Firma</span>
              <input
                value={profileDraft.company}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, company: event.target.value }))}
              />
            </label>
            <label>
              <span>Telefon</span>
              <input
                value={profileDraft.phone}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, phone: event.target.value }))}
              />
            </label>
            <label>
              <span>Lokalizacja</span>
              <input
                value={profileDraft.location}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, location: event.target.value }))}
              />
            </label>
            <label>
              <span>Avatar URL</span>
              <input
                value={profileDraft.avatarUrl}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, avatarUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <button type="submit" className="secondary-button">
              Zapisz dane konta
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Preferences</div>
              <h2>Styl pracy</h2>
            </div>
          </div>

          <form className="stack-form" onSubmit={saveProfile}>
            <label>
              <span>Team</span>
              <input
                value={profileDraft.team}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, team: event.target.value }))}
              />
            </label>
            <label>
              <span>Timezone</span>
              <input
                value={profileDraft.timezone}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, timezone: event.target.value }))}
              />
            </label>
            <label>
              <span>Email do Google</span>
              <input
                value={profileDraft.googleEmail}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, googleEmail: event.target.value }))}
              />
            </label>
            <label>
              <span>Priorytetowe insighty</span>
              <textarea
                rows={4}
                value={profileDraft.preferredInsights}
                onChange={(event) =>
                  setProfileDraft((previous) => ({ ...previous, preferredInsights: event.target.value }))
                }
                placeholder={"np. Ryzyka\nDecyzje\nTaski ownerowane"}
              />
            </label>
            <label>
              <span>Bio</span>
              <textarea
                rows={5}
                value={profileDraft.bio}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, bio: event.target.value }))}
              />
            </label>

            <div className="toggle-grid">
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={profileDraft.notifyDailyDigest}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, notifyDailyDigest: event.target.checked }))
                  }
                />
                <div>
                  <strong>Daily digest</strong>
                  <span>Zapisuj preferencje pod codzienny przeglad spotkan i zadan.</span>
                </div>
              </label>

              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={profileDraft.autoTaskCapture}
                  onChange={(event) =>
                    setProfileDraft((previous) => ({ ...previous, autoTaskCapture: event.target.checked }))
                  }
                />
                <div>
                  <strong>Auto task capture</strong>
                  <span>Automatycznie pokazuj taski wykryte podczas analizy spotkan.</span>
                </div>
              </label>
            </div>

            <label>
              <span>Domyslny widok zadan</span>
              <select
                value={profileDraft.preferredTaskView}
                onChange={(event) =>
                  setProfileDraft((previous) => ({ ...previous, preferredTaskView: event.target.value }))
                }
              >
                <option value="list">Lista</option>
                <option value="kanban">Kanban</option>
              </select>
            </label>

            <button type="submit" className="secondary-button">
              Zapisz preferencje
            </button>
          </form>

          {profileMessage ? <div className="inline-alert success">{profileMessage}</div> : null}
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Integrations</div>
              <h2>Google i kalendarz</h2>
            </div>
          </div>

          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Google sign-in</strong>
                <p>{googleEnabled ? "Integracja jest gotowa do uzycia." : "Brakuje REACT_APP_GOOGLE_CLIENT_ID."}</p>
              </div>
              <span className="status-chip">{currentUser.provider === "google" ? "Polaczone" : "Lokalne konto"}</span>
            </div>

            <div className="integration-row">
              <div>
                <strong>Google Calendar</strong>
                <p>{integrationStatusLabel(googleCalendarStatus, googleCalendarEventsCount)}</p>
                <p>{googleCalendarStatus === "connected" ? "Live sync co 45 sekund." : "Po polaczeniu wlaczy sie auto refresh."}</p>
                {googleCalendarLastSyncedAt ? <p>Ostatni sync: {formatDateTime(googleCalendarLastSyncedAt)}</p> : null}
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={connectGoogleCalendar}
                  disabled={!googleEnabled || googleCalendarStatus === "loading"}
                >
                  {googleCalendarStatus === "loading" ? "Laczenie..." : "Polacz kalendarz"}
                </button>
                {googleCalendarStatus === "connected" ? (
                  <button type="button" className="ghost-button" onClick={refreshGoogleCalendar}>
                    Odswiez teraz
                  </button>
                ) : null}
                {googleCalendarEventsCount ? (
                  <button type="button" className="ghost-button" onClick={disconnectGoogleCalendar}>
                    Odlacz
                  </button>
                ) : null}
              </div>
            </div>

            {googleCalendarMessage ? <div className="inline-alert info">{googleCalendarMessage}</div> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Tasks sync</div>
              <h2>Google Tasks</h2>
            </div>
            <span className={`status-chip ${googleTasksStatus === "connected" ? "success" : ""}`}>
              {googleTasksStatus === "connected" ? "Live" : googleTasksStatus === "loading" ? "Sync..." : "Offline"}
            </span>
          </div>

          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Synchronizacja zadań</strong>
                <p>{googleTasksStatus === "connected" ? "Auto refresh co 45 s." : "Połącz konto Google, aby zsynchronizować zadania."}</p>
                {googleTasksLastSyncedAt ? <p>Ostatni sync: {formatDateTime(googleTasksLastSyncedAt)}</p> : null}
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={onConnectGoogleTasks}
                  disabled={!googleTasksEnabled || googleTasksStatus === "loading"}
                >
                  {googleTasksStatus === "connected" ? "Połącz ponownie" : "Połącz"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onImportGoogleTasks}
                  disabled={!selectedGoogleTaskListId}
                >
                  Import
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onExportGoogleTasks}
                  disabled={!selectedGoogleTaskListId}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={onRefreshGoogleTasks}
                  disabled={!selectedGoogleTaskListId || googleTasksStatus === "loading"}
                >
                  Odśwież
                </button>
              </div>
            </div>
            <div className="integration-row">
              <div>
                <strong>Lista zadań</strong>
                <p>Wybierz listę Google Tasks do synchronizacji.</p>
              </div>
              <select
                value={selectedGoogleTaskListId || ""}
                onChange={(event) => onSelectGoogleTaskList?.(event.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">Wybierz listę</option>
                {googleTaskLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
            </div>
            {googleTasksMessage ? <div className="inline-alert info">{googleTasksMessage}</div> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Workspace</div>
              <h2>Twoja rola</h2>
            </div>
          </div>
          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Rola w workspace</strong>
                <p>Twoja aktualna rola określa uprawnienia do edycji spotkań, zadań i zarządzania zespołem.</p>
              </div>
              <span className="status-chip">{workspaceRole || "member"}</span>
            </div>
            <div className="integration-row" style={{ alignItems: "start" }}>
              <div>
                <strong>Gestosc i charakter layoutu</strong>
                <p>Aktywny: <strong>{layoutPreset === "compact" ? "Compact" : layoutPreset === "bobr" ? "Bobr" : "Default"}</strong></p>
              </div>
              <div className="button-row">
                <button type="button" className={`ghost-button ${layoutPreset === "default" ? "active" : ""}`} onClick={() => onSetLayoutPreset?.("default")} style={{ background: layoutPreset === "default" ? "var(--bg-panel-strong)" : "transparent" }}>
                  Default
                </button>
                <button type="button" className={`ghost-button ${layoutPreset === "compact" ? "active" : ""}`} onClick={() => onSetLayoutPreset?.("compact")} style={{ background: layoutPreset === "compact" ? "var(--bg-panel-strong)" : "transparent" }}>
                  Compact
                </button>
                <button type="button" className={`ghost-button ${layoutPreset === "bobr" ? "active" : ""}`} onClick={() => onSetLayoutPreset?.("bobr")} style={{ background: layoutPreset === "bobr" ? "var(--bg-panel-strong)" : "transparent" }}>
                  Bobr
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Security</div>
              <h2>Bezpieczenstwo konta</h2>
            </div>
          </div>

          {canManagePassword ? (
            <form className="stack-form" onSubmit={updatePassword}>
              <label>
                <span>Aktualne haslo</span>
                <input
                  type="password"
                  value={passwordDraft.currentPassword}
                  onChange={(event) =>
                    setPasswordDraft((previous) => ({ ...previous, currentPassword: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Nowe haslo</span>
                <input
                  type="password"
                  value={passwordDraft.newPassword}
                  onChange={(event) =>
                    setPasswordDraft((previous) => ({ ...previous, newPassword: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Powtorz nowe haslo</span>
                <input
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) =>
                    setPasswordDraft((previous) => ({ ...previous, confirmPassword: event.target.value }))
                  }
                />
              </label>
              <button type="submit" className="secondary-button">
                Zmien haslo
              </button>
            </form>
          ) : (
            <div className="inline-alert info">To konto korzysta z logowania Google, wiec haslem zarzadza Google.</div>
          )}

          {securityMessage ? <div className="inline-alert success">{securityMessage}</div> : null}
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Wygląd</div>
              <h2>Motyw i layout</h2>
            </div>
          </div>
          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Motyw interfejsu</strong>
                <p>Aktywny: <strong>{theme === "beaver" ? "Bóbr" : theme === "light" ? "Jasny" : "Ciemny"}</strong></p>
              </div>
              <div className="button-row">
                <button type="button" className={`ghost-button ${theme === "dark" ? "active" : ""}`} onClick={() => onSetTheme("dark")} style={{ background: theme === "dark" ? "var(--bg-panel-strong)" : "transparent" }}>
                  🌙 Ciemny
                </button>
                <button type="button" className={`ghost-button ${theme === "light" ? "active" : ""}`} onClick={() => onSetTheme("light")} style={{ background: theme === "light" ? "var(--bg-panel-strong)" : "transparent" }}>
                  ☀️ Jasny
                </button>
                <button type="button" className={`ghost-button ${theme === "beaver" ? "active" : ""}`} onClick={() => onSetTheme("beaver")} style={{ background: theme === "beaver" ? "var(--bg-panel-strong)" : "transparent" }}>
                  🦫 Bóbr
                </button>
              </div>
            </div>
          </div>
        </section>

        <TagManagerSection
          allTags={allTags}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
        />

        <VocabularyManagerSection
          vocabulary={vocabulary}
          onUpdateVocabulary={onUpdateVocabulary}
        />

        <VoiceProfilesSection sessionToken={sessionToken} apiBaseUrl={apiBaseUrl} />

        <ChangelogSection />

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Session</div>
              <h2>Konto i sesja</h2>
            </div>
          </div>
          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Wyloguj się</strong>
                <p>Zakończ sesję i wróć do ekranu logowania.</p>
              </div>
              <button type="button" className="ghost-button" onClick={onLogout}>
                Wyloguj
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">PWA</div>
              <h2>Mobilnie i offline</h2>
            </div>
            <span className={typeof navigator !== "undefined" && navigator.onLine ? "status-chip success" : "status-chip danger"}>
              {typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"}
            </span>
          </div>
          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Tryb działania</strong>
                <p>{typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as any)?.standalone) ? "Aplikacja (PWA)" : "Przeglądarka"}</p>
              </div>
              <div>
                <strong>Cache offline</strong>
                <p>{typeof navigator !== "undefined" && "serviceWorker" in navigator ? (navigator.serviceWorker?.controller ? "Aktywny" : "Startuje") : "Brak wsparcia"}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
