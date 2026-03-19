import "./App.css";
import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/layout.css";
import "./styles/animations.css";
import "./styles/studio.css";
import AuthScreen from "./AuthScreen";
import CommandPalette from "./CommandPalette";
import Topbar from "./Topbar";
import TabRouter from "./TabRouter";
import { useWorkspaceCtx } from "./context/WorkspaceContext";
import { useUICtx } from "./context/UIContext";
import { useGoogleCtx } from "./context/GoogleContext";
import { SkeletonBanner, SkeletonList } from "./components/Skeleton";

export default function AppShell({ calendarMonth, setCalendarMonth }) {
  const { workspace, auth } = useWorkspaceCtx();
  const { commandPaletteOpen, setCommandPaletteOpen, commandPaletteItems, handleCommandPaletteSelect } = useUICtx();
  const google = useGoogleCtx();

  if (workspace.isHydratingSession) {
    return (
      <div className="app-shell app-shell-loading">
        <div className="topbar">
          <div className="topbar-title">
            <div>
              <div className="eyebrow">VoiceLog OS</div>
              <h1>Ładowanie środowiska...</h1>
            </div>
          </div>
        </div>
        <div className="workspace-layout">
          <div className="workspace-sidebar">
             <SkeletonBanner height={64} />
             <SkeletonList items={4} lines={2} />
          </div>
          <div className="workspace-main">
             <SkeletonBanner height={120} />
             <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
                <SkeletonList items={3} lines={3} />
                <SkeletonList items={3} lines={3} />
             </div>
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
    <div className="app-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <Topbar />

      <TabRouter calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />

      <CommandPalette
        open={commandPaletteOpen}
        items={commandPaletteItems}
        onClose={() => setCommandPaletteOpen(false)}
        onSelect={handleCommandPaletteSelect}
      />
    </div>
  );
}
