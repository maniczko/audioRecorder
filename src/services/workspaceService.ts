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
  };
}

export function createWorkspaceService() {
  return APP_DATA_PROVIDER === 'remote'
    ? createRemoteWorkspaceService()
    : createLocalWorkspaceService();
}
