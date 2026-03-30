import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createStateService } from './stateService';

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

describe('stateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('local mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'local';
    });

    it('returns mode local', () => {
      expect(createStateService().mode).toBe('local');
    });

    it('bootstrap resolves to null', async () => {
      const service = createStateService();
      expect(await service.bootstrap('ws-1')).toBeNull();
    });

    it('syncWorkspaceState resolves to null', async () => {
      const service = createStateService();
      expect(await service.syncWorkspaceState('ws-1', { meetings: [] } as any)).toBeNull();
    });

    it('does not call apiRequest', async () => {
      const service = createStateService();
      await service.bootstrap('ws-1');
      await service.syncWorkspaceState('ws-1', {} as any);
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('remote mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'remote';
      mockApiRequest.mockResolvedValue({ ok: true });
    });

    it('returns mode remote', () => {
      expect(createStateService().mode).toBe('remote');
    });

    it('bootstrap calls GET /state/bootstrap with workspaceId', async () => {
      const service = createStateService();
      await service.bootstrap('ws-42');
      expect(mockApiRequest).toHaveBeenCalledWith('/state/bootstrap?workspaceId=ws-42', {
        method: 'GET',
        retries: 3,
      });
    });

    it('bootstrap omits query param when workspaceId is empty', async () => {
      const service = createStateService();
      await service.bootstrap('');
      expect(mockApiRequest).toHaveBeenCalledWith('/state/bootstrap', {
        method: 'GET',
        retries: 3,
      });
    });

    it('bootstrap encodes special characters in workspaceId', async () => {
      const service = createStateService();
      await service.bootstrap('ws with spaces&more');
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/state/bootstrap?workspaceId=ws%20with%20spaces%26more',
        { method: 'GET', retries: 3 }
      );
    });

    it('syncWorkspaceState calls PATCH with body', async () => {
      const service = createStateService();
      const state = { meetings: [{ id: 'm1' }] };
      await service.syncWorkspaceState('ws-7', state as any);
      expect(mockApiRequest).toHaveBeenCalledWith('/state/workspaces/ws-7', {
        method: 'PATCH',
        body: state,
      });
    });

    it('returns apiRequest response from bootstrap', async () => {
      mockApiRequest.mockResolvedValue({ meetings: [], tasks: [] });
      const service = createStateService();
      const result = await service.bootstrap('ws-1');
      expect(result).toEqual({ meetings: [], tasks: [] });
    });
  });
});
