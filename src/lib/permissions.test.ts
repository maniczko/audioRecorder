import { getWorkspacePermissions, normalizeWorkspaceRole, WORKSPACE_ROLES } from './permissions';

describe('workspace permissions', () => {
  test('normalizes unknown roles to member', () => {
    expect(normalizeWorkspaceRole('viewer')).toBe('viewer');
    expect(normalizeWorkspaceRole('operator')).toBe('operator');
    expect(normalizeWorkspaceRole('auditor')).toBe('auditor');
    expect(normalizeWorkspaceRole('something-else')).toBe('member');
    expect(normalizeWorkspaceRole('')).toBe('member');
    expect(normalizeWorkspaceRole(null)).toBe('member');
    expect(normalizeWorkspaceRole(undefined)).toBe('member');
  });

  test('WORKSPACE_ROLES contains enterprise roles', () => {
    expect(WORKSPACE_ROLES).toEqual(['owner', 'admin', 'operator', 'member', 'viewer', 'auditor']);
  });

  test('returns read-only permissions for viewer', () => {
    expect(getWorkspacePermissions('viewer')).toMatchObject({
      role: 'viewer',
      canEditWorkspace: false,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRemoveWorkspaceMembers: false,
      canRecordAudio: false,
      canReadAuditLogs: false,
      canRunAiAnalysis: false,
    });
  });

  test('returns management permissions for owner', () => {
    expect(getWorkspacePermissions('owner')).toMatchObject({
      role: 'owner',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: true,
      canRemoveWorkspaceMembers: true,
      canRecordAudio: true,
      canReadAuditLogs: true,
      canRunAiAnalysis: true,
    });
  });

  test('returns admin permissions for sensitive actions except member removal', () => {
    expect(getWorkspacePermissions('admin')).toMatchObject({
      role: 'admin',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: true,
      canRemoveWorkspaceMembers: false,
      canRecordAudio: true,
      canReadAuditLogs: true,
      canRunAiAnalysis: true,
    });
  });

  test('returns operator permissions for production operations without admin powers', () => {
    expect(getWorkspacePermissions('operator')).toMatchObject({
      role: 'operator',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRemoveWorkspaceMembers: false,
      canRecordAudio: true,
      canReadAuditLogs: true,
      canRunAiAnalysis: true,
    });
  });

  test('returns member permissions for collaboration without sensitive admin actions', () => {
    expect(getWorkspacePermissions('member')).toMatchObject({
      role: 'member',
      canEditWorkspace: true,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRemoveWorkspaceMembers: false,
      canRecordAudio: true,
      canReadAuditLogs: false,
      canRunAiAnalysis: true,
    });
  });

  test('returns auditor permissions for audit review without content mutation', () => {
    expect(getWorkspacePermissions('auditor')).toMatchObject({
      role: 'auditor',
      canEditWorkspace: false,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRemoveWorkspaceMembers: false,
      canRecordAudio: false,
      canReadAuditLogs: true,
      canRunAiAnalysis: false,
    });
  });

  test('unknown role falls back to member permissions', () => {
    expect(getWorkspacePermissions('superadmin')).toEqual(getWorkspacePermissions('member'));
  });

  test('each role exposes the same permission shape', () => {
    for (const role of WORKSPACE_ROLES) {
      const perms = getWorkspacePermissions(role);
      expect(Object.keys(perms).sort()).toEqual([
        'canDeleteWorkspaceItems',
        'canEditWorkspace',
        'canExportWorkspaceData',
        'canManageWorkspaceRoles',
        'canReadAuditLogs',
        'canRecordAudio',
        'canRemoveWorkspaceMembers',
        'canRunAiAnalysis',
        'role',
      ]);
    }
  });

  test('only owner can remove workspace members', () => {
    for (const role of WORKSPACE_ROLES) {
      expect(getWorkspacePermissions(role).canRemoveWorkspaceMembers).toBe(role === 'owner');
    }
  });
});
