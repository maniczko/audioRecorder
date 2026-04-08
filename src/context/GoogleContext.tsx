import { createContext, useContext } from 'react';
import useGoogleIntegrations from '../hooks/useGoogleIntegrations';
import { useWorkspaceSelectors } from '../store/workspaceStore';
import { useAuthStore } from '../store/authStore';
import useMeetings from '../hooks/useMeetings';

type GoogleContextValue = ReturnType<typeof useGoogleIntegrations>;

const defaultGoogleCtx = {
  googleCalendarConnected: false,
  googleTasksConnected: false,
  connectGoogleCalendar: async () => { },
  connectGoogleTasks: async () => { },
  disconnectGoogle: async () => { },
  googleCalendarEvents: [],
  googleTaskLists: [],
  selectedGoogleTaskListId: '',
  setSelectedGoogleTaskListId: () => { },
  resolveGoogleTaskConflict: async () => { },
  isGoogleLoading: false,
  googleError: null,
  setGoogleAuthMessage: () => { },
  handleGoogleProfile: async () => { },
  googleAuthMessage: '',
} as unknown as GoogleContextValue;

const GoogleContext = createContext<GoogleContextValue>(defaultGoogleCtx);

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
  return useContext(GoogleContext);
}
