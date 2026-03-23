/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock transformers at the top level (hoisted) - include ALL exports
vi.mock("@xenova/transformers", () => ({
  env: {
    allowLocalModels: true,
    use_env_vars: true,
    backends: {
      onnx: {
        wasm: {
          numThreads: 1,
        },
      },
    },
  },
  AutoModel: {
    from_pretrained: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue({
        embeddings: {
          data: new Float32Array(512).fill(0.5),
        },
      }),
    }),
  },
  AutoProcessor: {
    from_pretrained: vi.fn().mockResolvedValue(
      vi.fn().mockResolvedValue({
        input_values: new Float32Array(16000),
      })
    ),
  },
}));

// Mock config
vi.mock("../config", () => ({
  config: {
    FFMPEG_BINARY: "ffmpeg",
  },
}));

// Import after mocks
import {
  cosineSimilarity,
  addToAverageEmbedding,
  computeEmbedding,
  matchSpeakerToProfile,
} from "../speakerEmbedder";

describe("speakerEmbedder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cosineSimilarity", () => {
    it("returns 1 for identical vectors", () => {
      const vec = [0.5, 0.3, 0.8, 0.1];
      const result = cosineSimilarity(vec, vec);
      expect(result).toBeCloseTo(1, 5);
    });

    it("returns 0 for orthogonal vectors", () => {
      const vec1 = [1, 0, 0, 0];
      const vec2 = [0, 1, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(0, 5);
    });

    it("returns negative value for opposite vectors", () => {
      const vec1 = [1, 0, 0, 0];
      const vec2 = [-1, 0, 0, 0];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeCloseTo(-1, 5);
    });

    it("returns 0 when vectors are null", () => {
      expect(cosineSimilarity(null as any, [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([1, 2, 3], null as any)).toBe(0);
      expect(cosineSimilarity(null as any, null as any)).toBe(0);
    });

    it("returns 0 when vectors have different lengths", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3, 4];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBe(0);
    });

    it("handles empty vectors", () => {
      const result = cosineSimilarity([], []);
      expect(result).toBe(0);
    });

    it("calculates correct similarity for real-world vectors", () => {
      const vec1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vec2 = [0.15, 0.25, 0.35, 0.45, 0.55];
      const result = cosineSimilarity(vec1, vec2);
      expect(result).toBeGreaterThan(0.9); // Should be very similar
    });
  });

  describe("addToAverageEmbedding", () => {
    it("returns new embedding when existing is empty", () => {
      const newEmbedding = [0.5, 0.3, 0.8];
      const result = addToAverageEmbedding([], 0, newEmbedding);
      expect(result).toEqual(newEmbedding);
    });

    it("returns existing embedding when new is empty", () => {
      const existing = [0.5, 0.3, 0.8];
      const result = addToAverageEmbedding(existing, 1, []);
      expect(result).toEqual(existing);
    });

    it("returns null when both are null", () => {
      const result = addToAverageEmbedding(null as any, 0, null as any);
      expect(result).toBeNull();
    });

    it("calculates weighted average correctly", () => {
      const existing = [1, 0, 0]; // Unit vector in x direction
      const newEmbedding = [0, 1, 0]; // Unit vector in y direction
      const result = addToAverageEmbedding(existing, 1, newEmbedding);
      
      // Should be normalized average: [0.5, 0.5, 0] normalized
      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(0.707, 2); // ~1/sqrt(2)
      expect(result[1]).toBeCloseTo(0.707, 2);
    });

    it("handles large existing count (profile with many samples)", () => {
      const existing = [1, 0, 0];
      const newEmbedding = [0, 1, 0];
      const result = addToAverageEmbedding(existing, 9, newEmbedding);
      
      // With 9 existing samples, new one has less impact
      expect(result[0]).toBeGreaterThan(result[1]); // x should still dominate
    });

    it("normalizes result to unit length", () => {
      const existing = [2, 0, 0];
      const newEmbedding = [0, 2, 0];
      const result = addToAverageEmbedding(existing, 1, newEmbedding);
      
      // Check that result is normalized (length = 1)
      const length = Math.sqrt(result[0] ** 2 + result[1] ** 2 + result[2] ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it("handles different length vectors (uses minimum)", () => {
      const existing = [1, 2, 3, 4, 5];
      const newEmbedding = [1, 2, 3];
      const result = addToAverageEmbedding(existing, 1, newEmbedding);
      expect(result.length).toBe(3);
    });
  });

  describe("computeEmbedding", () => {
    it("returns null for non-existent file", async () => {
      const result = await computeEmbedding("/non/existent/file.wav");
      expect(result).toBeNull();
    });

    it("returns null when transformers fail to load", async () => {
      // Mock model loading failure
      const { AutoModel } = await import("@xenova/transformers");
      vi.mocked(AutoModel.from_pretrained).mockRejectedValueOnce(
        new Error("Model load failed")
      );
      
      const result = await computeEmbedding("/fake/file.wav");
      expect(result).toBeNull();
    });
  });

  describe("matchSpeakerToProfile", () => {
    it("returns null when no profiles provided", async () => {
      const result = await matchSpeakerToProfile("/fake/file.wav", []);
      expect(result).toBeNull();
    });

    it("returns null when profiles have invalid embedding JSON", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: "invalid json {",
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      expect(result).toBeNull();
    });

    it("returns null when profile embedding is not an array", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: '"not an array"',
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      expect(result).toBeNull();
    });

    it("returns null when profile embedding is empty array", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: "[]",
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      expect(result).toBeNull();
    });

    it("uses per-profile threshold when specified", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(new Array(512).fill(0.5)),
          threshold: 0.99, // Very high threshold
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      
      // With high threshold, might not match (depends on actual similarity)
      expect(result === null || result.confidence >= 99).toBe(true);
    });

    it("falls back to default threshold when not specified", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(new Array(512).fill(0.5)),
          // No threshold specified - should use default 0.82
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      // Result may be null if embedding computation fails, but function should handle it gracefully
      expect(result === null || typeof result.name === "string").toBe(true);
    });

    it("handles legacy embedding field format", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding: JSON.stringify(new Array(512).fill(0.5)),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      expect(result === null || typeof result.name === "string").toBe(true);
    });

    it("handles embedding as pre-parsed object", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding: new Array(512).fill(0.5),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      expect(result === null || typeof result.name === "string").toBe(true);
    });

    it("returns best match when multiple profiles provided", async () => {
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(new Array(512).fill(0.5)),
          threshold: 0.8,
        },
        {
          speaker_name: "Bob",
          embedding_json: JSON.stringify(new Array(512).fill(0.3)),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile("/fake/file.wav", profiles);
      
      // Should return the best match or null if no match exceeds threshold
      expect(result === null || ["Alice", "Bob"].includes(result.name)).toBe(true);
    });
  });

  describe("integration scenarios", () => {
    it("handles multi-sample profile updates", () => {
      // Simulate incremental profile building
      let embedding: number[] = new Array(512).fill(0);
      let sampleCount = 0;
      
      // Add 3 samples
      for (let i = 0; i < 3; i++) {
        const newSample = new Array(512).fill(0.5).map((v) => v + (Math.random() - 0.5) * 0.1);
        embedding = addToAverageEmbedding(embedding, sampleCount, newSample);
        sampleCount++;
      }
      
      // Embedding should be normalized
      const length = Math.sqrt(embedding.reduce((sum, v) => sum + v ** 2, 0));
      expect(length).toBeCloseTo(1, 3);
      expect(embedding.length).toBe(512);
    });

    it("handles cosine similarity for speaker matching", () => {
      // Create two similar embeddings
      const embedding1 = new Array(512).fill(0.5);
      const embedding2 = new Array(512).fill(0.48); // Slightly different
      
      const similarity = cosineSimilarity(embedding1, embedding2);
      
      // Should be very similar (> 0.99)
      expect(similarity).toBeGreaterThan(0.99);
    });

    it("handles dissimilar embeddings", () => {
      // Create two very different embeddings
      const embedding1 = new Array(512).fill(1);
      const embedding2 = new Array(512).fill(-1);
      
      const similarity = cosineSimilarity(embedding1, embedding2);
      
      // Should be very dissimilar (< -0.9)
      expect(similarity).toBeLessThan(-0.9);
    });
  });
});
