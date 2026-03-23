import NotificationCenter from "./NotificationCenter";
import { useWorkspaceSelectors } from "./store/workspaceStore";
import { useGoogleCtx } from "./context/GoogleContext";
import { useRecorderCtx } from "./context/RecorderContext";
import useUI from "./hooks/useUI";
import { Cluster } from "./ui/LayoutPrimitives";
import "./TopbarStyles.css";

export default function Topbar() {
  const workspace = useWorkspaceSelectors();
  const google = useGoogleCtx();
  const recorder = useRecorderCtx();
  const ui = useUI();

  return (
    <header className="topbar ui-topbar">
      <div className="topbar-title">
        <div>
          <div className="eyebrow">VoiceLog OS</div>
          <h1>Meeting intelligence studio</h1>
        </div>
      </div>

      <Cluster className="topbar-actions" gap="sm" justify="end">
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
        <button
          type="button"
          className="ghost-button command-palette-launcher"
          onClick={() => ui.setCommandPaletteOpen(true)}
          aria-label="Szukaj"
        >
          Szukaj
          <span>Ctrl+K</span>
        </button>
        <button
          type="button"
          className={recorder.isRecording ? "topbar-record-btn recording" : "topbar-record-btn"}
          onClick={() => {
            if (recorder.isRecording) {
              ui.setActiveTab("studio");
            } else {
              recorder.startRecording({ adHoc: true });
              ui.setActiveTab("studio");
            }
          }}
          disabled={!workspace.currentWorkspacePermissions?.canRecordAudio}
          title={recorder.isRecording ? "Przejdz do aktywnego nagrania" : "Nagranie ad hoc"}
          aria-label={recorder.isRecording ? "Przejdz do aktywnego nagrania" : "Nagraj ad hoc"}
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
      </Cluster>
    </header>
  );
}
