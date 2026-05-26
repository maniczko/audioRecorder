import type { WorkspaceStatePayload } from '../shared/contracts';

interface PersistDeletedMeetingRemoteStateOptions {
  stateService: {
    mode?: string;
    syncWorkspaceState?: (workspaceId: string, payload: WorkspaceStatePayload) => Promise<unknown>;
  };
  currentWorkspaceId: string;
  payload: WorkspaceStatePayload;
  setWorkspaceMessage: (message: string) => void;
}

export async function persistDeletedMeetingRemoteState({
  stateService,
  currentWorkspaceId,
  payload,
  setWorkspaceMessage,
}: PersistDeletedMeetingRemoteStateOptions) {
  if (stateService?.mode !== 'remote' || !currentWorkspaceId) {
    return;
  }

  try {
    await stateService.syncWorkspaceState?.(currentWorkspaceId, payload);
  } catch (error: any) {
    console.warn('Immediate workspace sync after delete failed:', error);
    const message = error?.message || 'Nie udalo sie zapisac usuniecia spotkania na backendzie.';
    setWorkspaceMessage(message);
    throw error;
  }
}
