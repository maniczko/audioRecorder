import crypto from 'node:crypto';
import { Document, type DocumentInterface } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';

type RagChunkRow = {
  id: string;
  workspace_id?: string;
  recording_id: string;
  speaker_name: string;
  text: string;
  embedding_json: string;
  created_at?: string;
};

type RagVectorStoreOptions = {
  workspaceId: string;
  db: {
    getAllRagChunksForWorkspace(workspaceId: string): Promise<RagChunkRow[]>;
    saveRagChunk?(chunk: {
      id: string;
      workspaceId: string;
      recordingId: string;
      speakerName: string;
      text: string;
      embedding: number[];
      createdAt: string;
    }): Promise<void>;
    saveRagChunks?(
      chunks: Array<{
        id: string;
        workspaceId: string;
        recordingId: string;
        speakerName: string;
        text: string;
        embedding: number[];
        createdAt: string;
      }>
    ): Promise<void>;
  };
  embedTextChunks: (texts: string[]) => Promise<number[][]>;
  topK?: number;
  minScore?: number;
};

function dotProduct(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(a: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function buildDocument(row: RagChunkRow, score: number) {
  return new Document({
    pageContent: row.text || '',
    metadata: {
      id: row.id,
      workspaceId: row.workspace_id || '',
      recordingId: row.recording_id || '',
      speakerName: row.speaker_name || '',
      score,
    },
  });
}

class FunctionEmbeddingsAdapter implements EmbeddingsInterface {
  private embedTextChunks: (texts: string[]) => Promise<number[][]>;

  constructor(embedTextChunks: (texts: string[]) => Promise<number[][]>) {
    this.embedTextChunks = embedTextChunks;
  }

  async embedDocuments(documents: string[]) {
    return this.embedTextChunks(documents);
  }

  async embedQuery(document: string) {
    const [vector] = await this.embedTextChunks([document]);
    return vector || [];
  }
}

export class RagVectorStore extends VectorStore {
  private workspaceId: string;
  private db: RagVectorStoreOptions['db'];
  private topK: number;
  private minScore: number;

  constructor(options: RagVectorStoreOptions) {
    super(new FunctionEmbeddingsAdapter(options.embedTextChunks), {});
    this.workspaceId = options.workspaceId;
    this.db = options.db;
    this.topK = options.topK ?? 15;
    this.minScore = options.minScore ?? 0.1;
  }

  static lc_name() {
    return 'RagVectorStore';
  }

  _vectorstoreType() {
    return 'rag';
  }

  async addVectors(vectors: number[][], documents: DocumentInterface[]) {
    if (
      !Array.isArray(vectors) ||
      !Array.isArray(documents) ||
      !vectors.length ||
      !documents.length
    ) {
      return [];
    }

    const now = new Date().toISOString();
    const payload = documents.map((document, index) => {
      const metadata = document.metadata || {};
      return {
        id: String(metadata.id || `rag_${crypto.randomUUID().replace(/-/g, '')}`),
        workspaceId: String(metadata.workspaceId || this.workspaceId),
        recordingId: String(metadata.recordingId || metadata.recording_id || ''),
        speakerName: String(metadata.speakerName || metadata.speaker_name || ''),
        text: String(document.pageContent || ''),
        embedding: vectors[index] || [],
        createdAt: String(metadata.createdAt || metadata.created_at || now),
      };
    });

    if (typeof this.db.saveRagChunks === 'function') {
      await this.db.saveRagChunks(payload);
    } else if (typeof this.db.saveRagChunk === 'function') {
      for (const chunk of payload) {
        await this.db.saveRagChunk(chunk);
      }
    }

    return payload.map((chunk) => chunk.id);
  }

  async addDocuments(documents: DocumentInterface[]) {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((doc) => String(doc.pageContent || ''))
    );
    return this.addVectors(vectors, documents);
  }

  async similaritySearchVectorWithScore(query: number[], k = this.topK) {
    if (!Array.isArray(query) || query.length === 0) return [];

    const rows = await this.db.getAllRagChunksForWorkspace(this.workspaceId);
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const queryMagnitude = magnitude(query);
    if (queryMagnitude === 0) return [];

    const scored = rows.map((row) => {
      const vec = safeJsonArray(row.embedding_json);
      if (!vec.length) return { row, score: -1 };
      const vecMagnitude = magnitude(vec);
      if (vecMagnitude === 0) return { row, score: -1 };
      const score = dotProduct(query, vec) / (queryMagnitude * vecMagnitude);
      return { row, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter((item) => item.score > this.minScore)
      .slice(0, k)
      .map(
        (item) => [buildDocument(item.row, item.score), item.score] as [DocumentInterface, number]
      );
  }
}
