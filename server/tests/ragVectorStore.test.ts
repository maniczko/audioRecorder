import { describe, test, expect, vi } from 'vitest';
import { RagVectorStore } from '../lib/ragVectorStore.ts';

function makeEmbedder(texts: string[]): number[][] {
  return texts.map((t) => {
    const vec = new Array(4).fill(0);
    for (let i = 0; i < Math.min(t.length, 4); i++) vec[i] = t.charCodeAt(i) / 255;
    return vec;
  });
}

describe('RagVectorStore', () => {
  const baseOptions = (overrides = {}) => ({
    workspaceId: 'ws1',
    db: { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([]) },
    embedTextChunks: vi.fn().mockResolvedValue(makeEmbedder([''])),
    ...overrides,
  });

  test('lc_name returns RagVectorStore', () => {
    expect(RagVectorStore.lc_name()).toBe('RagVectorStore');
  });

  test('_vectorstoreType returns rag', () => {
    const store = new RagVectorStore(baseOptions());
    expect(store._vectorstoreType()).toBe('rag');
  });

  test('uses default topK=15 and minScore=0.1', () => {
    const store = new RagVectorStore(baseOptions());
    expect((store as any).topK).toBe(15);
    expect((store as any).minScore).toBe(0.1);
  });

  test('addVectors saves chunks via saveRagChunks', async () => {
    const saveRagChunks = vi.fn().mockResolvedValue(undefined);
    const store = new RagVectorStore(
      baseOptions({ db: { getAllRagChunksForWorkspace: vi.fn(), saveRagChunks } })
    );
    const ids = await store.addVectors(
      [[0.1, 0.2, 0.3, 0.4]],
      [{ pageContent: 'hello', metadata: { id: 'c1', recording_id: 'r1' } }]
    );
    expect(saveRagChunks).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'c1', text: 'hello' })])
    );
    expect(ids).toEqual(['c1']);
  });

  test('addVectors falls back to saveRagChunk when saveRagChunks not available', async () => {
    const saveRagChunk = vi.fn().mockResolvedValue(undefined);
    const store = new RagVectorStore(
      baseOptions({ db: { getAllRagChunksForWorkspace: vi.fn(), saveRagChunk } })
    );
    await store.addVectors(
      [[0.1, 0.2, 0.3, 0.4]],
      [{ pageContent: 'test', metadata: { id: 'c2' } }]
    );
    expect(saveRagChunk).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
  });

  test('addVectors generates UUID when id not in metadata', async () => {
    const saveRagChunks = vi.fn().mockResolvedValue(undefined);
    const store = new RagVectorStore(
      baseOptions({ db: { getAllRagChunksForWorkspace: vi.fn(), saveRagChunks } })
    );
    await store.addVectors([[0.5, 0.5, 0.5, 0.5]], [{ pageContent: 'no id', metadata: {} }]);
    const saved = saveRagChunks.mock.calls[0][0];
    expect(saved[0].id).toMatch(/^rag_/);
  });

  test('addDocuments embeds content and saves', async () => {
    const saveRagChunks = vi.fn().mockResolvedValue(undefined);
    const embedTextChunks = vi.fn().mockResolvedValue([[0.25, 0.25, 0.25, 0.25]]);
    const store = new RagVectorStore(
      baseOptions({ db: { getAllRagChunksForWorkspace: vi.fn(), saveRagChunks }, embedTextChunks })
    );
    await store.addDocuments([{ pageContent: 'doc content', metadata: { id: 'd1' } }]);
    expect(embedTextChunks).toHaveBeenCalledWith(['doc content']);
    expect(saveRagChunks).toHaveBeenCalled();
  });

  test('similaritySearchVectorWithScore returns empty for empty query', async () => {
    const store = new RagVectorStore(baseOptions());
    const result = await store.similaritySearchVectorWithScore([]);
    expect(result).toEqual([]);
  });

  test('similaritySearchVectorWithScore returns empty when no chunks', async () => {
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([]) };
    const store = new RagVectorStore(baseOptions({ db }));
    const result = await store.similaritySearchVectorWithScore([0.5, 0.5, 0.5, 0.5]);
    expect(result).toEqual([]);
  });

  test('similaritySearchVectorWithScore returns scored documents', async () => {
    const chunk = {
      id: 'c1',
      workspace_id: 'ws1',
      recording_id: 'r1',
      speaker_name: 'Alice',
      text: 'hello world',
      embedding_json: JSON.stringify([0.5, 0.5, 0.5, 0.5]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const store = new RagVectorStore(baseOptions({ db }));
    const result = await store.similaritySearchVectorWithScore([0.5, 0.5, 0.5, 0.5]);
    expect(result).toHaveLength(1);
    const [doc, score] = result[0];
    expect(doc.pageContent).toBe('hello world');
    expect(doc.metadata.id).toBe('c1');
    expect(doc.metadata.recordingId).toBe('r1');
    expect(doc.metadata.speakerName).toBe('Alice');
    expect(score).toBe(1);
  });

  test('similaritySearchVectorWithScore filters by minScore', async () => {
    const chunk = {
      id: 'c1',
      recording_id: 'r1',
      speaker_name: 'A',
      text: 'test',
      embedding_json: JSON.stringify([0.001, 0.001, 0.001, 0.001]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const store = new RagVectorStore(baseOptions({ db, minScore: 0.5 }));
    const result = await store.similaritySearchVectorWithScore([0.9, 0, 0, 0]);
    expect(result).toEqual([]);
  });

  test('similaritySearchVectorWithScore limits to topK', async () => {
    const chunks = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      recording_id: 'r1',
      speaker_name: 'A',
      text: `chunk ${i}`,
      embedding_json: JSON.stringify([0.5, 0.5, 0.5, 0.5]),
    }));
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue(chunks) };
    const store = new RagVectorStore(baseOptions({ db, topK: 3 }));
    const result = await store.similaritySearchVectorWithScore([0.5, 0.5, 0.5, 0.5]);
    expect(result).toHaveLength(3);
  });

  test('similaritySearchVectorWithScore sorts by descending score', async () => {
    const chunks = [
      {
        id: 'low',
        recording_id: 'r1',
        speaker_name: 'A',
        text: 'low',
        embedding_json: JSON.stringify([0.1, 0.9, 0, 0]),
      },
      {
        id: 'high',
        recording_id: 'r1',
        speaker_name: 'A',
        text: 'high',
        embedding_json: JSON.stringify([0.99, 0.01, 0, 0]),
      },
    ];
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue(chunks) };
    const store = new RagVectorStore(baseOptions({ db, minScore: 0 }));
    const result = await store.similaritySearchVectorWithScore([1, 0, 0, 0]);
    expect(result.map(([d]: any) => d.metadata.id)).toEqual(['high', 'low']);
  });

  test('handles invalid embedding_json gracefully', async () => {
    const chunk = {
      id: 'c1',
      recording_id: 'r1',
      speaker_name: 'A',
      text: 'bad embedding',
      embedding_json: 'not json',
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const store = new RagVectorStore(baseOptions({ db }));
    const result = await store.similaritySearchVectorWithScore([0.5, 0.5, 0.5, 0.5]);
    // Score should be -1, which is below minScore=0.1
    expect(result).toEqual([]);
  });

  test('addVectors returns empty for empty inputs', async () => {
    const store = new RagVectorStore(baseOptions());
    const result1 = await store.addVectors([], []);
    expect(result1).toEqual([]);
  });
});
