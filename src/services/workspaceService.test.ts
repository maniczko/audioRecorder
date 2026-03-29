import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiRequest = vi.fn();
let mockAppDataProvider = 'local';

vi.mock('./httpClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

vi.mock('./config', () => ({
  get APP_DATA_PROVIDER() {
    return mockAppDataProvider;
  },
}));

vi.mock('../lib/permissions', () => ({
  normalizeWorkspaceRole: (role: string) =>
    ['owner', 'admin', 'member', 'viewer'].includes(role) ? role : 'member',
}));

import { createWorkspaceService } from './workspaceService';

describe('workspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('local mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'local';
    });

    it('returns mode local', () => {
      expect(createWorkspaceService().mode).toBe('local');
    });

    it('updates memberRole in matching workspace', async () => {
      const workspaces = [
        { id: 'ws-1', memberRoles: { 'u-1': 'member' } },
        { id: 'ws-2', memberRoles: {} },
      ];
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaces,
        workspaceId: 'ws-1',
        targetUserId: 'u-2',
        memberRole: 'admin',
      });

      expect(result.workspaces[0].memberRoles['u-2']).toBe('admin');
      expect(result.workspaces[0].memberRoles['u-1']).toBe('member');
      expect(result.workspaces[1]).toEqual(workspaces[1]);
    });

    it('returns normalized membership object', async () => {
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaces: [{ id: 'ws-1', memberRoles: {} }],
        workspaceId: 'ws-1',
        targetUserId: 'u-5',
        memberRole: 'viewer',
      });

      expect(result.membership).toEqual({
        workspaceId: 'ws-1',
        userId: 'u-5',
        memberRole: 'viewer',
      });
    });

    it('normalizes invalid role to member', async () => {
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaces: [{ id: 'ws-1', memberRoles: {} }],
        workspaceId: 'ws-1',
        targetUserId: 'u-1',
        memberRole: 'superadmin',
      });

      expect(result.membership.memberRole).toBe('member');
      expect(result.workspaces[0].memberRoles['u-1']).toBe('member');
    });

    it('sets updatedAt ISO timestamp on modified workspace', async () => {
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaces: [{ id: 'ws-1', memberRoles: {} }],
        workspaceId: 'ws-1',
        targetUserId: 'u-1',
        memberRole: 'admin',
      });

      expect(result.workspaces[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('handles null/undefined workspaces gracefully', async () => {
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaces: null as any,
        workspaceId: 'ws-1',
        targetUserId: 'u-1',
        memberRole: 'member',
      });

      expect(result.workspaces).toEqual([]);
    });

    it('does not call apiRequest', async () => {
      const service = createWorkspaceService();
      await service.updateMemberRole({
        workspaces: [],
        workspaceId: 'ws-1',
        targetUserId: 'u-1',
        memberRole: 'admin',
      });
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('remote mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'remote';
    });

    it('returns mode remote', () => {
      expect(createWorkspaceService().mode).toBe('remote');
    });

    it('calls PUT with normalized role', async () => {
      mockApiRequest.mockResolvedValue({ workspaceId: 'ws-1', userId: 'u-3', memberRole: 'admin' });
      const service = createWorkspaceService();
      await service.updateMemberRole({
        workspaceId: 'ws-1',
        targetUserId: 'u-3',
        memberRole: 'admin',
      });

      expect(mockApiRequest).toHaveBeenCalledWith('/workspaces/ws-1/members/u-3/role', {
        method: 'PUT',
        body: { memberRole: 'admin' },
      });
    });

    it('returns membership from server response', async () => {
      const serverResponse = { workspaceId: 'ws-1', userId: 'u-3', memberRole: 'admin' };
      mockApiRequest.mockResolvedValue(serverResponse);
      const service = createWorkspaceService();
      const result = await service.updateMemberRole({
        workspaceId: 'ws-1',
        targetUserId: 'u-3',
        memberRole: 'admin',
      });

      expect(result.membership).toEqual(serverResponse);
      expect(result).not.toHaveProperty('workspaces');
    });

    it('normalizes invalid role before sending to API', async () => {
      mockApiRequest.mockResolvedValue({});
      const service = createWorkspaceService();
      await service.updateMemberRole({
        workspaceId: 'ws-1',
        targetUserId: 'u-1',
        memberRole: 'god-mode',
      });

      expect(mockApiRequest).toHaveBeenCalledWith('/workspaces/ws-1/members/u-1/role', {
        method: 'PUT',
        body: { memberRole: 'member' },
      });
    });
  });
});
