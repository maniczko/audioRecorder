import { Menu, Mic, Search, Square, X } from 'lucide-react';
import type { WorkspaceNotificationItem } from '../../lib/notifications';
import NotificationCenter from '../../NotificationCenter';

interface CurrentUser {
  avatarUrl?: string;
  name?: string;
}

interface RecorderControls {
  isRecording: boolean;
  startRecording: (options: { adHoc: boolean }) => void | Promise<void>;
  stopRecording: () => void | Promise<void>;
}

interface AppHeaderProps {
  sidebarOpen: boolean;
  currentUser: CurrentUser;
  activeTab?: string;
  canRecordAudio?: boolean;
  recorder: RecorderControls;
  notificationCenterOpen: boolean;
  unreadNotificationCount: number;
  notificationItems: WorkspaceNotificationItem[];
  notificationPermission: NotificationPermission;
  browserNotificationsSupported: boolean;
  dismissNotification: (id: string) => void;
  activateNotification: (item: WorkspaceNotificationItem) => void;
  requestBrowserNotificationPermission: () => void;
  setActiveTab: (tab: 'studio' | 'profile') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationCenterOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
  setSidebarOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
}

export default function AppHeader({
  sidebarOpen,
  currentUser,
  canRecordAudio,
  recorder,
  notificationCenterOpen,
  unreadNotificationCount,
  notificationItems,
  notificationPermission,
  browserNotificationsSupported,
  dismissNotification,
  activateNotification,
  requestBrowserNotificationPermission,
  setActiveTab,
  setCommandPaletteOpen,
  setNotificationCenterOpen,
  setSidebarOpen,
}: AppHeaderProps) {
  const toggleRecording = () => {
    if (recorder.isRecording) {
      recorder.stopRecording();
      return;
    }

    recorder.startRecording({ adHoc: true });
    setActiveTab('studio');
  };

  const recordingLabel = recorder.isRecording ? 'Zatrzymaj nagrywanie' : 'Nagrywaj';

  return (
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
        <button
          type="button"
          className="modern-search-btn"
          aria-label="Szukaj wszędzie"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <span className="modern-search-btn-left">
            <Search size={16} />
            <span className="modern-search-text">Szukaj wszędzie...</span>
          </span>
          <span className="modern-search-shortcut">
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
          </span>
        </button>

        <NotificationCenter
          open={notificationCenterOpen}
          unreadCount={unreadNotificationCount}
          items={notificationItems}
          permissionState={notificationPermission}
          browserNotificationsSupported={browserNotificationsSupported}
          onToggle={() => setNotificationCenterOpen((prev) => !prev)}
          onClose={() => setNotificationCenterOpen(false)}
          onRequestPermission={requestBrowserNotificationPermission}
          onDismiss={dismissNotification}
          onActivate={activateNotification}
        />

        <button
          className={
            recorder.isRecording
              ? 'modern-record-btn recording bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_4px_14px_rgba(239,68,68,0.1)] hover:bg-red-500/20'
              : 'modern-record-btn modern-record-btn--compact text-teal-700'
          }
          type="button"
          onClick={toggleRecording}
          disabled={!canRecordAudio}
          aria-label={recordingLabel}
          title={recordingLabel}
        >
          <div className="flex items-center gap-2 px-2 py-1">
            {recorder.isRecording ? (
              <>
                <Square size={16} className="fill-current text-red-500" />
                <span className="modern-record-label">{recordingLabel}</span>
              </>
            ) : (
              <>
                <Mic size={16} className="text-teal-700" />
                <span className="modern-record-label">{recordingLabel}</span>
              </>
            )}
          </div>
        </button>

        <button
          type="button"
          className="ml-2 p-0 border-none bg-transparent rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
          onClick={() => setActiveTab('profile')}
          aria-label="Otwórz profil"
          title="Ustawienia profilu"
        >
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt="Avatar"
              className="w-8 h-8 rounded-full border border-slate-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm border border-slate-700/50">
              {currentUser.name?.[0]?.toUpperCase()}
            </div>
          )}
        </button>
      </div>
    </header>
  );
}
