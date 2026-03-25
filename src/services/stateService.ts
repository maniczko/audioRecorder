import { apiRequest } from './httpClient';
import { APP_DATA_PROVIDER } from './config';
import type { WorkspaceStateDeltaPayload, WorkspaceStatePayload } from '../shared/contracts';

function createLocalStateService() {
  return {
    mode: 'local',
    bootstrap() {
      return Promise.resolve(null);
    },
    syncWorkspaceState() {
      return Promise.resolve(null);
    },
  };
}

function createRemoteStateService() {
  return {
    mode: 'remote',
    bootstrap(workspaceId) {
      const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      return apiRequest(`/state/bootstrap${query}`, {
        method: 'GET',
      });
    },
    syncWorkspaceState(
      workspaceId: string,
      state: WorkspaceStatePayload | WorkspaceStateDeltaPayload
    ) {
      return apiRequest(`/state/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: state,
      });
    },
  };
}

export function createStateService() {
  return APP_DATA_PROVIDER === 'remote' ? createRemoteStateService() : createLocalStateService();
}
