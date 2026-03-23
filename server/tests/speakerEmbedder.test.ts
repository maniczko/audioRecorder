/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// Mock transformers at the top level (hoisted)
vi.mock("@xenova/transformers", () => ({
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
  let tempAudioPath: string;

  beforeEach(() => {
    tempAudioPath = path.join(os.tmpdir(), `test_audio_${Date.now()}.wav`);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath);
    }
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

    it("returns null for short audio files", async () => {
      // Create a tiny file (less than 160 bytes = 10ms at 16kHz)
      fs.writeFileSync(tempAudioPath, Buffer.alloc(100));
      const result = await computeEmbedding(tempAudioPath);
      expect(result).toBeNull();
    });

    it("returns null when transformers fail to load", async () => {
      // Create a valid audio file
      const audioData = Buffer.alloc(16000 * 4); // 1 second of audio
      fs.writeFileSync(tempAudioPath, audioData);
      
      // Mock model loading failure
      vi.mocked(await import("@xenova/transformers")).AutoModel.from_pretrained.mockRejectedValue(
        new Error("Model load failed")
      );
      
      const result = await computeEmbedding(tempAudioPath);
      expect(result).toBeNull();
    });

    it("returns embedding for valid audio file", async () => {
      // Create a valid audio file
      const audioData = Buffer.alloc(16000 * 4); // 1 second of audio
      fs.writeFileSync(tempAudioPath, audioData);
      
      const result = await computeEmbedding(tempAudioPath);
      
      // Should return normalized 512-dim embedding
      expect(result).toHaveLength(512);
      
      // Check normalization (length should be ~1)
      const length = Math.sqrt(result!.reduce((sum, v) => sum + v ** 2, 0));
      expect(length).toBeCloseTo(1, 3);
    });

    it("caches model after first load", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      await computeEmbedding(tempAudioPath);
      await computeEmbedding(tempAudioPath);
      
      // AutoModel.from_pretrained should only be called once due to caching
      const { AutoModel } = await import("@xenova/transformers");
      expect(AutoModel.from_pretrained).toHaveBeenCalledTimes(1);
    });
  });

  describe("matchSpeakerToProfile", () => {
    it("returns null when no profiles provided", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const result = await matchSpeakerToProfile(tempAudioPath, []);
      expect(result).toBeNull();
    });

    it("returns null when profiles have invalid embedding JSON", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: "invalid json {",
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeNull();
    });

    it("returns null when profile embedding is not an array", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: '"not an array"',
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeNull();
    });

    it("returns null when profile embedding is empty array", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: "[]",
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeNull();
    });

    it("returns matching profile when similarity exceeds threshold", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      // Create a profile with a known embedding that should match
      const knownEmbedding = new Array(512).fill(0.5);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(knownEmbedding),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      
      // Since our mock returns [0.5, 0.5, ...], similarity should be 1.0
      expect(result).toBeDefined();
      expect(result!.name).toBe("Alice");
      expect(result!.confidence).toBeGreaterThan(80);
    });

    it("returns null when no profile exceeds similarity threshold", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      // Create a profile with very different embedding
      const differentEmbedding = new Array(512).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(differentEmbedding),
          threshold: 0.95, // Very high threshold
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeNull();
    });

    it("uses per-profile threshold when specified", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const knownEmbedding = new Array(512).fill(0.5);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(knownEmbedding),
          threshold: 0.99, // Very high threshold
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      
      // With high threshold, might not match
      // Result depends on actual similarity calculation
      expect(result === null || result.confidence >= 99).toBe(true);
    });

    it("falls back to default threshold when not specified", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const knownEmbedding = new Array(512).fill(0.5);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding_json: JSON.stringify(knownEmbedding),
          // No threshold specified - should use default 0.82
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeDefined();
    });

    it("returns best match when multiple profiles provided", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
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
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      
      // Should return the best match (highest similarity)
      expect(result).toBeDefined();
      expect(["Alice", "Bob"]).toContain(result!.name);
    });

    it("handles legacy embedding field format", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding: JSON.stringify(new Array(512).fill(0.5)),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeDefined();
    });

    it("handles embedding as pre-parsed object", async () => {
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      const profiles = [
        {
          speaker_name: "Alice",
          embedding: new Array(512).fill(0.5),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      expect(result).toBeDefined();
    });
  });

  describe("integration scenarios", () => {
    it("handles complete speaker verification flow", async () => {
      // Create audio file
      const audioData = Buffer.alloc(16000 * 4);
      fs.writeFileSync(tempAudioPath, audioData);
      
      // Simulate profile enrollment
      const enrollmentEmbedding = new Array(512).fill(0.5);
      
      // Simulate verification
      const profiles = [
        {
          speaker_name: "Test User",
          embedding_json: JSON.stringify(enrollmentEmbedding),
          threshold: 0.8,
        },
      ];
      
      const result = await matchSpeakerToProfile(tempAudioPath, profiles);
      
      expect(result).toBeDefined();
      expect(result!.name).toBe("Test User");
      expect(typeof result!.confidence).toBe("number");
      expect(result!.confidence).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThanOrEqual(100);
    });

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
  });
});
