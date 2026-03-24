/**
 * ragRetriever.ts
 * 
 * RAG (Retrieval-Augmented Generation) chunk retriever.
 * Retrieves relevant chunks from the database based on semantic similarity.
 */

import type { RagVectorStore } from "./ragVectorStore.ts";

interface RagChunk {
  id: string;
  recording_id: string;
  speaker_name: string;
  text: string;
  embedding_json: string;
}

interface RagChunkMetadata {
  id: string;
  recordingId: string;
  speakerName: string;
  score: number;
}

interface Document {
  pageContent: string;
  metadata: RagChunkMetadata;
}

interface RagChunkRetrieverOptions {
  workspaceId: string;
  db: {
    getAllRagChunksForWorkspace: (workspaceId: string) => Promise<RagChunk[]>;
  };
  embedTextChunks: (texts: string[]) => Promise<number[][]>;
  topK?: number;
  minScore?: number;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

export class RagChunkRetriever {
  private workspaceId: string;
  private db: RagChunkRetrieverOptions["db"];
  private embedTextChunks: RagChunkRetrieverOptions["embedTextChunks"];
  private topK: number;
  private minScore: number;

  constructor(options: RagChunkRetrieverOptions) {
    this.workspaceId = options.workspaceId;
    this.db = options.db;
    this.embedTextChunks = options.embedTextChunks;
    this.topK = options.topK ?? 15;
    this.minScore = options.minScore ?? 0.1;
  }

  /**
   * Retrieve relevant chunks for a given query
   */
  async invoke(query: string): Promise<Document[]> {
    // Embed the query
    const queryEmbeddings = await this.embedTextChunks([query]);
    const queryVector = queryEmbeddings[0];

    // Get all chunks for this workspace
    const chunks = await this.db.getAllRagChunksForWorkspace(this.workspaceId);

    // Calculate similarity scores
    const scoredChunks = chunks
      .map((chunk) => {
        const chunkVector = JSON.parse(chunk.embedding_json);
        const score = cosineSimilarity(queryVector, chunkVector);
        return { chunk, score };
      })
      .filter(({ score }) => score >= this.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.topK);

    // Convert to Document format
    return scoredChunks.map(({ chunk, score }) => ({
      pageContent: chunk.text,
      metadata: {
        id: chunk.id,
        recordingId: chunk.recording_id,
        speakerName: chunk.speaker_name,
        score,
      },
    }));
  }
}

export default RagChunkRetriever;
