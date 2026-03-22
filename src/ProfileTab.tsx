import './styles/profile.css';
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "./services/httpClient";
import { apiBaseUrlConfigured } from "./services/config";
import type { VoiceProfileSummary, VoiceProfilesListPayload } from "./shared/types";
import './ProfileTabStyles.css';

function VoiceProfilesSection() {
  const [profiles, setProfiles] = useState<VoiceProfileSummary[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speakerName, setSpeakerName] = useState("");
  const [status, setStatus] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const backendApiReady = apiBaseUrlConfigured();

  useEffect(() => {
    if (!backendApiReady) return;
    apiRequest("/voice-profiles")
      .then((data: VoiceProfilesListPayload) => setProfiles(data.profiles || []))
      .catch(() => {});
  }, [backendApiReady]);

  async function startRecording() {
    if (!backendApiReady) {
      setStatus("Backend API nie jest skonfigurowane. Ustaw VITE_API_BASE_URL lub REACT_APP_API_BASE_URL.");
      return;
    }
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
        const data = await apiRequest("/voice-profiles", {
          method: "POST",
          body: blob,
          headers: {
            "Content-Type": blob.type,
            "X-Speaker-Name": speakerName.trim(),
          },
        }) as VoiceProfileSummary;
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
    await apiRequest(`/voice-profiles/${id}`, { method: "DELETE", parseAs: "raw" });
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
            <button
              type="button"
              className="primary-button"
              onClick={startRecording}
              disabled={!speakerName.trim() || !backendApiReady}
              title={!backendApiReady ? "Skonfiguruj backend API, aby nagrywac profile glosowe." : undefined}
            >
              ● Nagraj głos
            </button>
          )}
        </div>
        {!backendApiReady ? (
          <div className="inline-alert info">
            Profile glosowe wymagaja backend API. Ustaw `VITE_API_BASE_URL` albo `REACT_APP_API_BASE_URL`.
          </div>
        ) : null}
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
  const [expandedVersion, setExpandedVersion] = useState("v1.6.0");
  
  const changelogData = [
    {
      version: "v1.6.0",
      date: "22 marca 2026",
      title: "Stabilizacja i Poprawki Krytyczne",
      changes: [
        "Naprawiono błędy CORS blokujące komunikację między frontendem (Vercel) a backendem (Railway)",
        "Zmieniono weryfikację wersji (Build ID mismatch) na nieblokujące ostrzeżenie – eliminuje błąd 'nieaktualny preview'",
        "Wyeliminowano race conditions przy usuwaniu spotkań poprzez mechanizm wstrzymywania odświeżania (pauseRemotePull)",
        "Oczyszczono osierocone dane w bazie Supabase (media_assets i workspace_state) przywracając spójność",
        "Poprawiono obsługę błędów audio hydration w celu wyeliminowania błędów 404 w konsoli dla starych nagrań",
        "Refaktoryzacja backendu: wydzielenie czystych funkcji do audioPipeline.utils.ts i optymalizacja pipeline'u"
      ]
    },
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
  const [activeCategory, setActiveCategory] = useState("account");

  const categories = [
    { id: 'account', label: 'Profil i Styl pracy', icon: '👤' },
    { id: 'integrations', label: 'Integracje', icon: '🔗' },
    { id: 'tools', label: 'Narzędzia AI', icon: '🛠️' },
    { id: 'system', label: 'Aplikacja i System', icon: '⚙️' }
  ];

    return (
    <div className="profile-layout-container">
      <aside className="profile-sidebar">
        <div className="profile-sidebar-header">
           <div className="eyebrow">Ustawienia</div>
           <h3>Twoje konto</h3>
        </div>
        <nav className="profile-nav">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`profile-nav-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="profile-nav-icon">{cat.icon}</span>
              <span className="profile-nav-label">{cat.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="profile-sidebar-footer">
          <button type="button" className="profile-logout-btn" onClick={onLogout}>
            <span>🚪</span> Wyloguj się
          </button>
        </div>
      </aside>

      <main className="profile-main-content">
        {activeCategory === 'account' && (
          <div className="profile-category-view">
            <section className="profile-hero">
              <div className="profile-hero-main">
                {profileDraft.avatarUrl ? (
                  <img src={profileDraft.avatarUrl} alt={profileDraft.name || currentUser.email} className="profile-avatar-lg" />
                ) : (
                  <div className="profile-avatar-fallback">{(profileDraft.name || currentUser.email || "U").slice(0, 1)}</div>
                )}
                <div>
                  <div className="eyebrow">Profil</div>
                  <h2>{profileDraft.name || "Uzupełnij dane"}</h2>
                  <p>{profileDraft.role || "Bez roli"}{profileDraft.company ? ` @ ${profileDraft.company}` : ""}</p>
                </div>
              </div>
              <div className="profile-hero-side">
                  <div className="profile-stat-card">
                    <span>Email</span>
                    <strong>{currentUser.email}</strong>
                  </div>
                  <div className="profile-stat-card">
                    <span>Typ konta</span>
                    <strong>{currentUser.provider === "google" ? "Google" : "Lokalne"}</strong>
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
                    <span>Imię i nazwisko</span>
                    <input value={profileDraft.name} onChange={(e) => setProfileDraft(p => ({ ...p, name: e.target.value }))} />
                  </label>
                  <label>
                    <span>Rola i Firma</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <input placeholder="Rola" value={profileDraft.role} onChange={(e) => setProfileDraft(p => ({ ...p, role: e.target.value }))} />
                      <input placeholder="Firma" value={profileDraft.company} onChange={(e) => setProfileDraft(p => ({ ...p, company: e.target.value }))} />
                    </div>
                  </label>
                  <label>
                    <span>Bio</span>
                    <textarea rows={3} value={profileDraft.bio} onChange={(e) => setProfileDraft(p => ({ ...p, bio: e.target.value }))} />
                  </label>
                  <button type="submit" className="primary-button">Zapisz profil</button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Security</div>
                    <h2>Hasło</h2>
                  </div>
                </div>
                {canManagePassword ? (
                   <form className="stack-form" onSubmit={updatePassword}>
                      <input type="password" placeholder="Aktualne hasło" value={passwordDraft.currentPassword} onChange={(e) => setPasswordDraft(p => ({...p, currentPassword: e.target.value}))} />
                      <input type="password" placeholder="Nowe hasło" value={passwordDraft.newPassword} onChange={(e) => setPasswordDraft(p => ({...p, newPassword: e.target.value}))} />
                      <button type="submit" className="secondary-button">Zmień hasło</button>
                      {securityMessage && <div className="inline-alert success">{securityMessage}</div>}
                   </form>
                ) : (
                  <div className="inline-alert info">Konto Google - hasło zewnętrzne.</div>
                )}
              </section>

              <section className="panel" style={{ gridColumn: 'span 2' }}>
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Preferences</div>
                    <h2>Styl pracy</h2>
                  </div>
                </div>
                <form className="stack-form" onSubmit={saveProfile}>
                  <div className="toggle-grid">
                    <label className="toggle-card">
                      <input type="checkbox" checked={profileDraft.autoTaskCapture} onChange={e => setProfileDraft(p => ({...p, autoTaskCapture: e.target.checked}))} />
                      <div><strong>Auto task capture</strong><span>Automatycznie wykrywaj zadania.</span></div>
                    </label>
                    <label className="toggle-card">
                      <input type="checkbox" checked={profileDraft.notifyDailyDigest} onChange={e => setProfileDraft(p => ({...p, notifyDailyDigest: e.target.checked}))} />
                      <div><strong>Daily digest</strong><span>Codzienne podsumowanie mailowe.</span></div>
                    </label>
                  </div>
                  <label>
                    <span>Priorytetowe insighty</span>
                    <textarea rows={2} value={profileDraft.preferredInsights} onChange={e => setProfileDraft(p => ({...p, preferredInsights: e.target.value}))} />
                  </label>
                  <button type="submit" className="secondary-button">Zapisz preferencje</button>
                </form>
              </section>
            </div>
          </div>
        )}

        {activeCategory === 'integrations' && (
          <div className="profile-category-view">
            <div className="profile-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Calendar</div>
                    <h2>Google Calendar</h2>
                  </div>
                </div>
                <div className="integration-card">
                  <p>{integrationStatusLabel(googleCalendarStatus, googleCalendarEventsCount)}</p>
                  <div className="button-row">
                    <button type="button" className="primary-button" onClick={connectGoogleCalendar}>Połącz</button>
                    <button type="button" className="ghost-button" onClick={refreshGoogleCalendar}>Sync</button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <h2>Google Tasks</h2>
                  </div>
                </div>
                <div className="integration-card">
                   <select value={selectedGoogleTaskListId || ""} onChange={(e) => onSelectGoogleTaskList?.(e.target.value)}>
                      <option value="">Wybierz listę...</option>
                      {googleTaskLists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                   </select>
                   <div className="button-row" style={{ marginTop: '12px' }}>
                      <button type="button" className="secondary-button" onClick={onConnectGoogleTasks}>Połącz</button>
                      <button type="button" className="ghost-button" onClick={onRefreshGoogleTasks}>Sync</button>
                   </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeCategory === 'tools' && (
          <div className="profile-category-view">
             <div className="profile-grid">
                <VoiceProfilesSection />
                <VocabularyManagerSection vocabulary={vocabulary} onUpdateVocabulary={onUpdateVocabulary} />
                <TagManagerSection allTags={allTags} onRenameTag={onRenameTag} onDeleteTag={onDeleteTag} />
             </div>
          </div>
        )}

        {activeCategory === 'system' && (
          <div className="profile-category-view">
            <div className="profile-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div><div className="eyebrow">Settings</div><h2>Wygląd i Layout</h2></div>
                </div>
                <div className="stack-form">
                   <div className="integration-row">
                      <span>Motyw: <strong>{theme}</strong></span>
                      <div className="button-row">
                        <button type="button" className="ghost-button" onClick={() => onSetTheme("dark")}>🌙</button>
                        <button type="button" className="ghost-button" onClick={() => onSetTheme("light")}>☀️</button>
                        <button type="button" className="ghost-button" onClick={() => onSetTheme("beaver")}>🦫</button>
                      </div>
                   </div>
                   <div className="integration-row">
                      <span>Zagęszczenie: <strong>{layoutPreset}</strong></span>
                      <div className="button-row">
                        <button type="button" className="ghost-button" onClick={() => onSetLayoutPreset?.("default")}>Default</button>
                        <button type="button" className="ghost-button" onClick={() => onSetLayoutPreset?.("compact")}>Compact</button>
                      </div>
                   </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div><div className="eyebrow">Status</div><h2>Połączenie API</h2></div>
                  <span className={typeof navigator !== "undefined" && navigator.onLine ? "status-chip success" : "status-chip danger"}>
                    {typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="integration-card">
                   <p>Base URL: <code>{apiBaseUrl || "localhost:3000"}</code></p>
                   <p>Rola: <strong>{workspaceRole}</strong></p>
                </div>
              </section>

              <section className="panel" style={{ gridColumn: 'span 2' }}>
                <ChangelogSection />
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
