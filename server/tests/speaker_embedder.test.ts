import { describe, it, expect } from "vitest";
import { cosineSimilarity, matchSpeakerToProfile } from "../speakerEmbedder.ts";

describe("speakerEmbedder - cosineSimilarity", () => {
  it("should return 1.0 for identical vectors", () => {
    const v = [1, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it("should return 0.0 for orthogonal vectors", () => {
    const v1 = [1, 0, 0, 0];
    const v2 = [0, 1, 0, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0);
  });

  it("should return -1.0 for opposite vectors", () => {
    const v1 = [1, 1];
    const v2 = [-1, -1];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0);
  });

  it("should handle vectors with different lengths by returning 0", () => {
    const v1 = [1, 2];
    const v2 = [1, 2, 3];
    expect(cosineSimilarity(v1, v2)).toBe(0);
  });
});

describe("speakerEmbedder - matchSpeakerToProfile", () => {
  it("should return null if no profiles provided", async () => {
    const res = await matchSpeakerToProfile("dummy.wav", []);
    expect(res).toBeNull();
  });

  // We can't easily test computeEmbedding without mock models, 
  // but we can test the matching logic if we mock computeEmbedding itself elsewhere or test its callers.
  // Actually, matchSpeakerToProfile calls computeEmbedding.
});
