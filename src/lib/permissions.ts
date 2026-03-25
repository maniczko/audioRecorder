export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'];

export function normalizeWorkspaceRole(role) {
  return WORKSPACE_ROLES.includes(String(role || '')) ? role : 'member';
}

export function getWorkspacePermissions(role) {
  const normalizedRole = normalizeWorkspaceRole(role);

  if (normalizedRole === 'owner') {
    return {
      role: normalizedRole,
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: true,
      canRecordAudio: true,
    };
  }

  if (normalizedRole === 'admin') {
    return {
      role: normalizedRole,
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: false,
      canRecordAudio: true,
    };
  }

  if (normalizedRole === 'viewer') {
    return {
      role: normalizedRole,
      canEditWorkspace: false,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRecordAudio: false,
    };
  }

  return {
    role: normalizedRole,
    canEditWorkspace: true,
    canDeleteWorkspaceItems: false,
    canExportWorkspaceData: true,
    canManageWorkspaceRoles: false,
    canRecordAudio: true,
  };
}
