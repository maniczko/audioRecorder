import "./App.css";
import "./styles/reset.css";
import "./styles/layout.css";
import "./styles/animations.css";
import "./styles/foundation.css";
import "./styles/studio.css";
import AuthScreen from "./AuthScreen";
import CommandPalette from "./CommandPalette";
import Topbar from "./Topbar";
import TabRouter from "./TabRouter";
import { useWorkspaceSelectors } from "./store/workspaceStore";
import { useAuthStore } from "./store/authStore";
import useUI from "./hooks/useUI";
import { useGoogleCtx } from "./context/GoogleContext";
import { SkeletonBanner, SkeletonList } from "./components/Skeleton";
import { PageShell, Panel, Stack } from "./ui/LayoutPrimitives";

export default function AppShell({ calendarMonth, setCalendarMonth }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const { commandPaletteOpen, setCommandPaletteOpen, commandPaletteItems, handleCommandPaletteSelect } = useUI();
  const google = useGoogleCtx();

  if (workspace.isHydratingSession && !workspace.currentUser) {
    return (
      <PageShell as="div" className="app-shell app-shell-loading">
        <Panel as="div" className="topbar">
          <div className="topbar-title">
            <div>
              <div className="eyebrow">VoiceLog OS</div>
              <h1>Ladowanie srodowiska...</h1>
            </div>
          </div>
        </Panel>
        <div className="workspace-layout">
          <Stack className="workspace-sidebar" gap="lg">
            <SkeletonBanner height={64} />
            <SkeletonList items={4} lines={2} />
          </Stack>
          <Stack className="workspace-main" gap="lg">
            <SkeletonBanner height={120} />
            <div className="main-grid main-grid-skeleton">
              <SkeletonList items={3} lines={3} />
              <SkeletonList items={3} lines={3} />
            </div>
          </Stack>
        </div>
      </PageShell>
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
    <PageShell as="div" className="app-shell">
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
    </PageShell>
  );
}
