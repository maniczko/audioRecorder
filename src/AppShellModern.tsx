import './styles/modern-layout.css';
import AuthScreen from './AuthScreen';
import CommandPalette from './CommandPalette';
import TabRouter from './TabRouter';
import NotificationCenter from './NotificationCenter';
import { useWorkspaceSelectors } from './store/workspaceStore';
import { useAuthStore } from './store/authStore';
import { useRecorderCtx } from './context/RecorderContext';
import useUI from './hooks/useUI';
import { useGoogleCtx } from './context/GoogleContext';
import { SkeletonBanner, SkeletonList } from './components/Skeleton';
import { Mic, Library, Calendar, CheckSquare, Users } from 'lucide-react';

export default function AppShellModern({ calendarMonth, setCalendarMonth }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const recorder = useRecorderCtx();
  const ui = useUI();
  const google = useGoogleCtx();

  if (workspace.isHydratingSession && !workspace.currentUser) {
    return (
      <div className="app-shell-modern">
        <div className="modern-sidebar">
          <SkeletonBanner height={64} style={{ marginBottom: 20 }} />
          <SkeletonList items={5} lines={1} />
        </div>
        <div className="modern-main">
          <div className="modern-header">
            <SkeletonBanner height={32} style={{ width: 120 }} />
            <SkeletonBanner height={32} style={{ width: 200 }} />
          </div>
          <div className="modern-content-wrapper p-8">
            <SkeletonList items={3} lines={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!workspace.currentUser) {
    return (
      <AuthScreen
        authMode={auth.authMode}
        authDraft={auth.authDraft}
        authError={auth.authError}
        setAuthMode={auth.setAuthMode}
        setAuthDraft={auth.setAuthDraft}
        submitAuth={auth.submitAuth}
        googleEnabled={google.googleEnabled}
        googleButtonRef={google.googleButtonRef}
        googleAuthMessage={auth.googleAuthMessage}
        resetDraft={auth.resetDraft}
        setResetDraft={auth.setResetDraft}
        resetMessage={auth.resetMessage}
        resetPreviewCode={auth.resetPreviewCode}
        resetExpiresAt={auth.resetExpiresAt}
        requestResetCode={auth.requestResetCode}
        completeReset={auth.completeReset}
      />
    );
  }

  return (
    <div className="app-shell-modern">
      {/* Sidebar */}
      <aside className="modern-sidebar">
        <div className="modern-brand">
          <div className="modern-brand-logo">V</div>
          <h1>VoiceLog OS</h1>
        </div>

        <nav className="modern-nav">
          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'studio' ? 'active' : ''}`}
            onClick={ui.openStudio}
          >
            <Mic size={18} />
            Studio
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'recordings' ? 'active' : ''}`}
            onClick={() => ui.setActiveTab('recordings')}
          >
            <Library size={18} />
            Nagrania
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => ui.setActiveTab('calendar')}
          >
            <Calendar size={18} />
            Kalendarz
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => ui.setActiveTab('tasks')}
          >
            <CheckSquare size={18} />
            Zadania
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'people' ? 'active' : ''}`}
            onClick={() => ui.setActiveTab('people')}
          >
            <Users size={18} />
            Osoby
          </button>
        </nav>

        <div className="modern-workspace-selector">
          {workspace.availableWorkspaces.length > 1 ? (
            <select
              value={workspace.currentWorkspaceId || ''}
              onChange={(e) => ui.switchWorkspace(e.target.value)}
            >
              {workspace.availableWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-center text-slate-400">
              {workspace.currentWorkspace?.name}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="modern-main">
        <header className="modern-header">
          <div className="modern-header-left">
            <button className="modern-toggle-layout" onClick={() => ui.setLayoutPreset('default')}>
              ← Wróc do starszego wyglądu
            </button>
          </div>

          <div className="modern-header-right">
            <button className="modern-search-btn" onClick={() => ui.setCommandPaletteOpen(true)}>
              Szukaj <span>Ctrl+K</span>
            </button>

            <NotificationCenter
              open={ui.notificationCenterOpen}
              unreadCount={ui.unreadNotificationCount}
              items={ui.notificationItems}
              permissionState={ui.notificationPermission}
              browserNotificationsSupported={ui.browserNotificationsSupported}
              onToggle={() => ui.setNotificationCenterOpen((prev) => !prev)}
              onClose={() => ui.setNotificationCenterOpen(false)}
              onRequestPermission={ui.requestBrowserNotificationPermission}
              onDismiss={ui.dismissNotification}
              onActivate={ui.activateNotification}
            />

            <button
              className={recorder.isRecording ? 'modern-record-btn recording' : 'modern-record-btn'}
              onClick={() => {
                if (recorder.isRecording) ui.setActiveTab('studio');
                else {
                  recorder.startRecording({ adHoc: true });
                  ui.setActiveTab('studio');
                }
              }}
              disabled={!workspace.currentWorkspacePermissions?.canRecordAudio}
            >
              {recorder.isRecording ? 'Nagrywanie trwa...' : 'Rozpocznij Nagrywanie'}
            </button>

            <div className="ml-2">
              {workspace.currentUser.avatarUrl ? (
                <img
                  src={workspace.currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm">
                  {workspace.currentUser.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="modern-content-wrapper">
          {/* Re-use the existing TabRouter. It handles its own scroll containers usually, or we wrap it */}
          <TabRouter calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
        </div>
      </main>

      <CommandPalette
        open={ui.commandPaletteOpen}
        items={ui.commandPaletteItems}
        onClose={() => ui.setCommandPaletteOpen(false)}
        onSelect={ui.handleCommandPaletteSelect}
      />
    </div>
  );
}
