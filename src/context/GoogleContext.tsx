import { createContext, useContext } from 'react';
import useGoogleIntegrations from '../hooks/useGoogleIntegrations';
import { useWorkspaceSelectors } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import useMeetings from '../hooks/useMeetings';

type GoogleContextValue = ReturnType<typeof useGoogleIntegrations>;
const GoogleContext = createContext<GoogleContextValue | null>(null);

export function GoogleProvider({ calendarMonth, children }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const meetings = useMeetings();

  const google = useGoogleIntegrations({
    currentUser: workspace.currentUser,
    currentWorkspaceId: workspace.currentWorkspaceId,
    calendarMonth,
    taskColumns: meetings.taskColumns,
    meetingTasks: meetings.meetingTasks,
    manualTasks: meetings.manualTasks,
    setManualTasks: meetings.setManualTasks,
    onGoogleProfile: auth.handleGoogleProfile,
    onGoogleError: auth.setGoogleAuthMessage,
  });

  return <GoogleContext.Provider value={google}>{children}</GoogleContext.Provider>;
}

export function useGoogleCtx() {
  const ctx = useContext(GoogleContext);
  if (!ctx) {
    throw new Error('useGoogleCtx must be used within GoogleProvider');
  }
  return ctx;
}
