import { EventEmitter } from "node:events";
import { config } from "../config.ts";

export default class TranscriptionService extends EventEmitter {
  db: any;
  workspaceService: any;
  audioPipeline: any;
  speakerEmbedder: any;
  transcriptionJobs: Map<string, Promise<void>>;

  constructor(db: any, workspaceService: any, audioPipeline: any, speakerEmbedder: any) {
    super();
    this.db = db;
    this.workspaceService = workspaceService;
    this.audioPipeline = audioPipeline;
    this.speakerEmbedder = speakerEmbedder;
    this.transcriptionJobs = new Map();
  }

  get pipeline() {
    if (this.audioPipeline && typeof this.audioPipeline.transcribeRecording === "function") {
      return this.audioPipeline;
    }

    if (this.audioPipeline && Object.keys(this.audioPipeline).length === 0) {
      console.warn("[TranscriptionService] audioPipeline looks like an empty object (circular dep?).");
    }

    if (!this.audioPipeline) {
      throw new Error("Critical: TranscriptionService.audioPipeline is null or undefined. Check bootstrap injection.");
    }

    if (typeof this.audioPipeline.transcribeRecording !== "function") {
      throw new Error(`Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'. Found: ${typeof this.audioPipeline.transcribeRecording}`);
    }

    return this.audioPipeline;
  }

  async upsertMediaAsset(data: any) {
    return await this.db.upsertMediaAsset(data);
  }

  async upsertMediaAssetFromPath(data: any) {
    if (typeof this.db.upsertMediaAssetFromPath === "function") {
      return await this.db.upsertMediaAssetFromPath(data);
    }

    const fs = await import("node:fs/promises");
    return await this.db.upsertMediaAsset({
      ...data,
      buffer: await fs.readFile(data.filePath),
    });
  }

  async getMediaAsset(recordingId: string) {
    return await this.db.getMediaAsset(recordingId);
  }

  async deleteMediaAsset(recordingId: string, workspaceId: string) {
    return await this.db.deleteMediaAsset(recordingId, workspaceId);
  }

  async saveAudioQualityDiagnostics(recordingId: string, audioQuality: any) {
    return await this.db.saveAudioQualityDiagnostics(recordingId, audioQuality);
  }

  async updateTranscriptionMetadata(recordingId: string, updates: Record<string, unknown>) {
    if (typeof this.db.updateTranscriptionMetadata !== "function") {
      return null;
    }
    return await this.db.updateTranscriptionMetadata(recordingId, updates);
  }

  async queueTranscription(recordingId: string, updates: any) {
    return await this.db.queueTranscription(recordingId, updates);
  }

  async startTranscriptionPipeline(recordingId: string, asset: any, options: any) {
    await this.queueTranscription(recordingId, options);
    await this.ensureTranscriptionJob(recordingId, asset, options);
    return await this.getMediaAsset(recordingId);
  }

  async markTranscriptionProcessing(recordingId: string) {
    return await this.db.markTranscriptionProcessing(recordingId);
  }

  async saveTranscriptionResult(recordingId: string, result: any) {
    return await this.db.saveTranscriptionResult(recordingId, result);
  }

  async markTranscriptionFailure(
    recordingId: string,
    errorMessage: string,
    transcriptionDiagnostics: any = null,
    audioQuality: any = null
  ) {
    return await this.db.markTranscriptionFailure(recordingId, errorMessage, transcriptionDiagnostics, audioQuality);
  }

  async ensureTranscriptionJob(recordingId: string, asset: any, options: any) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) {
      return;
    }

    const jobPromise = Promise.resolve()
      .then(async () => {
        const startSTT = performance.now();
        const reqId = options.requestId || "internal-stt";
        const { logger } = await import("../logger.ts");
        const processingMode =
          options.processingMode === "full" || options.processingMode === "fast"
            ? options.processingMode
            : config.VOICELOG_PROCESSING_MODE_DEFAULT;
        const shouldRunPostprocess = processingMode === "fast" && config.VOICELOG_ENABLE_POSTPROCESS;
        let localSourcePath = "";
        let cleanupLocalSource = async () => {};

        logger.info("[Pipeline] Starting transcription job.", { requestId: reqId, recordingId, processingMode });

        const markProcessingPromise = this.markTranscriptionProcessing(recordingId);
        const [wsState, memberNames, voiceProfiles] = await Promise.all([
          this.db.getWorkspaceState(asset.workspace_id),
          this.workspaceService.getWorkspaceMemberNames(asset.workspace_id),
          this.db.getWorkspaceVoiceProfiles(asset.workspace_id),
        ]);
        await markProcessingPromise;

        if (typeof this.pipeline.materializeAssetToLocal === "function") {
          const materialized = await this.pipeline.materializeAssetToLocal(asset, { signal: options.signal });
          localSourcePath = materialized?.localPath || "";
          cleanupLocalSource =
            typeof materialized?.cleanup === "function"
              ? materialized.cleanup
              : cleanupLocalSource;
        }

        const sharedOptions = {
          ...options,
          processingMode,
          localSourcePath,
          participants: [
            ...(options.participants || []),
            ...memberNames,
          ],
          vocabulary: [
            ...(options.vocabulary ? [options.vocabulary] : []),
            ...(wsState.vocabulary || []),
          ].join(", "),
          voiceProfiles,
          onProgress: (payload: any) => {
            this.emit(`progress-${recordingId}`, payload);
          },
        };

        const result = await this.pipeline.transcribeRecording(asset, {
          ...sharedOptions,
          skipEarlyPyannote: processingMode !== "full",
          skipChunkVAD: processingMode !== "full" || !config.VOICELOG_ENABLE_CHUNK_VAD,
          skipVoiceProfileMatch: processingMode !== "full",
        });

        const isEmptyTranscript = result?.transcriptOutcome === "empty";
        this.emit(`progress-${recordingId}`, {
          progress: 100,
          enhancementsPending: Boolean(result?.enhancementsPending),
          postprocessStage: result?.postprocessStage || "",
          message: isEmptyTranscript
            ? (result?.userMessage || "Nie wykryto wypowiedzi w nagraniu.")
            : "Trener wymowy gotowy! (Zakonczono)",
        });

        await this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: "completed",
        });

        if (shouldRunPostprocess && !isEmptyTranscript) {
          this.runEnhancementPostProcess(
            recordingId,
            asset,
            {
              ...sharedOptions,
              processingMode: "full",
            },
            cleanupLocalSource
          ).catch((err: any) => {
            console.error("[Pipeline] Background post-process failed:", err?.message || err);
          });
        } else {
          await cleanupLocalSource();
        }

        logger.info("[Metrics] Pipeline completed successfully.", {
          requestId: reqId,
          recordingId,
          durationMs: (performance.now() - startSTT).toFixed(2),
          confidence: result.diarization?.confidence || 0,
        });

        if (!isEmptyTranscript && result.segments && result.segments.length > 0) {
          this.vectorizeTranscriptionResultToRAG(asset.workspace_id, recordingId, result.segments).catch((err) => {
            console.error("[RAG] Background vectorization failed:", err);
          });
        }
      })
      .catch(async (error: any) => {
        await this.markTranscriptionFailure(
          recordingId,
          error.message,
          error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === "object"
            ? error.transcriptionDiagnostics
            : null,
          error?.audioQuality && typeof error.audioQuality === "object"
            ? error.audioQuality
            : null
        );
      })
      .finally(() => {
        this.transcriptionJobs.delete(recordingId);
      });

    this.transcriptionJobs.set(recordingId, jobPromise);
  }

  async runEnhancementPostProcess(
    recordingId: string,
    asset: any,
    options: any,
    cleanupLocalSource: () => Promise<void>
  ) {
    const reqId = options.requestId || "internal-stt";
    const { logger } = await import("../logger.ts");

    try {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: true,
        postprocessStage: "running",
      });
      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: true,
        postprocessStage: "running",
        message: "Trwa dopinanie diarization i dopasowania glosow...",
      });

      const fullResult = await this.pipeline.transcribeRecording(asset, {
        ...options,
        processingMode: "full",
        skipEarlyPyannote: false,
        skipChunkVAD: !config.VOICELOG_ENABLE_CHUNK_VAD,
        skipVoiceProfileMatch: false,
      });

      await this.saveTranscriptionResult(recordingId, {
        ...fullResult,
        pipelineStatus: "completed",
        enhancementsPending: false,
        postprocessStage: "done",
      });

      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: false,
        postprocessStage: "done",
        message: "Dodatkowe przetwarzanie zakonczone.",
      });

      logger.info("[Pipeline] Background post-process completed.", {
        requestId: reqId,
        recordingId,
      });
    } catch (error: any) {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: false,
        postprocessStage: "failed",
      });
      logger.warn("[Pipeline] Background post-process failed.", {
        requestId: reqId,
        recordingId,
        message: error?.message || String(error),
      });
    } finally {
      await cleanupLocalSource();
    }
  }

  async normalizeRecording(filePath: string, options = {}) {
    return this.pipeline.normalizeRecording(filePath, options);
  }

  async analyzeAudioQuality(filePath: string, options = {}) {
    if (typeof this.pipeline.analyzeAudioQuality !== "function") {
      throw new Error("Audio pipeline nie wspiera analizy jakosci audio.");
    }
    return this.pipeline.analyzeAudioQuality(filePath, options);
  }

  async generateVoiceCoaching(asset: any, speakerId: string, segments: any[], options = {}) {
    return this.pipeline.generateVoiceCoaching(asset, speakerId, segments, options);
  }

  async getSpeakerAcousticFeatures(asset: any, options = {}) {
    if (typeof this.pipeline.analyzeAcousticFeatures !== "function") {
      throw new Error("Audio pipeline nie wspiera metryk akustycznych.");
    }

    const fs = await import("node:fs/promises");

    let segments = [];
    let diarization = {};
    try { segments = JSON.parse(asset.transcript_json || "[]"); } catch (_) {}
    try { diarization = JSON.parse(asset.diarization_json || "{}"); } catch (_) {}
    if (!segments.length) throw new Error("Brak transkrypcji w bazie.");

    const speakerNames = typeof diarization === "object" && diarization ? (diarization as any).speakerNames || {} : {};
    const uniqueSpeakerIds = [...new Set(segments.map((segment: any) => String(segment?.speakerId ?? "")).filter(Boolean))];
    const speakers = new Array(uniqueSpeakerIds.length);
    const concurrency = Math.min(3, Math.max(1, uniqueSpeakerIds.length));
    let cursor = 0;

    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < uniqueSpeakerIds.length) {
        const index = cursor;
        cursor += 1;
        const speakerId = uniqueSpeakerIds[index];
        const clipPath = await this.pipeline.extractSpeakerAudioClip(asset, speakerId, segments, options);
        try {
          const metrics = await this.pipeline.analyzeAcousticFeatures(clipPath, options);
          speakers[index] = {
            speakerId,
            speakerName: String(
              speakerNames?.[speakerId] ||
              segments.find((segment: any) => String(segment?.speakerId ?? "") === speakerId)?.speakerName ||
              `Speaker ${Number(speakerId) + 1}`
            ),
            ...metrics,
          };
        } finally {
          try { await fs.unlink(clipPath); } catch (_) {}
        }
      }
    });

    await Promise.all(workers);
    return { speakers: speakers.filter(Boolean) };
  }

  async createVoiceProfileFromSpeaker(asset: any, speakerId: string, speakerName: string, userId: string, options = {}) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const crypto = await import("node:crypto");

    let segments = [];
    try { segments = JSON.parse(asset.transcript_json || "[]"); } catch (_) {}
    if (!segments.length) throw new Error("Brak transkrypcji w bazie.");

    const clipPath = await this.pipeline.extractSpeakerAudioClip(asset, speakerId, segments, options);

    try {
      const embedding = await this.computeEmbedding(clipPath);
      const profileId = `vp_${crypto.randomUUID().replace(/-/g, "")}`;
      const newPath = path.join(this.db.uploadDir, `${profileId}.wav`);

      fs.renameSync(clipPath, newPath);
      const profile = await this.workspaceService.saveVoiceProfile({
        id: profileId,
        userId,
        workspaceId: asset.workspace_id,
        speakerName,
        audioPath: newPath,
        embedding: embedding || [],
      });
      return profile;
    } finally {
      try { fs.unlinkSync(clipPath); } catch (_) {}
    }
  }

  async diarizeFromTranscript(whisperLike: any[], options = {}) {
    return this.pipeline.diarizeFromTranscript(whisperLike, options);
  }

  async transcribeLiveChunk(tmpPath: string, contentType: string, options = {}) {
    return this.pipeline.transcribeLiveChunk(tmpPath, contentType, options);
  }

  async analyzeMeetingWithOpenAI(data: any) {
    return this.pipeline.analyzeMeetingWithOpenAI(data);
  }

  async computeEmbedding(audioPath: string) {
    if (!this.speakerEmbedder) {
      const { computeEmbedding } = await import("../speakerEmbedder.ts");
      this.speakerEmbedder = { computeEmbedding };
    }
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }

  async vectorizeTranscriptionResultToRAG(workspaceId: string, recordingId: string, segments: any[]) {
    if (!this.audioPipeline?.embedTextChunks) return;
    const crypto = await import("node:crypto");

    const chunks = [];
    for (let i = 0; i < segments.length; i += 3) {
      const slice = segments.slice(i, i + 3);
      if (!slice.length) continue;
      const text = slice.map((s) => s.text).join(" ");
      if (text.length < 15) continue;
      chunks.push({
        id: `rc_${crypto.randomUUID().replace(/-/g, "")}`,
        workspaceId,
        recordingId,
        speakerName: slice[0].speakerId || "Nieznany",
        text,
        createdAt: new Date().toISOString(),
      });
    }

    if (!chunks.length) return;

    const textsToEmbed = chunks.map((chunk) => chunk.text);
    const embeddings = await this.audioPipeline.embedTextChunks(textsToEmbed);

    if (!embeddings || embeddings.length !== chunks.length) {
      console.warn("[RAG] Odrzucono pakiet blokow ze wzgledu na blad API Embeddings.");
      return;
    }

    const payload = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    if (typeof this.db.saveRagChunks === "function") {
      await this.db.saveRagChunks(payload);
    } else {
      for (const chunk of payload) {
        await this.db.saveRagChunk(chunk);
      }
    }

    console.log(`[RAG] Pomyslnie zindeksowano ${chunks.length} wektorow na archiwum spotkania.`);
  }

  async queryRAG(workspaceId: string, question: string) {
    if (!this.audioPipeline?.embedTextChunks) return null;

    const qEmbeddings = await this.audioPipeline.embedTextChunks([question]);
    if (!qEmbeddings || !qEmbeddings[0]) return null;
    const qVec = qEmbeddings[0];

    const allChunks = await this.db.getAllRagChunksForWorkspace(workspaceId);
    if (!allChunks || allChunks.length === 0) return null;

    function dotProduct(a: number[], b: number[]) {
      let sum = 0;
      for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
      return sum;
    }

    function magnitude(a: number[]) {
      let sum = 0;
      for (let i = 0; i < a.length; i += 1) sum += a[i] * a[i];
      return Math.sqrt(sum);
    }

    const qMag = magnitude(qVec);
    const scored = allChunks.map((chunk) => {
      let vec = [];
      try { vec = JSON.parse(chunk.embedding_json); } catch (_) {}
      if (!vec.length) return { chunk, score: -1 };
      const score = dotProduct(qVec, vec) / (qMag * magnitude(vec));
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, 15).filter((item) => item.score > 0.1);

    return topChunks.map((item) => item.chunk);
  }
}
