/**
 * @vitest-environment jsdom
 * mediaService service tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("mediaService", () => {
  let mediaService: any;
  let originalFetch: any;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    mediaService = await import("./services/mediaService");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("uploadAudioChunk", () => {
    it("uploads audio chunk", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const blob = new Blob(["audio data"], { type: "audio/webm" });
      
      const result = await mediaService.uploadAudioChunk("rec1", blob, 0, 10);
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("includes required headers", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const blob = new Blob(["audio"], { type: "audio/webm" });
      await mediaService.uploadAudioChunk("rec1", blob, 0, 10);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": expect.any(String),
          }),
        })
      );
    });

    it("includes workspace ID header", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const blob = new Blob(["audio"], { type: "audio/webm" });
      await mediaService.uploadAudioChunk("rec1", blob, 0, 10, "ws1");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Workspace-Id": "ws1",
          }),
        })
      );
    });

    it("handles upload error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Upload failed" }),
      });

      const blob = new Blob(["audio"], { type: "audio/webm" });
      
      await expect(mediaService.uploadAudioChunk("rec1", blob, 0, 10))
        .rejects.toThrow();
    });
  });

  describe("finalizeAudioUpload", () => {
    it("finalizes audio upload", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ recordingId: "rec1" }),
      });

      const result = await mediaService.finalizeAudioUpload("rec1", 10);
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ recordingId: "rec1" });
    });

    it("includes total chunks", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await mediaService.finalizeAudioUpload("rec1", 10);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ total: 10 }),
        })
      );
    });

    it("handles finalize error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.finalizeAudioUpload("rec1", 10))
        .rejects.toThrow();
    });
  });

  describe("getRecordingAudio", () => {
    it("fetches recording audio", async () => {
      const blob = new Blob(["audio data"], { type: "audio/webm" });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: async () => blob,
      });

      const result = await mediaService.getRecordingAudio("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe(blob);
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(mediaService.getRecordingAudio("rec1"))
        .rejects.toThrow();
    });
  });

  describe("deleteRecording", () => {
    it("deletes recording", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true }),
      });

      const result = await mediaService.deleteRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it("handles delete error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.deleteRecording("rec1"))
        .rejects.toThrow();
    });
  });

  describe("getRecordings", () => {
    it("fetches recordings list", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ recordings: [{ id: "rec1" }] }),
      });

      const result = await mediaService.getRecordings();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ recordings: [{ id: "rec1" }] });
    });

    it("supports pagination", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ recordings: [] }),
      });

      await mediaService.getRecordings({ page: 1, limit: 10 });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.any(Object)
      );
    });

    it("supports filtering", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ recordings: [] }),
      });

      await mediaService.getRecordings({ workspaceId: "ws1" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("workspaceId=ws1"),
        expect.any(Object)
      );
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getRecordings()).rejects.toThrow();
    });
  });

  describe("getRecording", () => {
    it("fetches single recording", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "rec1", title: "Test" }),
      });

      const result = await mediaService.getRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ id: "rec1", title: "Test" });
    });

    it("handles not found", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(mediaService.getRecording("rec1")).rejects.toThrow();
    });
  });

  describe("updateRecording", () => {
    it("updates recording", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await mediaService.updateRecording("rec1", {
        title: "Updated",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("includes update data in body", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await mediaService.updateRecording("rec1", { title: "Updated" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ title: "Updated" }),
        })
      );
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.updateRecording("rec1", {}))
        .rejects.toThrow();
    });
  });

  describe("transcribeRecording", () => {
    it("starts transcription", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ transcriptionId: "t1" }),
      });

      const result = await mediaService.transcribeRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ transcriptionId: "t1" });
    });

    it("handles transcription error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.transcribeRecording("rec1"))
        .rejects.toThrow();
    });
  });

  describe("getTranscriptionStatus", () => {
    it("fetches transcription status", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ status: "completed", progress: 100 }),
      });

      const result = await mediaService.getTranscriptionStatus("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ status: "completed", progress: 100 });
    });

    it("handles status error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getTranscriptionStatus("rec1"))
        .rejects.toThrow();
    });
  });

  describe("getTranscription", () => {
    it("fetches transcription", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ segments: [{ text: "Hello" }] }),
      });

      const result = await mediaService.getTranscription("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ segments: [{ text: "Hello" }] });
    });

    it("handles transcription error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getTranscription("rec1"))
        .rejects.toThrow();
    });
  });

  describe("analyzeRecording", () => {
    it("starts analysis", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ analysisId: "a1" }),
      });

      const result = await mediaService.analyzeRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ analysisId: "a1" });
    });

    it("handles analysis error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.analyzeRecording("rec1"))
        .rejects.toThrow();
    });
  });

  describe("getAnalysis", () => {
    it("fetches analysis result", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ summary: "Test summary" }),
      });

      const result = await mediaService.getAnalysis("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ summary: "Test summary" });
    });

    it("handles analysis error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getAnalysis("rec1")).rejects.toThrow();
    });
  });

  describe("exportRecording", () => {
    it("exports recording", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(["export data"]),
      });

      const result = await mediaService.exportRecording("rec1", "json");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
    });

    it("supports different formats", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        blob: async () => new Blob([]),
      });

      await mediaService.exportRecording("rec1", "txt");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("format=txt"),
        expect.any(Object)
      );
    });

    it("handles export error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.exportRecording("rec1", "json"))
        .rejects.toThrow();
    });
  });

  describe("shareRecording", () => {
    it("creates share link", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ shareUrl: "https://share.link" }),
      });

      const result = await mediaService.shareRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ shareUrl: "https://share.link" });
    });

    it("handles share error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.shareRecording("rec1")).rejects.toThrow();
    });
  });

  describe("getShareUrl", () => {
    it("returns share URL", () => {
      const url = mediaService.getShareUrl("rec1");
      expect(url).toContain("rec1");
    });
  });

  describe("buildRecordingUrl", () => {
    it("builds recording URL", () => {
      const url = mediaService.buildRecordingUrl("rec1");
      expect(url).toContain("/recordings/rec1");
    });
  });

  describe("buildTranscriptionUrl", () => {
    it("builds transcription URL", () => {
      const url = mediaService.buildTranscriptionUrl("rec1");
      expect(url).toContain("/recordings/rec1/transcribe");
    });
  });

  describe("buildAnalysisUrl", () => {
    it("builds analysis URL", () => {
      const url = mediaService.buildAnalysisUrl("rec1");
      expect(url).toContain("/recordings/rec1/analyze");
    });
  });

  describe("parseRecordingId", () => {
    it("extracts recording ID from URL", () => {
      const id = mediaService.parseRecordingId("/recordings/rec123");
      expect(id).toBe("rec123");
    });

    it("handles invalid URL", () => {
      const id = mediaService.parseRecordingId("invalid");
      expect(id).toBeNull();
    });
  });

  describe("validateRecordingId", () => {
    it("returns true for valid ID", () => {
      expect(mediaService.validateRecordingId("rec123")).toBe(true);
    });

    it("returns false for invalid ID", () => {
      expect(mediaService.validateRecordingId("")).toBe(false);
      expect(mediaService.validateRecordingId("invalid_id")).toBe(false);
    });
  });

  describe("formatRecordingDate", () => {
    it("formats recording date", () => {
      const date = new Date("2026-03-23T10:00:00.000Z");
      const result = mediaService.formatRecordingDate(date);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("handles invalid date", () => {
      const result = mediaService.formatRecordingDate(null as any);
      expect(result).toBe("");
    });
  });

  describe("formatRecordingDuration", () => {
    it("formats duration in seconds", () => {
      const result = mediaService.formatRecordingDuration(90);
      expect(result).toBe("1:30");
    });

    it("formats duration in minutes", () => {
      const result = mediaService.formatRecordingDuration(3600);
      expect(result).toBe("1:00:00");
    });

    it("handles zero duration", () => {
      const result = mediaService.formatRecordingDuration(0);
      expect(result).toBe("0:00");
    });
  });

  describe("getRecordingStatus", () => {
    it("returns status for completed recording", () => {
      const recording = { status: "completed" };
      expect(mediaService.getRecordingStatus(recording as any)).toBe("completed");
    });

    it("returns status for processing recording", () => {
      const recording = { status: "processing" };
      expect(mediaService.getRecordingStatus(recording as any)).toBe("processing");
    });

    it("returns default status", () => {
      const recording = {};
      expect(mediaService.getRecordingStatus(recording as any)).toBe("pending");
    });
  });

  describe("isRecordingReady", () => {
    it("returns true for completed recording", () => {
      const recording = { status: "completed" };
      expect(mediaService.isRecordingReady(recording as any)).toBe(true);
    });

    it("returns false for processing recording", () => {
      const recording = { status: "processing" };
      expect(mediaService.isRecordingReady(recording as any)).toBe(false);
    });

    it("returns false for failed recording", () => {
      const recording = { status: "failed" };
      expect(mediaService.isRecordingReady(recording as any)).toBe(false);
    });
  });

  describe("getRecordingProgress", () => {
    it("returns progress percentage", () => {
      const recording = { transcriptionProgress: 50 };
      expect(mediaService.getRecordingProgress(recording as any)).toBe(50);
    });

    it("returns 0 for missing progress", () => {
      const recording = {};
      expect(mediaService.getRecordingProgress(recording as any)).toBe(0);
    });
  });

  describe("getRecordingErrorMessage", () => {
    it("returns error message", () => {
      const recording = { errorMessage: "Test error" };
      expect(mediaService.getRecordingErrorMessage(recording as any))
        .toBe("Test error");
    });

    it("returns null for no error", () => {
      const recording = {};
      expect(mediaService.getRecordingErrorMessage(recording as any))
        .toBeNull();
    });
  });

  describe("retryFailedRecording", () => {
    it("retries failed recording", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ retryId: "r1" }),
      });

      const result = await mediaService.retryFailedRecording("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ retryId: "r1" });
    });

    it("handles retry error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.retryFailedRecording("rec1"))
        .rejects.toThrow();
    });
  });

  describe("cancelRecordingProcessing", () => {
    it("cancels processing", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ cancelled: true }),
      });

      const result = await mediaService.cancelRecordingProcessing("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ cancelled: true });
    });

    it("handles cancel error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.cancelRecordingProcessing("rec1"))
        .rejects.toThrow();
    });
  });

  describe("getRecordingMetadata", () => {
    it("fetches metadata", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ metadata: { key: "value" } }),
      });

      const result = await mediaService.getRecordingMetadata("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ metadata: { key: "value" } });
    });

    it("handles metadata error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getRecordingMetadata("rec1"))
        .rejects.toThrow();
    });
  });

  describe("updateRecordingMetadata", () => {
    it("updates metadata", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await mediaService.updateRecordingMetadata("rec1", {
        key: "value",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.updateRecordingMetadata("rec1", {}))
        .rejects.toThrow();
    });
  });

  describe("getRecordingTags", () => {
    it("fetches tags", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ tags: ["tag1", "tag2"] }),
      });

      const result = await mediaService.getRecordingTags("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ tags: ["tag1", "tag2"] });
    });

    it("handles tags error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getRecordingTags("rec1")).rejects.toThrow();
    });
  });

  describe("updateRecordingTags", () => {
    it("updates tags", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await mediaService.updateRecordingTags("rec1", [
        "tag1",
        "tag2",
      ]);
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.updateRecordingTags("rec1", []))
        .rejects.toThrow();
    });
  });

  describe("searchRecordings", () => {
    it("searches recordings", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: "rec1" }] }),
      });

      const result = await mediaService.searchRecordings("query");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ results: [{ id: "rec1" }] });
    });

    it("includes query in URL", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await mediaService.searchRecordings("test query");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("q=test+query"),
        expect.any(Object)
      );
    });

    it("handles search error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.searchRecordings("query")).rejects.toThrow();
    });
  });

  describe("getRecordingSpeakers", () => {
    it("fetches speakers", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ speakers: [{ id: "s1", name: "Speaker 1" }] }),
      });

      const result = await mediaService.getRecordingSpeakers("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ speakers: [{ id: "s1", name: "Speaker 1" }] });
    });

    it("handles speakers error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getRecordingSpeakers("rec1")).rejects.toThrow();
    });
  });

  describe("updateSpeakerName", () => {
    it("updates speaker name", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await mediaService.updateSpeakerName("rec1", "s1", "New Name");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.updateSpeakerName("rec1", "s1", "New Name"))
        .rejects.toThrow();
    });
  });

  describe("getRecordingStatistics", () => {
    it("fetches statistics", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          wordCount: 1000,
          speakerCount: 2,
          duration: 3600,
        }),
      });

      const result = await mediaService.getRecordingStatistics("rec1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({
        wordCount: 1000,
        speakerCount: 2,
        duration: 3600,
      });
    });

    it("handles statistics error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(mediaService.getRecordingStatistics("rec1"))
        .rejects.toThrow();
    });
  });
});
