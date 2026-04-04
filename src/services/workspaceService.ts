import { apiRequest } from './httpClient';
import { APP_DATA_PROVIDER } from './config';
import { normalizeWorkspaceRole } from '../lib/permissions';

function updateWorkspaceRoleLocally(workspaces, workspaceId, targetUserId, memberRole) {
  const nextRole = normalizeWorkspaceRole(memberRole);
  return (Array.isArray(workspaces) ? workspaces : []).map((workspace) =>
    workspace.id !== workspaceId
      ? workspace
      : {
          ...workspace,
          memberRoles: {
            ...(workspace.memberRoles || {}),
            [targetUserId]: nextRole,
          },
          updatedAt: new Date().toISOString(),
        }
  );
}

function createLocalWorkspaceService() {
  return {
    mode: 'local',
    updateMemberRole({ workspaces, workspaceId, targetUserId, memberRole }) {
      return Promise.resolve({
        workspaces: updateWorkspaceRoleLocally(workspaces, workspaceId, targetUserId, memberRole),
        membership: {
          workspaceId,
          userId: targetUserId,
          memberRole: normalizeWorkspaceRole(memberRole),
        },
      });
    },
    removeMember({ workspaces, workspaceId, targetUserId }) {
      return Promise.resolve({
        workspaces: (Array.isArray(workspaces) ? workspaces : []).map((ws) =>
          ws.id !== workspaceId
            ? ws
            : {
                ...ws,
                memberIds: (ws.memberIds || []).filter((id) => id !== targetUserId),
                memberRoles: Object.fromEntries(
                  Object.entries(ws.memberRoles || {}).filter(([id]) => id !== targetUserId)
                ),
              }
        ),
      });
    },
  };
}

function createRemoteWorkspaceService() {
  return {
    mode: 'remote',
    async updateMemberRole({ workspaceId, targetUserId, memberRole }) {
      const membership = await apiRequest(
        `/workspaces/${workspaceId}/members/${targetUserId}/role`,
        {
          method: 'PUT',
          body: {
            memberRole: normalizeWorkspaceRole(memberRole),
          },
        }
      );

      return { membership };
    },
    async removeMember({ workspaceId, targetUserId }) {
      await apiRequest(`/workspaces/${workspaceId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      return {};
    },
  };
}

export function createWorkspaceService() {
  return APP_DATA_PROVIDER === 'remote'
    ? createRemoteWorkspaceService()
    : createLocalWorkspaceService();
}
