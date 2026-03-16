import { useState } from "react";
import { formatDateTime } from "./lib/storage";

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
  onToggleTheme,
  allTags = [],
  onRenameTag,
  onDeleteTag,
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
                rows="4"
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
                rows="5"
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
              <h2>Motyw</h2>
            </div>
          </div>
          <div className="integration-card">
            <div className="integration-row">
              <div>
                <strong>Motyw interfejsu</strong>
                <p>Aktywny: <strong>{theme === "light" ? "Jasny" : "Ciemny"}</strong></p>
              </div>
              <button type="button" className="ghost-button theme-toggle-btn" onClick={onToggleTheme}>
                {theme === "light" ? "🌙 Ciemny" : "☀️ Jasny"}
              </button>
            </div>
          </div>
        </section>

        <TagManagerSection
          allTags={allTags}
          onRenameTag={onRenameTag}
          onDeleteTag={onDeleteTag}
        />

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
                <p>{typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone) ? "Aplikacja (PWA)" : "Przeglądarka"}</p>
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
