import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { semanticSearch, clearSemanticSearchCache } from './aiSearch';

const mockApiRequest = vi.hoisted(() => vi.fn());

vi.mock('../services/httpClient', () => ({
  apiRequest: mockApiRequest,
}));

describe('aiSearch', () => {
  const sampleItems = [
    { id: '1', title: 'Meeting notes', subtitle: 'Daily standup', type: 'note', group: 'work' },
    { id: '2', title: 'Shopping list', subtitle: '', type: 'list', group: 'personal' },
  ];

  beforeEach(() => {
    clearSemanticSearchCache();
    mockApiRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns no-key mode when query is too short', async () => {
    const result = await semanticSearch('a', sampleItems);
    expect(result).toEqual({ mode: 'no-key', matches: [] });
    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it('returns no-key mode when query is empty', async () => {
    const result = await semanticSearch('', sampleItems);
    expect(result).toEqual({ mode: 'no-key', matches: [] });
  });

  it('returns no-key mode when items are empty', async () => {
    const result = await semanticSearch('test query', []);
    expect(result).toEqual({ mode: 'no-key', matches: [] });
  });

  it('calls apiRequest with correct params', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: ['1'] });

    await semanticSearch('meeting', sampleItems);

    expect(mockApiRequest).toHaveBeenCalledWith('/ai/search', {
      method: 'POST',
      body: {
        query: 'meeting',
        items: expect.arrayContaining([
          expect.objectContaining({ id: '1', title: 'Meeting notes' }),
        ]),
      },
    });
  });

  it('returns API response on success', async () => {
    const expected = { mode: 'semantic', matches: ['1', '2'] };
    mockApiRequest.mockResolvedValue(expected);

    const result = await semanticSearch('meeting notes', sampleItems);
    expect(result).toEqual(expected);
  });

  it('caches results for identical queries', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: ['1'] });

    const r1 = await semanticSearch('meeting', sampleItems);
    const r2 = await semanticSearch('meeting', sampleItems);

    expect(r1).toBe(r2);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('does not cache for different queries', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: [] });

    await semanticSearch('meeting', sampleItems);
    await semanticSearch('shopping', sampleItems);

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });

  it('clears cache on clearSemanticSearchCache', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: [] });

    await semanticSearch('meeting', sampleItems);
    clearSemanticSearchCache();
    await semanticSearch('meeting', sampleItems);

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });

  it('removes cache entry on API error', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network'));

    await expect(semanticSearch('meeting', sampleItems)).rejects.toThrow('network');

    // Cache entry should be removed, so next call hits API again
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: [] });
    const result = await semanticSearch('meeting', sampleItems);
    expect(result.mode).toBe('semantic');
    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });

  it('normalizes items - filters out invalid entries', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: [] });

    const items = [
      { id: '1', title: 'Valid' },
      { id: '', title: 'No ID' },
      { id: '3', title: '' },
      null as any,
    ];

    await semanticSearch('test query', items);

    const callBody = mockApiRequest.mock.calls[0][1].body;
    expect(callBody.items).toHaveLength(1);
    expect(callBody.items[0].id).toBe('1');
  });

  it('trims and lowercases query for cache key', async () => {
    mockApiRequest.mockResolvedValue({ mode: 'semantic', matches: [] });

    await semanticSearch('  Meeting  ', sampleItems);
    await semanticSearch('meeting', sampleItems);

    // Both should resolve to same cache key (trimmed + lowercased)
    // but the actual API query is trimmed (not lowercased)
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('handles null/undefined items gracefully', async () => {
    const result = await semanticSearch('test', undefined as any);
    expect(result).toEqual({ mode: 'no-key', matches: [] });
  });
});
