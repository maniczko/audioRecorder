import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolveWorkspaceForUser, workspaceMembers } from "../lib/workspace";
import { getWorkspacePermissions } from "../lib/permissions";
import { createWorkspaceService } from "../services/workspaceService";
import { createStateService } from "../services/stateService";
import {
  clearPersistedSession,
  syncLegacySessionFromWorkspaceSession,
  type WorkspaceSession,
} from "../lib/sessionStorage";

interface WorkspaceState {
  users: any[];
  workspaces: any[];
  session: WorkspaceSession | null;
  isHydratingSession: boolean;
  sessionError: string;
  setUsers: (users: any[] | ((prev: any[]) => any[])) => void;
  setWorkspaces: (workspaces: any[] | ((prev: any[]) => any[])) => void;
  setSession: (session: WorkspaceSession | null | ((prev: WorkspaceSession | null) => WorkspaceSession | null)) => void;
  switchWorkspace: (workspaceId: string) => void;
  updateWorkspaceMemberRole: (targetUserId: string, memberRole: string) => Promise<void>;
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
      sessionError: "",

      setUsers: (updater) =>
        set((state) => ({
          users: typeof updater === "function" ? updater(state.users) : updater,
        })),

      setWorkspaces: (updater) =>
        set((state) => ({
          workspaces: typeof updater === "function" ? updater(state.workspaces) : updater,
        })),

      setSession: (updater) =>
        set((state) => {
          const nextSession = typeof updater === "function" ? updater(state.session) : updater;
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
          workspaceId: currentWorkspaceId,
          targetUserId,
          memberRole,
        });

        if (Array.isArray(result?.workspaces)) {
          set({ workspaces: result.workspaces });
        } else {
          set({
            workspaces: workspaces.map((w: any) =>
              w.id !== currentWorkspaceId
                ? w
                : {
                    ...w,
                    memberRoles: {
                      ...(w.memberRoles || {}),
                      [targetUserId]: result?.membership?.memberRole || memberRole,
                    },
                    updatedAt: new Date().toISOString(),
                  }
            ),
          });
        }

        set((state) => ({
          users: state.users.map((u: any) =>
            u.id !== targetUserId
              ? u
              : { ...u, workspaceMemberRole: result?.membership?.memberRole || memberRole }
          ),
        }));
      },

      bootstrapSession: async () => {
        if (stateService.mode !== "remote") return;
        const { session } = get();
        if (!session?.token || !session?.userId) return;

        set({ isHydratingSession: true, sessionError: "" });
        try {
          const result = await stateService.bootstrap(session.workspaceId);
          if (!result) return;

          const updates: any = {};
          if (Array.isArray(result.users)) updates.users = result.users;
          if (Array.isArray(result.workspaces)) updates.workspaces = result.workspaces;
          if (result.workspaceId && result.workspaceId !== session.workspaceId) {
            updates.session = persistSessionSnapshot({ ...session, workspaceId: result.workspaceId });
          }
          set(updates);
        } catch (error: any) {
          if (error.status === 401) {
            clearPersistedSession();
            set({ session: null, users: [], workspaces: [] });
          } else {
            set({ sessionError: error.message });
          }
        } finally {
          set({ isHydratingSession: false });
        }
      },
      
      logout: () => {
        clearPersistedSession();
        set({ session: null });
      }
    }),
    {
      name: "voicelog_workspace_store",
      partialize: (state) => ({
        users: state.users,
        workspaces: state.workspaces,
        session: state.session,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.session?.token) {
          clearPersistedSession();
          return;
        }

        syncLegacySessionFromWorkspaceSession(state.session);
      },
    }
  )
);

export const useWorkspaceSelectors = () => {
  const users = useWorkspaceStore((state) => state.users);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const session = useWorkspaceStore((state) => state.session);
  const isHydratingSession = useWorkspaceStore((state) => state.isHydratingSession);
  const logout = useWorkspaceStore((state) => state.logout);
  const updateWorkspaceMemberRole = useWorkspaceStore((state) => state.updateWorkspaceMemberRole);

  const currentUser = users.find((user) => user.id === session?.userId) || null;
  const currentUserId = currentUser?.id || null;
  const currentWorkspaceId = currentUser
    ? resolveWorkspaceForUser(currentUser, workspaces, session?.workspaceId)
    : null;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;
  const currentWorkspaceMembers = workspaceMembers(users, currentWorkspace);
  const currentWorkspaceRole = currentWorkspace?.memberRole || currentWorkspaceMembers.find((user) => user.id === currentUserId)?.workspaceMemberRole || "member";
  const currentWorkspacePermissions = getWorkspacePermissions(currentWorkspaceRole);
  const availableWorkspaces = currentUser ? workspaces.filter((workspace) => (workspace.memberIds || []).includes(currentUser.id)) : [];

  return {
    currentUser,
    currentUserId,
    currentWorkspaceId,
    currentWorkspace,
    currentWorkspaceMembers,
    currentWorkspaceRole,
    currentWorkspacePermissions,
    availableWorkspaces,
    isHydratingSession,
    logout,
    session,
    updateWorkspaceMemberRole,
  };
};
