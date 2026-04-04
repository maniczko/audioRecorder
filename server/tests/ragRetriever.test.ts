import { describe, test, expect, vi } from 'vitest';
import { RagChunkRetriever } from '../lib/ragRetriever.ts';

function makeEmbedder(texts: string[]): number[][] {
  return texts.map((t) => {
    // Deterministic fake embedding: char codes normalized
    const vec = new Array(4).fill(0);
    for (let i = 0; i < Math.min(t.length, 4); i++) vec[i] = t.charCodeAt(i) / 255;
    return vec;
  });
}

describe('RagChunkRetriever', () => {
  test('returns empty array when no chunks in workspace', async () => {
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([]) };
    const embedTextChunks = vi.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4]]);
    const retriever = new RagChunkRetriever({ workspaceId: 'ws1', db, embedTextChunks });
    const result = await retriever.invoke('query');
    expect(result).toEqual([]);
    expect(db.getAllRagChunksForWorkspace).toHaveBeenCalledWith('ws1');
  });

  test('returns chunks with scores above minScore', async () => {
    const query = 'hello';
    const chunk = {
      id: 'c1',
      recording_id: 'r1',
      speaker_name: 'Alice',
      text: 'hello world',
      embedding_json: JSON.stringify(makeEmbedder(['hello'])[0]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const embedTextChunks = vi.fn().mockResolvedValue(makeEmbedder([query]));
    const retriever = new RagChunkRetriever({ workspaceId: 'ws1', db, embedTextChunks });
    const result = await retriever.invoke(query);
    expect(result).toHaveLength(1);
    expect(result[0].pageContent).toBe('hello world');
    expect(result[0].metadata.id).toBe('c1');
    expect(result[0].metadata.recordingId).toBe('r1');
    expect(result[0].metadata.speakerName).toBe('Alice');
    expect(result[0].metadata.score).toBeGreaterThan(0.9); // identical embeddings = 1.0
  });

  test('filters out chunks below minScore', async () => {
    // Use a zero-vector chunk which will have 0 similarity
    const chunk = {
      id: 'c1',
      recording_id: 'r1',
      speaker_name: 'Alice',
      text: 'hello world',
      embedding_json: JSON.stringify([0, 0, 0, 0]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const embedTextChunks = vi.fn().mockResolvedValue([[0.9, 0.1, 0, 0]]);
    const retriever = new RagChunkRetriever({
      workspaceId: 'ws1',
      db,
      embedTextChunks,
      minScore: 0.1,
    });
    const result = await retriever.invoke('query');
    expect(result).toHaveLength(0);
  });

  test('limits results to topK', async () => {
    const chunks = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      recording_id: 'r1',
      speaker_name: 'Alice',
      text: `chunk ${i}`,
      embedding_json: JSON.stringify([0.5, 0.5, 0.5, 0.5]),
    }));
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue(chunks) };
    const embedTextChunks = vi.fn().mockResolvedValue([[0.5, 0.5, 0.5, 0.5]]);
    const retriever = new RagChunkRetriever({ workspaceId: 'ws1', db, embedTextChunks, topK: 5 });
    const result = await retriever.invoke('query');
    expect(result).toHaveLength(5);
  });

  test('sorts results by descending score', async () => {
    // Use fixed embeddings: query is [1, 0, 0, 0]
    // Chunk scores depend on alignment with query
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
      {
        id: 'mid',
        recording_id: 'r1',
        speaker_name: 'A',
        text: 'mid',
        embedding_json: JSON.stringify([0.5, 0.5, 0, 0]),
      },
    ];
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue(chunks) };
    const embedTextChunks = vi.fn().mockResolvedValue([[1, 0, 0, 0]]);
    const retriever = new RagChunkRetriever({
      workspaceId: 'ws1',
      db,
      embedTextChunks,
      minScore: 0,
    });
    const result = await retriever.invoke('query');
    expect(result.map((r) => r.metadata.id)).toEqual(['high', 'mid', 'low']);
  });

  test('uses default topK=15 and minScore=0.1', async () => {
    const retriever = new RagChunkRetriever({
      workspaceId: 'ws1',
      db: { getAllRagChunksForWorkspace: vi.fn() },
      embedTextChunks: vi.fn(),
    });
    expect((retriever as any).topK).toBe(15);
    expect((retriever as any).minScore).toBe(0.1);
  });

  test('handles zero-norm vectors gracefully', async () => {
    const chunk = {
      id: 'c1',
      recording_id: 'r1',
      speaker_name: 'A',
      text: 'zero',
      embedding_json: JSON.stringify([0, 0, 0, 0]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const embedTextChunks = vi.fn().mockResolvedValue([[0, 0, 0, 0]]);
    const retriever = new RagChunkRetriever({
      workspaceId: 'ws1',
      db,
      embedTextChunks,
      minScore: 0,
    });
    const result = await retriever.invoke('query');
    expect(result).toHaveLength(1);
    expect(result[0].metadata.score).toBe(0); // 0/0 = 0 per cosineSimilarity impl
  });

  test('returns correct Document metadata shape', async () => {
    const chunk = {
      id: 'c42',
      recording_id: 'r99',
      speaker_name: 'Bob',
      text: 'important text',
      embedding_json: JSON.stringify([1, 0, 0, 0]),
    };
    const db = { getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([chunk]) };
    const embedTextChunks = vi.fn().mockResolvedValue([[1, 0, 0, 0]]);
    const retriever = new RagChunkRetriever({ workspaceId: 'ws1', db, embedTextChunks });
    const result = await retriever.invoke('query');
    expect(result[0]).toHaveProperty('pageContent', 'important text');
    expect(result[0].metadata).toEqual({
      id: 'c42',
      recordingId: 'r99',
      speakerName: 'Bob',
      score: 1,
    });
  });
});
