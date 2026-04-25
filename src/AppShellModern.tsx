import { useState } from 'react';
import './styles/modern-layout.css';
import AuthScreen from './AuthScreen';
import CommandPalette from './CommandPalette';
import TabRouter from './TabRouter';
import AppHeader from './components/app-shell/AppHeader';
import AppShellSkeleton from './components/app-shell/AppShellSkeleton';
import AppSidebar from './components/app-shell/AppSidebar';
import { useWorkspaceSelectors } from './store/workspaceStore';
import { useAuthStore } from './store/authStore';
import { useRecorderCtx } from './context/RecorderContext';
import useUI from './hooks/useUI';
import { useHotkeys } from './hooks/useHotkeys';
import { useGoogleCtx } from './context/GoogleContext';

interface AppShellModernProps {
  calendarMonth: unknown;
  setCalendarMonth: (value: unknown) => void;
}

export default function AppShellModern({ calendarMonth, setCalendarMonth }: AppShellModernProps) {
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
    return <AppShellSkeleton />;
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
      {sidebarOpen && (
        <div className="modern-sidebar-overlay" onClick={closeSidebar} aria-hidden="true" />
      )}

      <AppSidebar
        activeTab={ui.activeTab}
        showAskAI={showAskAI}
        currentWorkspace={workspace.currentWorkspace}
        currentWorkspaceId={workspace.currentWorkspaceId}
        availableWorkspaces={workspace.availableWorkspaces}
        closeSidebar={closeSidebar}
        openStudio={ui.openStudio}
        setActiveTab={ui.setActiveTab}
        setShowAskAI={setShowAskAI}
        switchWorkspace={ui.switchWorkspace}
      />

      <main className="modern-main">
        <AppHeader
          sidebarOpen={sidebarOpen}
          currentUser={workspace.currentUser}
          canRecordAudio={workspace.currentWorkspacePermissions?.canRecordAudio}
          recorder={recorder}
          notificationCenterOpen={ui.notificationCenterOpen}
          unreadNotificationCount={ui.unreadNotificationCount}
          notificationItems={ui.notificationItems}
          notificationPermission={ui.notificationPermission}
          browserNotificationsSupported={ui.browserNotificationsSupported}
          dismissNotification={ui.dismissNotification}
          activateNotification={ui.activateNotification}
          requestBrowserNotificationPermission={ui.requestBrowserNotificationPermission}
          setActiveTab={ui.setActiveTab}
          setCommandPaletteOpen={ui.setCommandPaletteOpen}
          setNotificationCenterOpen={ui.setNotificationCenterOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="modern-content-wrapper">
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
