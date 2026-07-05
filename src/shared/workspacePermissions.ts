export const WORKSPACE_ROLES = ['owner', 'admin', 'operator', 'member', 'viewer', 'auditor'];

export const WORKSPACE_PERMISSIONS = [
  'workspace:state:read',
  'workspace:state:write',
  'workspace:retention:manage',
  'workspace:export',
  'workspace:audit:read',
  'workspace:members:manage',
  'workspace:members:remove',
  'recordings:read',
  'recordings:upload',
  'recordings:download',
  'recordings:delete',
  'recordings:process',
  'ai:analyze',
  'voice-profiles:read',
  'voice-profiles:create',
  'voice-profiles:manage',
  'quota:read',
  'storage:cleanup',
];

const ROLE_PERMISSION_MATRIX = {
  owner: WORKSPACE_PERMISSIONS,
  admin: WORKSPACE_PERMISSIONS.filter((permission) => permission !== 'workspace:members:remove'),
  operator: [
    'workspace:state:read',
    'workspace:state:write',
    'workspace:audit:read',
    'recordings:read',
    'recordings:upload',
    'recordings:download',
    'recordings:process',
    'ai:analyze',
    'voice-profiles:read',
    'voice-profiles:create',
    'quota:read',
  ],
  member: [
    'workspace:state:read',
    'workspace:state:write',
    'recordings:read',
    'recordings:upload',
    'recordings:download',
    'recordings:process',
    'ai:analyze',
    'voice-profiles:read',
    'voice-profiles:create',
  ],
  viewer: ['workspace:state:read', 'recordings:read', 'recordings:download', 'voice-profiles:read'],
  auditor: ['workspace:state:read', 'workspace:audit:read', 'recordings:read'],
};

function roleValue(role) {
  return String(role || '')
    .trim()
    .toLowerCase();
}

export function normalizeWorkspaceRole(role) {
  const normalized = roleValue(role);
  return WORKSPACE_ROLES.includes(normalized) ? normalized : 'member';
}

export function readWorkspaceRole(membership, fallback = 'member') {
  if (membership && typeof membership === 'object') {
    return normalizeWorkspaceRole(
      membership.member_role ||
        membership.memberRole ||
        membership.workspaceMemberRole ||
        membership.role ||
        fallback
    );
  }
  return normalizeWorkspaceRole(fallback);
}

export function workspaceRoleCan(role, permission) {
  const normalizedRole = normalizeWorkspaceRole(role);
  return (ROLE_PERMISSION_MATRIX[normalizedRole] || []).includes(permission);
}

export function workspaceMembershipCan(membership, permission, fallbackRole = 'member') {
  return workspaceRoleCan(readWorkspaceRole(membership, fallbackRole), permission);
}

export function getWorkspacePermissions(role) {
  const normalizedRole = normalizeWorkspaceRole(role);

  return {
    role: normalizedRole,
    canEditWorkspace: workspaceRoleCan(normalizedRole, 'workspace:state:write'),
    canDeleteWorkspaceItems: workspaceRoleCan(normalizedRole, 'recordings:delete'),
    canExportWorkspaceData: workspaceRoleCan(normalizedRole, 'workspace:export'),
    canManageWorkspaceRoles: workspaceRoleCan(normalizedRole, 'workspace:members:manage'),
    canRemoveWorkspaceMembers: workspaceRoleCan(normalizedRole, 'workspace:members:remove'),
    canRecordAudio: workspaceRoleCan(normalizedRole, 'recordings:upload'),
    canReadAuditLogs: workspaceRoleCan(normalizedRole, 'workspace:audit:read'),
    canRunAiAnalysis: workspaceRoleCan(normalizedRole, 'ai:analyze'),
  };
}
