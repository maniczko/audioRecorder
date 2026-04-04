import React, { useState } from 'react';
import './styles/modern-layout.css';
import AuthScreen from './AuthScreen';
import AskAIPopover from './shared/AskAIPopover';
import CommandPalette from './CommandPalette';
import TabRouter from './TabRouter';
import NotificationCenter from './NotificationCenter';
import { useWorkspaceSelectors } from './store/workspaceStore';
import { useAuthStore } from './store/authStore';
import { useRecorderCtx } from './context/RecorderContext';
import useUI from './hooks/useUI';
import { useHotkeys } from './hooks/useHotkeys';
import { useGoogleCtx } from './context/GoogleContext';
import { SkeletonBanner, SkeletonList } from './components/Skeleton';
import {
  AudioLines,
  Layers,
  CalendarDays,
  ListTodo,
  UsersRound,
  Search,
  Play,
  Square,
  Brain,
  Menu,
  X,
} from 'lucide-react';

export default function AppShellModern({ calendarMonth, setCalendarMonth }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const recorder = useRecorderCtx();
  const ui = useUI();
  const google = useGoogleCtx();
  const [showAskAI, setShowAskAI] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  useHotkeys([
    { key: '1', ctrlKey: true, handler: () => ui.setActiveTab('studio') },
    { key: '2', ctrlKey: true, handler: () => ui.setActiveTab('recordings') },
    { key: '3', ctrlKey: true, handler: () => ui.setActiveTab('calendar') },
    { key: '4', ctrlKey: true, handler: () => ui.setActiveTab('tasks') },
    { key: '5', ctrlKey: true, handler: () => ui.setActiveTab('people') },
    { key: 'k', ctrlKey: true, handler: () => ui.setCommandPaletteOpen(true) },
    {
      key: 'r',
      ctrlKey: true,
      handler: () => {
        if (recorder.isRecording) {
          recorder.stopRecording();
        } else if (workspace.currentWorkspacePermissions?.canRecordAudio) {
          recorder.startRecording({ adHoc: true });
          ui.setActiveTab('studio');
        }
      },
    },
  ]);

  if (workspace.isHydratingSession && !workspace.currentUser) {
    return (
      <div className="app-shell-modern">
        <div className="modern-sidebar">
          <SkeletonBanner height={64} className="mb-5" />
          <SkeletonList items={5} lines={1} />
        </div>
        <div className="modern-main">
          <div className="modern-header">
            <SkeletonBanner height={32} className="w-30" />
            <SkeletonBanner height={32} className="w-50" />
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
    <div className={`app-shell-modern${sidebarOpen ? ' sidebar-open' : ''}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="modern-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* Sidebar */}
      <aside className="modern-sidebar">
        <div
          className="modern-brand"
          onClick={() => {
            ui.openStudio();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              ui.openStudio();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          title="Strona główna"
        >
          <div className="modern-brand-logo" style={{ color: 'var(--inline-color-accent-strong)' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="36"
              height="36"
              viewBox="0 0 64 64"
              fill="none"
            >
              <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <g strokeWidth="3.8">
                  <path d="M18 18c-3.5 0-6 2.8-6 6.2 0 3.1 2.2 5.7 5.2 6.1" />
                  <path d="M46 18c3.5 0 6 2.8 6 6.2 0 3.1-2.2 5.7-5.2 6.1" />
                  <path d="M20 45V35.5c0-8 5.8-14.5 12-14.5s12 6.5 12 14.5V45" />
                  <path d="M22 29.5c1.9-4.6 5.8-8.6 10-8.6s8.1 4 10 8.6" />
                  <path d="M27.3 35.8c1.3 2.5 3.1 3.8 4.7 3.8 1.6 0 3.4-1.3 4.7-3.8" />
                  <path d="M32 29.8v7.7" />
                  <path d="M28.7 40.2v4.9c0 1.4 1.1 2.5 2.5 2.5h1.6c1.4 0 2.5-1.1 2.5-2.5v-4.9" />
                  <path d="M44.6 40.5c2.9.1 5.2-.9 7-2.7 2.4-2.4 3.4-5.8 3.4-9.6-4 1.3-6.6 3.4-8.3 6.1" />
                  <path d="M22.2 43.8c-2.4-1.1-4.4-2.8-5.8-4.8" />
                  <path d="M41.8 43.8c1.2-.6 2.3-1.3 3.3-2.1" />
                  <path d="M23.4 17.5c2.5-2.3 5.4-4 8.6-4.9 3.3.9 6.2 2.6 8.7 4.9" />
                  <path d="M29 16.5l3 2.1 3-2.1" />
                </g>
                <g fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="24.5" cy="28.3" r="2.1" />
                  <circle cx="39.5" cy="28.3" r="2.1" />
                  <path d="M29 31.8c1.1-1.5 2-2.2 3-2.2s1.9.7 3 2.2c-.8 1.3-1.8 2-3 2s-2.2-.7-3-2Z" />
                  <rect x="29.2" y="40.4" width="2.1" height="6.1" rx="1" />
                  <rect x="32.7" y="40.4" width="2.1" height="6.1" rx="1" />
                </g>
                <g transform="rotate(24 21 49)" fill="none" stroke="currentColor">
                  <path
                    d="M18.4 44.6c0-2.1 1.7-3.8 3.8-3.8 2.1 0 3.8 1.7 3.8 3.8v5.8h-7.6v-5.8Z"
                    strokeWidth="2.8"
                  />
                  <rect x="21" y="50.4" width="2.4" height="6.1" rx="1.2" strokeWidth="1.8" />
                  <path d="M16.4 44.1c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" strokeWidth="2.8" />
                  <path d="M17.8 43.2h8.8" strokeWidth="2.1" />
                  <path d="M18.8 46.1h6.8" strokeWidth="2.1" />
                </g>
              </g>
            </svg>
          </div>
          <h1>VoiceBóbr</h1>
        </div>

        <nav className="modern-nav">
          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'studio' ? 'active' : ''}`}
            onClick={() => {
              ui.openStudio();
              closeSidebar();
            }}
          >
            <AudioLines size={18} />
            Studio
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'recordings' ? 'active' : ''}`}
            onClick={() => {
              ui.setActiveTab('recordings');
              closeSidebar();
            }}
          >
            <Layers size={18} />
            Nagrania
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => {
              ui.setActiveTab('calendar');
              closeSidebar();
            }}
          >
            <CalendarDays size={18} />
            Kalendarz
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              ui.setActiveTab('tasks');
              closeSidebar();
            }}
          >
            <ListTodo size={18} />
            Zadania
          </button>

          <button
            type="button"
            className={`modern-nav-item ${ui.activeTab === 'people' ? 'active' : ''}`}
            onClick={() => {
              ui.setActiveTab('people');
              closeSidebar();
            }}
          >
            <UsersRound size={18} />
            Osoby
          </button>

          <button
            type="button"
            className={`modern-nav-item ${showAskAI ? 'active' : ''}`}
            onClick={() => {
              setShowAskAI(!showAskAI);
              closeSidebar();
            }}
            style={{ marginTop: 'auto', position: 'relative' }}
          >
            <Brain size={18} />
            Zapytaj AI
            {showAskAI && (
              <AskAIPopover
                currentWorkspace={workspace.currentWorkspace}
                onClose={() => setShowAskAI(false)}
              />
            )}
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
            <button
              type="button"
              className="modern-hamburger-btn"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label={sidebarOpen ? 'Zamknij menu' : 'Otwórz menu'}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          <div className="modern-header-right">
            <button className="modern-search-btn" onClick={() => ui.setCommandPaletteOpen(true)}>
              <span className="modern-search-btn-left">
                <Search size={16} />
                <span className="modern-search-text">Szukaj wszędzie...</span>
              </span>
              <span className="modern-search-shortcut">
                <kbd>Ctrl</kbd> + <kbd>K</kbd>
              </span>
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
              className={
                recorder.isRecording
                  ? 'modern-record-btn recording bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_4px_14px_rgba(239,68,68,0.1)] hover:bg-red-500/20'
                  : 'modern-record-btn bg-gradient-to-br from-teal-400 to-sky-400 text-slate-900 shadow-[0_4px_14px_rgba(116,208,191,0.25)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(116,208,191,0.4)]'
              }
              onClick={() => {
                if (recorder.isRecording) {
                  recorder.stopRecording();
                } else {
                  recorder.startRecording({ adHoc: true });
                  ui.setActiveTab('studio');
                }
              }}
              disabled={!workspace.currentWorkspacePermissions?.canRecordAudio}
            >
              <div className="flex items-center gap-2 px-2 py-1">
                {recorder.isRecording ? (
                  <>
                    <Square size={16} className="fill-current text-red-500" />
                    <span className="modern-record-label">Zatrzymaj nagrywanie</span>
                  </>
                ) : (
                  <>
                    <Play size={16} className="fill-current text-slate-900" />
                    <span className="modern-record-label">Rozpocznij nagrywanie</span>
                  </>
                )}
              </div>
            </button>

            <button
              type="button"
              className="ml-2 p-0 border-none bg-transparent rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
              onClick={() => ui.setActiveTab('profile')}
              title="Ustawienia profilu"
            >
              {workspace.currentUser.avatarUrl ? (
                <img
                  src={workspace.currentUser.avatarUrl}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700/50">
                  {workspace.currentUser.name?.[0]?.toUpperCase()}
                </div>
              )}
            </button>
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
