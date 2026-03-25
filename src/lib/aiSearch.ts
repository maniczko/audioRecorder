import { apiRequest } from '../services/httpClient';
import type { AiSearchItem, AiSearchResponse } from '../shared/contracts';

type CacheEntry = Promise<AiSearchResponse>;

const searchCache = new Map<string, CacheEntry>();

function normalizeItems(items: AiSearchItem[] = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || ''),
      title: String(item?.title || '').trim(),
      subtitle: String(item?.subtitle || '').trim(),
      type: String(item?.type || '').trim(),
      group: String(item?.group || '').trim(),
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.title));
}

function buildCacheKey(query: string, items: AiSearchItem[]) {
  const normalizedItems = normalizeItems(items);
  return JSON.stringify({
    query: String(query || '')
      .trim()
      .toLowerCase(),
    items: normalizedItems.map((item) => [
      item.id,
      item.title,
      item.subtitle,
      item.type,
      item.group,
    ]),
  });
}

export async function semanticSearch(
  query: string,
  items: AiSearchItem[] = []
): Promise<AiSearchResponse> {
  const normalizedQuery = String(query || '').trim();
  const normalizedItems = normalizeItems(items);

  if (normalizedQuery.length < 2 || !normalizedItems.length) {
    return { mode: 'no-key', matches: [] };
  }

  const cacheKey = buildCacheKey(normalizedQuery, normalizedItems);
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  const request = apiRequest('/ai/search', {
    method: 'POST',
    body: {
      query: normalizedQuery,
      items: normalizedItems,
    },
  }) as Promise<AiSearchResponse>;

  const guardedRequest = request.catch((error) => {
    searchCache.delete(cacheKey);
    throw error;
  });

  searchCache.set(cacheKey, guardedRequest);
  return guardedRequest;
}

export function clearSemanticSearchCache() {
  searchCache.clear();
}
