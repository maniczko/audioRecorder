import { createContext, useContext } from 'react';
import useMicrosoftIntegrations from '../hooks/useMicrosoftIntegrations';
import { useWorkspaceSelectors } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import useMeetings from '../hooks/useMeetings';

type MicrosoftContextValue = ReturnType<typeof useMicrosoftIntegrations>;
const MicrosoftContext = createContext<MicrosoftContextValue | null>(null);

export function MicrosoftProvider({ calendarMonth, children }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const meetings = useMeetings();

  const microsoft = useMicrosoftIntegrations({
    currentUser: workspace.currentUser,
    currentWorkspaceId: workspace.currentWorkspaceId,
    calendarMonth,
    taskColumns: meetings.taskColumns,
    meetingTasks: meetings.meetingTasks,
    manualTasks: meetings.manualTasks,
    setManualTasks: meetings.setManualTasks,
    onMicrosoftProfile: auth.handleMicrosoftProfile,
    onMicrosoftError: auth.setMicrosoftAuthMessage,
  });

  return <MicrosoftContext.Provider value={microsoft}>{children}</MicrosoftContext.Provider>;
}

export function useMicrosoftCtx() {
  const ctx = useContext(MicrosoftContext);
  if (!ctx) {
    throw new Error('useMicrosoftCtx must be used within MicrosoftProvider');
  }
  return ctx;
}
