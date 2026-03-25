import { getWorkspacePermissions, normalizeWorkspaceRole } from './permissions';

describe('workspace permissions', () => {
  test('normalizes unknown roles to member', () => {
    expect(normalizeWorkspaceRole('viewer')).toBe('viewer');
    expect(normalizeWorkspaceRole('something-else')).toBe('member');
  });

  test('returns read-only permissions for viewer', () => {
    expect(getWorkspacePermissions('viewer')).toMatchObject({
      canEditWorkspace: false,
      canDeleteWorkspaceItems: false,
      canExportWorkspaceData: false,
      canManageWorkspaceRoles: false,
      canRecordAudio: false,
    });
  });

  test('returns management permissions for owner', () => {
    expect(getWorkspacePermissions('owner')).toMatchObject({
      canEditWorkspace: true,
      canDeleteWorkspaceItems: true,
      canExportWorkspaceData: true,
      canManageWorkspaceRoles: true,
      canRecordAudio: true,
    });
  });
});
