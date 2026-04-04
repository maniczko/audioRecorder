```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveWorkspaceForUser, workspaceMembers } from '../lib/workspace';
import { getWorkspacePermissions } from '../lib/permissions';
import { createWorkspaceService } from '../services/workspaceService';
import { createStateService } from '../services/stateService';
import {
  clearPersistedSession,
  syncLegacySessionFromWorkspaceSession,
  type WorkspaceSession,
} from '../lib/sessionStorage';

interface WorkspaceState {
  users: any[];
  workspaces: any[];
  session: WorkspaceSession | null;
  isHydratingSession: boolean;
  sessionError: string;
  setUsers: (users: any[] | ((prev: any[]) => any[])) => void;
  setWorkspaces: (workspaces: any[] | ((prev: any[]) => any[])) => void;
  setSession: (
    session: WorkspaceSession | null | ((prev: WorkspaceSession | null) => WorkspaceSession | null)
  ) => void;
  switchWorkspace: (workspaceId: string) => void;
  updateWorkspaceMemberRole: (targetUserId: string, memberRole: string) => Promise<void>;
  removeWorkspaceMember: (targetUserId: string) => Promise<void>;
  bootstrapSession: () => Promise<void>;
  logout: () => void;
}

const workspaceService = createWorkspaceService() as any;
const stateService = createStateService();

function persistSessionSnapshot(session: WorkspaceSession | null) {
  return syncLegacySessionFromWorkspaceSession(session);
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      users: [],
      workspaces: [],
      session: null,
      isHydratingSession: false,
      sessionError: '',

      setUsers: (updater) =>
        set((state) => ({
          users: typeof updater === 'function' ? updater(state.users) : updater,
        })),

      setWorkspaces: (updater) =>
        set((state) => ({
          workspaces: typeof updater === 'function' ? updater(state.workspaces) : updater,
        })),

      setSession: (updater) =>
        set((state) => {
          const nextSession = typeof updater === 'function' ? updater(state.session) : updater;
          persistSessionSnapshot(nextSession);
          return {
            session: nextSession,
          };
        }),

      switchWorkspace: (workspaceId) => {
        const { session } = get();
        if (!workspaceId || workspaceId === session?.workspaceId) return;
        const nextSession = persistSessionSnapshot({ ...session, workspaceId });
        set({ session: nextSession });
      },

      updateWorkspaceMemberRole: async (targetUserId, memberRole) => {
        const { workspaces, session, users } = get();

        const currentUser = users.find((u) => u.id === session?.userId) || null;
        const currentWorkspaceId = currentUser
          ? resolveWorkspaceForUser(currentUser, workspaces, session?.workspaceId)
          : null;

        if (!currentWorkspaceId || !targetUserId) return;

        const result = await workspaceService.updateMemberRole({
          workspaces,
          currentWorkspaceId,
          targetUserId,
          memberRole,
        });
        // Handle result if necessary
      },

      removeWorkspaceMember: async (targetUserId) => {
        const { workspaces, session, users } = get();

        const currentUser = users.find((u) => u.id === session?.userId) || null;
        const currentWorkspaceId = currentUser
          ? resolveWorkspaceForUser(currentUser, workspaces, session?.workspaceId)
          : null;

        if (!currentWorkspaceId || !targetUserId) return;

        await workspaceService.removeMember({
          workspaces,
          currentWorkspaceId,
          targetUserId,
        });
      },

      bootstrapSession: async () => {
        // Implementation for bootstrapping session
      },

      logout: () => {
        clearPersistedSession();
        set({ session: null });
      },
    }),
    { name: 'workspace-storage' }
  )
);
```
