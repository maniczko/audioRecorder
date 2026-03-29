import { getWorkspacePermissions, normalizeWorkspaceRole, WORKSPACE_ROLES } from './permissions';

describe('workspace permissions', () => {
  test('normalizes unknown roles to member', () => {
    expect(normalizeWorkspaceRole('viewer')).toBe('viewer');
    expect(normalizeWorkspaceRole('something-else')).toBe('member');
    expect(normalizeWorkspaceRole('')).toBe('member');
    expect(normalizeWorkspaceRole(null)).toBe('member');
    expect(normalizeWorkspaceRole(undefined)).toBe('member');
  });

  test('WORKSPACE_ROLES contains all four roles', () => {
    expect(WORKSPACE_ROLES).toEqual(['owner', 'admin', 'member', 'viewer']);
  });

  test('returns read-only permissions for viewer', () => {
    expect(getWorkspacePermissions('viewer')).toEqual({
      role: 'viewer',
      canEditWorkspace: false,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRecordAudio: false,
    });
  });

  test('returns management permissions for owner', () => {
    expect(getWorkspacePermissions('owner')).toEqual({
      role: 'owner',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: true,
      canRecordAudio: true,
    });
  });

  test('returns admin permissions — edit and delete but NOT manage roles', () => {
    const adminPerms = getWorkspacePermissions('admin');
    expect(adminPerms).toEqual({
      role: 'admin',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: false,
      canRecordAudio: true,
    });
  });

  test('returns member permissions — edit but NOT delete', () => {
    const memberPerms = getWorkspacePermissions('member');
    expect(memberPerms).toEqual({
      role: 'member',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: false,
      canRecordAudio: true,
    });
  });

  test('unknown role falls back to member permissions', () => {
    const unknownPerms = getWorkspacePermissions('superadmin');
    expect(unknownPerms).toEqual(getWorkspacePermissions('member'));
  });

  test('each role has exactly 6 permission keys', () => {
    for (const role of WORKSPACE_ROLES) {
      const perms = getWorkspacePermissions(role);
      expect(Object.keys(perms)).toHaveLength(6);
      expect(perms).toHaveProperty('role');
      expect(perms).toHaveProperty('canEditWorkspace');
      expect(perms).toHaveProperty('canDeleteWorkspaceItems');
      expect(perms).toHaveProperty('canExportWorkspaceData');
      expect(perms).toHaveProperty('canManageWorkspaceRoles');
      expect(perms).toHaveProperty('canRecordAudio');
    }
  });

  test('only owner can manage workspace roles', () => {
    for (const role of WORKSPACE_ROLES) {
      const perms = getWorkspacePermissions(role);
      if (role === 'owner') {
        expect(perms.canManageWorkspaceRoles).toBe(true);
      } else {
        expect(perms.canManageWorkspaceRoles).toBe(false);
      }
    }
  });
});
