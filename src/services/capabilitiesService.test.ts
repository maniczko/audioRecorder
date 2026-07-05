import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  fetchProductionCapabilities,
  fetchWorkspaceCapabilities,
  fetchWorkspaceFeatureFlags,
  updateWorkspaceFeatureFlags,
} from './capabilitiesService';
import { apiRequest } from './httpClient';

vi.mock('./httpClient', () => ({
  apiRequest: vi.fn(),
}));

describe('capabilitiesService', () => {
  afterEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('fetches the production capability contract without retries storming startup', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ ok: false, status: 'degraded' });

    await expect(fetchProductionCapabilities()).resolves.toEqual({
      ok: false,
      status: 'degraded',
    });
    expect(apiRequest).toHaveBeenCalledWith('/api/capabilities', {
      method: 'GET',
      retries: 1,
    });
  });

  it('Issue #1262 - fetches and updates workspace capability controls', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ ok: true, workspaceFeatureFlags: { sttProvider: 'groq' } })
      .mockResolvedValueOnce({ workspaceId: 'ws 1', featureFlags: { sttProvider: 'auto' } })
      .mockResolvedValueOnce({ featureFlags: { sttProvider: 'disabled' } });

    await expect(fetchWorkspaceCapabilities('ws 1')).resolves.toMatchObject({
      workspaceFeatureFlags: { sttProvider: 'groq' },
    });
    await expect(fetchWorkspaceFeatureFlags('ws 1')).resolves.toMatchObject({
      featureFlags: { sttProvider: 'auto' },
    });
    await expect(
      updateWorkspaceFeatureFlags('ws 1', { sttProvider: 'disabled' })
    ).resolves.toMatchObject({
      featureFlags: { sttProvider: 'disabled' },
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/workspaces/ws%201/capabilities', {
      method: 'GET',
      retries: 1,
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/workspaces/ws%201/feature-flags', {
      method: 'GET',
      retries: 1,
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, '/workspaces/ws%201/feature-flags', {
      method: 'PUT',
      body: { featureFlags: { sttProvider: 'disabled' } },
    });
  });
});
