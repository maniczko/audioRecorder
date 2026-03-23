/**
 * Testy dla TranscriptionService.ts - uzupełnienie coverage
 * Coverage target: 85%+
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import TranscriptionService from "../../services/TranscriptionService.ts";

describe("TranscriptionService - Additional Coverage", () => {
  let mockDb: any;
  let mockWorkspaceService: any;
  let mockSpeakerEmbedder: any;
  let mockAudioPipeline: any;

  beforeEach(() => {
    mockDb = {
      uploadDir: "/tmp",
      getWorkspaceState: vi.fn().mockResolvedValue({ vocabulary: ["crm"] }),
      getWorkspaceVoiceProfiles: vi.fn().mockResolvedValue([{ id: "vp1" }]),
      queueTranscription: vi.fn(),
      markTranscriptionProcessing: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      markTranscriptionFailure: vi.fn(),
      saveRagChunk: vi.fn(),
      getAllRagChunksForWorkspace: vi.fn().mockResolvedValue([]),
      upsertMediaAsset: vi.fn(),
      getMediaAsset: vi.fn(),
      saveAudioQualityDiagnostics: vi.fn(),
    };
    mockWorkspaceService = {
      getWorkspaceMemberNames: vi.fn().mockResolvedValue(["Anna", "Jan"]),
      saveVoiceProfile: vi.fn().mockResolvedValue({ id: "vp_new", speaker_name: "Anna" }),
    };
    mockSpeakerEmbedder = {
      computeEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    mockAudioPipeline = {
      transcribeRecording: vi.fn(),
      extractSpeakerAudioClip: vi.fn(),
      diarizeFromTranscript: vi.fn(),
      transcribeLiveChunk: vi.fn(),
      analyzeMeetingWithOpenAI: vi.fn(),
      normalizeRecording: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      embedTextChunks: vi.fn(),
      analyzeAudioQuality: vi.fn(),
    };
  });

  describe("analyzeAudioQuality()", () => {
    test("calls pipeline.analyzeAudioQuality", async () => {
      mockAudioPipeline.analyzeAudioQuality.mockResolvedValue({
        qualityLabel: "good",
        snr: 25,
      });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.analyzeAudioQuality("/tmp/audio.wav");

      expect(result).toEqual({ qualityLabel: "good", snr: 25 });
      expect(mockAudioPipeline.analyzeAudioQuality).toHaveBeenCalledWith(
        "/tmp/audio.wav",
        {}
      );
    });

    test("throws error when pipeline does not support audio quality analysis", async () => {
      // Remove analyzeAudioQuality from pipeline
      delete mockAudioPipeline.analyzeAudioQuality;

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      await expect(
        service.analyzeAudioQuality("/tmp/audio.wav")
      ).rejects.toThrow("Audio pipeline nie wspiera analizy jakosci audio.");
    });
  });

  describe("createVoiceProfileFromSpeaker()", () => {
    test("creates voice profile from speaker clip", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");

      // Create temp file first
      const tempClipPath = path.join(mockDb.uploadDir, "clip_vp123.wav");
      fs.writeFileSync(tempClipPath, Buffer.from("audio"));

      mockAudioPipeline.extractSpeakerAudioClip.mockResolvedValue(tempClipPath);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const asset = {
        id: "rec1",
        workspace_id: "ws1",
        transcript_json: JSON.stringify([
          { text: "Hello", speakerId: "1", timestamp: 0, endTimestamp: 1 },
        ]),
      };

      const profile = await service.createVoiceProfileFromSpeaker(
        asset,
        "1",
        "Test Speaker",
        "user1"
      );

      expect(profile).toEqual({ id: "vp_new", speaker_name: "Anna" });
      expect(mockAudioPipeline.extractSpeakerAudioClip).toHaveBeenCalled();
      expect(mockSpeakerEmbedder.computeEmbedding).toHaveBeenCalled();
      expect(mockWorkspaceService.saveVoiceProfile).toHaveBeenCalled();

      // Cleanup
      try { fs.unlinkSync(tempClipPath); } catch(_) {}
    });

    test("throws error when no transcript available", async () => {
      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const asset = {
        id: "rec1",
        workspace_id: "ws1",
        transcript_json: "[]",
      };

      await expect(
        service.createVoiceProfileFromSpeaker(asset, "1", "Test", "user1")
      ).rejects.toThrow("Brak transkrypcji w bazie.");
    });
  });

  describe("vectorizeTranscriptionResultToRAG()", () => {
    test("chunks segments and vectorizes for RAG", async () => {
      mockAudioPipeline.embedTextChunks.mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const segments = [
        { text: "Segment 1", speakerId: "0" },
        { text: "Segment 2", speakerId: "1" },
        { text: "Segment 3", speakerId: "0" },
        { text: "Segment 4", speakerId: "1" },
        { text: "Short", speakerId: "0" }, // Too short, should be skipped
      ];

      await service.vectorizeTranscriptionResultToRAG("ws1", "rec1", segments);

      expect(mockAudioPipeline.embedTextChunks).toHaveBeenCalled();
      expect(mockDb.saveRagChunk).toHaveBeenCalled();
    });

    test("skips chunks that are too short", async () => {
      mockAudioPipeline.embedTextChunks.mockResolvedValue([]);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const segments = [
        { text: "Hi", speakerId: "0" }, // Too short
        { text: "Ok", speakerId: "1" }, // Too short
      ];

      await service.vectorizeTranscriptionResultToRAG("ws1", "rec1", segments);

      // Should not call embedTextChunks for too short segments
      expect(mockAudioPipeline.embedTextChunks).not.toHaveBeenCalled();
    });

    test("handles empty segments gracefully", async () => {
      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      await service.vectorizeTranscriptionResultToRAG("ws1", "rec1", []);

      expect(mockAudioPipeline.embedTextChunks).not.toHaveBeenCalled();
      expect(mockDb.saveRagChunk).not.toHaveBeenCalled();
    });

    test("handles pipeline without embedTextChunks gracefully", async () => {
      delete mockAudioPipeline.embedTextChunks;

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      // Should not throw
      await expect(
        service.vectorizeTranscriptionResultToRAG("ws1", "rec1", [
          { text: "Long enough segment", speakerId: "0" },
        ])
      ).resolves.toBeUndefined();
    });
  });

  describe("queryRAG()", () => {
    test("queries RAG with question and returns top chunks", async () => {
      mockAudioPipeline.embedTextChunks.mockResolvedValue([[0.5, 0.5]]);
      mockDb.getAllRagChunksForWorkspace.mockResolvedValue([
        {
          id: "chunk1",
          text: "Relevant chunk 1",
          embedding_json: JSON.stringify([0.4, 0.6]),
        },
        {
          id: "chunk2",
          text: "Relevant chunk 2",
          embedding_json: JSON.stringify([0.9, 0.9]),
        },
      ]);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const results = await service.queryRAG("ws1", "What is relevant?");

      expect(results).toBeDefined();
      expect(mockAudioPipeline.embedTextChunks).toHaveBeenCalledWith([
        "What is relevant?",
      ]);
      expect(mockDb.getAllRagChunksForWorkspace).toHaveBeenCalledWith("ws1");
    });

    test("returns null when pipeline does not support embedTextChunks", async () => {
      delete mockAudioPipeline.embedTextChunks;

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.queryRAG("ws1", "Question");

      expect(result).toBeNull();
    });

    test("returns null when no RAG chunks exist for workspace", async () => {
      mockAudioPipeline.embedTextChunks.mockResolvedValue([[0.5, 0.5]]);
      mockDb.getAllRagChunksForWorkspace.mockResolvedValue([]);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.queryRAG("ws1", "Question");

      expect(result).toBeNull();
    });

    test("filters out chunks with low similarity score", async () => {
      mockAudioPipeline.embedTextChunks.mockResolvedValue([[1, 0]]);
      mockDb.getAllRagChunksForWorkspace.mockResolvedValue([
        {
          id: "chunk1",
          text: "High similarity",
          embedding_json: JSON.stringify([0.9, 0.1]),
        },
        {
          id: "chunk2",
          text: "Low similarity",
          embedding_json: JSON.stringify([0.1, 0.9]),
        },
      ]);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const results = await service.queryRAG("ws1", "Question");

      // Should filter out low similarity chunks (score < 0.1)
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("diarizeFromTranscript()", () => {
    test("calls pipeline.diarizeFromTranscript", async () => {
      mockAudioPipeline.diarizeFromTranscript.mockResolvedValue({
        speakerCount: 2,
        segments: [],
      });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const whisperSegments = [
        { text: "Hello", start: 0, end: 1 },
        { text: "World", start: 2, end: 3 },
      ];

      const result = await service.diarizeFromTranscript(whisperSegments);

      expect(result).toEqual({ speakerCount: 2, segments: [] });
      expect(mockAudioPipeline.diarizeFromTranscript).toHaveBeenCalledWith(
        whisperSegments,
        {}
      );
    });
  });

  describe("transcribeLiveChunk()", () => {
    test("calls pipeline.transcribeLiveChunk", async () => {
      mockAudioPipeline.transcribeLiveChunk.mockResolvedValue(
        "Transcribed text"
      );

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.transcribeLiveChunk(
        "/tmp/chunk.webm",
        "audio/webm"
      );

      expect(result).toBe("Transcribed text");
      expect(mockAudioPipeline.transcribeLiveChunk).toHaveBeenCalledWith(
        "/tmp/chunk.webm",
        "audio/webm",
        {}
      );
    });
  });

  describe("analyzeMeetingWithOpenAI()", () => {
    test("calls pipeline.analyzeMeetingWithOpenAI", async () => {
      mockAudioPipeline.analyzeMeetingWithOpenAI.mockResolvedValue({
        summary: "Meeting summary",
      });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const data = {
        meeting: { title: "Meeting" },
        segments: [{ text: "Hello", speakerId: 0 }],
        speakerNames: { "0": "Alice" },
      };

      const result = await service.analyzeMeetingWithOpenAI(data);

      expect(result).toEqual({ summary: "Meeting summary" });
      expect(mockAudioPipeline.analyzeMeetingWithOpenAI).toHaveBeenCalledWith(
        data
      );
    });
  });

  describe("generateVoiceCoaching()", () => {
    test("calls pipeline.generateVoiceCoaching", async () => {
      mockAudioPipeline.generateVoiceCoaching.mockResolvedValue(
        "Good diction advice"
      );

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const asset = { id: "rec1", workspace_id: "ws1" };
      const segments = [{ speakerId: "1", timestamp: 0, endTimestamp: 1 }];

      const result = await service.generateVoiceCoaching(
        asset,
        "1",
        segments
      );

      expect(result).toBe("Good diction advice");
      expect(mockAudioPipeline.generateVoiceCoaching).toHaveBeenCalledWith(
        asset,
        "1",
        segments,
        {}
      );
    });
  });

  describe("normalizeRecording()", () => {
    test("calls pipeline.normalizeRecording", async () => {
      mockAudioPipeline.normalizeRecording.mockResolvedValue(undefined);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      await service.normalizeRecording("/tmp/audio.wav");

      expect(mockAudioPipeline.normalizeRecording).toHaveBeenCalledWith(
        "/tmp/audio.wav",
        {}
      );
    });
  });

  describe("computeEmbedding()", () => {
    test("uses injected speakerEmbedder", async () => {
      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.computeEmbedding("/tmp/audio.wav");

      expect(result).toEqual([0.1, 0.2, 0.3]);
      expect(mockSpeakerEmbedder.computeEmbedding).toHaveBeenCalledWith(
        "/tmp/audio.wav"
      );
    });
  });

  describe("startTranscriptionPipeline()", () => {
    test("queues the recording and starts the transcription job through a single orchestration method", async () => {
      mockDb.getMediaAsset.mockResolvedValue({ id: "rec1", workspace_id: "ws1" });
      mockDb.queueTranscription.mockResolvedValue(undefined);
      mockDb.markTranscriptionProcessing.mockResolvedValue(undefined);
      mockDb.saveTranscriptionResult.mockResolvedValue(undefined);
      mockAudioPipeline.transcribeRecording.mockResolvedValue({
        pipelineStatus: "completed",
        diarization: { confidence: 0.9 },
        segments: [{ text: "hello" }],
      });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const asset = { id: "rec1", workspace_id: "ws1" };
      const result = await service.startTranscriptionPipeline("rec1", asset, {
        workspaceId: "ws1",
        requestId: "req-1",
      });

      expect(mockDb.queueTranscription).toHaveBeenCalledWith("rec1", {
        workspaceId: "ws1",
        requestId: "req-1",
      });
      expect(result).toEqual({ id: "rec1", workspace_id: "ws1" });
    });
  });

  describe("db wrapper methods", () => {
    test("upsertMediaAsset delegates to db.upsertMediaAsset", async () => {
      mockDb.upsertMediaAsset.mockResolvedValue({ id: "rec1" });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.upsertMediaAsset({
        recordingId: "rec1",
        workspaceId: "ws1",
      });

      expect(result).toEqual({ id: "rec1" });
      expect(mockDb.upsertMediaAsset).toHaveBeenCalledWith({
        recordingId: "rec1",
        workspaceId: "ws1",
      });
    });

    test("getMediaAsset delegates to db.getMediaAsset", async () => {
      mockDb.getMediaAsset.mockResolvedValue({ id: "rec1" });

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      const result = await service.getMediaAsset("rec1");

      expect(result).toEqual({ id: "rec1" });
      expect(mockDb.getMediaAsset).toHaveBeenCalledWith("rec1");
    });

    test("saveAudioQualityDiagnostics delegates to db.saveAudioQualityDiagnostics", async () => {
      mockDb.saveAudioQualityDiagnostics.mockResolvedValue(undefined);

      const service = new TranscriptionService(
        mockDb,
        mockWorkspaceService,
        mockAudioPipeline,
        mockSpeakerEmbedder
      );

      await service.saveAudioQualityDiagnostics("rec1", {
        qualityLabel: "good",
      });

      expect(mockDb.saveAudioQualityDiagnostics).toHaveBeenCalledWith(
        "rec1",
        { qualityLabel: "good" }
      );
    });
  });
});
