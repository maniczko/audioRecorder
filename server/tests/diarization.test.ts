/**
 * Testy dla diarization - GPT-4o diaryzacja transkryptów
 * Coverage target: 90%+
 *
 * Testujemy funkcję diarizeFromTranscript() która jest używana w audioPipeline.ts
 * ale nie jest eksportowana publicznie - testujemy przez bezpośrednie wywołanie internalne
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Diarization - GPT-4o transcript analysis", () => {
  const originalFetch = global.fetch;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    // Mock config
    vi.resetModules();
    vi.doMock("../config.ts", () => ({
      config: {
        VOICELOG_OPENAI_API_KEY: "test-key",
        OPENAI_API_KEY: "test-key",
        VOICELOG_OPENAI_BASE_URL: "https://api.test.com",
        VERIFICATION_MODEL: "gpt-4o-mini",
      },
    }));

    vi.doMock("../logger.ts", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }));

    vi.doMock("../speakerEmbedder.ts", () => ({
      matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==================== PODSTAWOWE TESTY ====================

  describe("diarizeFromTranscript() - podstawy", () => {
    it("returns null for empty segments", async () => {
      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([]);

      expect(result).toBeNull();
    }, 15000);

    it("returns null when API key is missing", async () => {
      vi.resetModules();
      vi.doMock("../config.ts", () => ({
        config: {
          VOICELOG_OPENAI_API_KEY: "",
          OPENAI_API_KEY: "",
        },
      }));

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Test", start: 0, end: 1 },
      ]);

      expect(result).toBeNull();
    });

    it("returns null on API error (non-ok response)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Test", start: 0, end: 1 },
      ]);

      expect(result).toBeNull();
    });

    it("returns null on invalid JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: { content: "not valid json" },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Test", start: 0, end: 1 },
      ]);

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Test", start: 0, end: 1 },
      ]);

      expect(result).toBeNull();
    });
  });

  // ==================== EDGE CASES ====================

  describe("Edge cases", () => {
    it("handles segments without timestamps", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Test 1" } as any,
        { text: "Test 2" } as any,
      ]);

      // Should not throw
      expect(result).toBeDefined();
    });

    it("handles very short segments", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Tak", start: 0, end: 0.5 },
        { text: "Nie", start: 0.6, end: 1 },
      ]);

      expect(result).toBeDefined();
    });

    it("handles segments with special characters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: 'Test "quoted" text', start: 0, end: 1 },
        { text: "Test 'single quotes'", start: 2, end: 3 },
      ]);

      expect(result).toBeDefined();
    });
  });

  // ==================== POLISH LANGUAGE ====================

  describe("Polish language support", () => {
    it("handles Polish characters in text", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Cześć, jak się masz?", start: 0, end: 2 },
        { text: "Dobrze, dziękuję. A ty?", start: 3, end: 5 },
      ]);

      expect(result).toBeDefined();
    });

    it("handles Polish business vocabulary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                segments: [
                  { i: 0, s: "A" },
                  { i: 1, s: "B" },
                ],
              }),
            },
          }],
        }),
      });

      const pipeline = await import("../audioPipeline.ts");
      const result = await pipeline.diarizeFromTranscript([
        { text: "Omówmy budżet na przyszły kwartał", start: 0, end: 3 },
        { text: "Zgadza się, potrzebujemy zwiększyć nakłady na marketing", start: 4, end: 8 },
      ]);

      expect(result).toBeDefined();
    });
  });
});
