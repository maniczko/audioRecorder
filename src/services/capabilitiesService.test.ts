import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchProductionCapabilities } from './capabilitiesService';
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
});
