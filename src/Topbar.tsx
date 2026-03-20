import NotificationCenter from "./NotificationCenter";
import { useWorkspaceCtx } from "./context/WorkspaceContext";
import { useGoogleCtx } from "./context/GoogleContext";
import { useRecorderCtx } from "./context/RecorderContext";
import { useUICtx } from "./context/UIContext";
import './TopbarStyles.css';

export default function Topbar() {
  const { workspace } = useWorkspaceCtx();
  const google = useGoogleCtx();
  const recorder = useRecorderCtx();
  const ui = useUICtx();

  return (
    <header className="topbar">
      <div className="topbar-title">
        <div>
          <div className="eyebrow">VoiceLog OS</div>
          <h1>Meeting intelligence studio</h1>
        </div>
        <div className="tab-switcher">
          {ui.canGoBack && (
            <button
              type="button"
              className="tab-back-btn"
              onClick={ui.navigateBack}
              title="Cofnij"
              aria-label="Wróć do poprzedniej zakładki"
            >
              ←
            </button>
          )}
          <button type="button" className={ui.activeTab === "studio" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("studio")} aria-label="Tab Studio">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            <span>Studio</span>
          </button>
          <button type="button" className={ui.activeTab === "recordings" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("recordings")} aria-label="Tab Nagrania">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 19V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M7 21v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/><path d="M11 3v4"/><path d="M15 3v4"/><path d="M3 11h18"/></svg>
            <span>Nagrania</span>
          </button>
          <button type="button" className={ui.activeTab === "calendar" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("calendar")} aria-label="Tab Kalendarz">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            <span>Kalendarz</span>
          </button>
          <button type="button" className={ui.activeTab === "tasks" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("tasks")} aria-label="Tab Zadania">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>Zadania</span>
          </button>
          <button type="button" className={ui.activeTab === "people" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("people")} aria-label="Tab Osoby">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Osoby</span>
          </button>
          <button type="button" className={ui.activeTab === "notes" ? "tab-pill active" : "tab-pill"} onClick={() => ui.setActiveTab("notes")} aria-label="Tab Notatki">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
            <span>Notatki</span>
          </button>
        </div>
      </div>

      <div className="topbar-actions">
        {google.googleEnabled ? <div className="status-chip">Google ready</div> : null}
        <NotificationCenter
          open={ui.notificationCenterOpen}
          unreadCount={ui.unreadNotificationCount}
          items={ui.notificationItems}
          permissionState={ui.notificationPermission}
          browserNotificationsSupported={ui.browserNotificationsSupported}
          onToggle={() => ui.setNotificationCenterOpen((previous) => !previous)}
          onClose={() => ui.setNotificationCenterOpen(false)}
          onRequestPermission={ui.requestBrowserNotificationPermission}
          onDismiss={ui.dismissNotification}
          onActivate={ui.activateNotification}
        />
        <button type="button" className="ghost-button command-palette-launcher" onClick={() => ui.setCommandPaletteOpen(true)}>
          Szukaj
          <span>Ctrl+K</span>
        </button>
        <button
          type="button"
          className={recorder.isRecording ? "topbar-record-btn recording" : "topbar-record-btn"}
          onClick={() => {
            if (recorder.isRecording) {
              recorder.stopRecording();
            } else {
              recorder.startRecording({ adHoc: true });
            }
            ui.setActiveTab("studio");
          }}
          disabled={!workspace.currentWorkspacePermissions?.canRecordAudio}
          title={recorder.isRecording ? "Zatrzymaj nagranie" : "Nagranie ad hoc"}
        >
          <span className="topbar-record-dot" />
          {recorder.isRecording ? "Nagrywam..." : "Nagraj"}
        </button>
        {workspace.availableWorkspaces.length > 1 ? (
          <label className="workspace-switch">
            <span>Workspace</span>
            <select value={workspace.currentWorkspaceId || ""} onChange={(event) => ui.switchWorkspace(event.target.value)}>
              {workspace.availableWorkspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        ) : workspace.currentWorkspace ? (
          <div className="status-chip">{workspace.currentWorkspace.name}</div>
        ) : null}
        <div className="user-card">
          {workspace.currentUser.avatarUrl ? (
            <img src={workspace.currentUser.avatarUrl} alt={workspace.currentUser.name} className="avatar" />
          ) : null}
          <div>
            <strong>{workspace.currentUser.name}</strong>
            {(workspace.currentUser.role && workspace.currentUser.role !== "No role") || workspace.currentUser.provider === "google" ? (
              <span>
                {workspace.currentUser.role || ""}
                {workspace.currentUser.provider === "google" ? " - Google sign-in" : ""}
              </span>
            ) : null}
          </div>
          <button type="button" className="settings-button" aria-label="Otworz ustawienia" onClick={() => ui.setActiveTab("profile")}>
            {"\u2699"}
          </button>
        </div>
      </div>
    </header>
  );
}
