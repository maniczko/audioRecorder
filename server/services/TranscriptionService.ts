import { EventEmitter } from "node:events";

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
    if (this.audioPipeline && typeof this.audioPipeline.transcribeRecording === 'function') {
      return this.audioPipeline;
    }
    
    // Safety fallback: if injection failed but we are in a context where we can try to recover
    if (this.audioPipeline && Object.keys(this.audioPipeline).length === 0) {
       console.warn("[TranscriptionService] audioPipeline looks like an empty object (circular dep?).");
    }

    if (!this.audioPipeline) {
       throw new Error("Critical: TranscriptionService.audioPipeline is null or undefined. Check bootstrap injection.");
    }
    
    if (typeof this.audioPipeline.transcribeRecording !== 'function') {
       throw new Error(`Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'. Found: ${typeof this.audioPipeline.transcribeRecording}`);
    }

    return this.audioPipeline;
  }

  async upsertMediaAsset(data: any) {
    return await this.db.upsertMediaAsset(data);
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

  async queueTranscription(recordingId: string, updates: any) {
    return await this.db.queueTranscription(recordingId, updates);
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

        logger.info(`[Pipeline] Rozpoczynam transkrypcję i analizę audio.`, { requestId: reqId, recordingId });
        await this.markTranscriptionProcessing(recordingId);
        
        const wsState = await this.db.getWorkspaceState(asset.workspace_id);
        const result = await this.pipeline.transcribeRecording(asset, {
          ...options,
          onProgress: (payload) => {
            this.emit(`progress-${recordingId}`, payload);
          },
          participants: [
            ...(options.participants || []),
            ...(await this.workspaceService.getWorkspaceMemberNames(asset.workspace_id))
          ],
          vocabulary: [
            ...(options.vocabulary ? [options.vocabulary] : []),
            ...(wsState.vocabulary || [])
          ].join(", "),
          voiceProfiles: await this.db.getWorkspaceVoiceProfiles(asset.workspace_id),
        });
        
        const isEmptyTranscript = result?.transcriptOutcome === "empty";
        this.emit(`progress-${recordingId}`, {
          progress: 100,
          message: isEmptyTranscript
            ? (result?.userMessage || "Nie wykryto wypowiedzi w nagraniu.")
            : "Trener wymowy gotowy! (Zakończono)",
        });

        await this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: "completed",
        });

        logger.info(`[Metrics] Całkowity Pipeline Czas Zakończony (Transkrypcja + LLM = Sukces)`, { 
          requestId: reqId, 
          recordingId: recordingId,
          durationMs: (performance.now() - startSTT).toFixed(2),
          confidence: result.diarization?.confidence || 0,
        });

        // Wectorize for RAG in the background without blocking the UI updates
        if (!isEmptyTranscript && result.segments && result.segments.length > 0) {
          this.vectorizeTranscriptionResultToRAG(asset.workspace_id, recordingId, result.segments).catch(err => {
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
        id: profileId, userId, workspaceId: asset.workspace_id,
        speakerName, audioPath: newPath, embedding: embedding || []
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
      // Lazy load speakerEmbedder if needed
      const { computeEmbedding } = await import('../speakerEmbedder.ts');
      this.speakerEmbedder = { computeEmbedding };
    }
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }

  // --- RAG Subsystem ---

  async vectorizeTranscriptionResultToRAG(workspaceId: string, recordingId: string, segments: any[]) {
    if (!this.audioPipeline?.embedTextChunks) return;
    const crypto = await import("node:crypto");

    // Budujemy bloki co 3 segmenty, by zminimalizować szumy i dodać kontekst uderzeń (RAG Chunking)
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

    // Przetwarzamy tekst na Embeddingi OpenAI (wszystko w jednym Batch'u)
    const textsToEmbed = chunks.map(c => c.text);
    const embeddings = await this.audioPipeline.embedTextChunks(textsToEmbed);

    if (!embeddings || embeddings.length !== chunks.length) {
      console.warn("[RAG] Odrzucono pakiet bloków ze względu na błąd API Embeddings.");
      return;
    }

    // Zapis do bazy danych
    for (let i = 0; i < chunks.length; i++) {
       await this.db.saveRagChunk({
         ...chunks[i],
         embedding: embeddings[i]
       });
    }
    console.log(`[RAG] Pomyślnie zindeksowano ${chunks.length} wektorów na archiwum spotkania.`);
  }

  async queryRAG(workspaceId: string, question: string) {
    if (!this.audioPipeline?.embedTextChunks) return null;

    // Bierzemy embedding pytania
    const qEmbeddings = await this.audioPipeline.embedTextChunks([question]);
    if (!qEmbeddings || !qEmbeddings[0]) return null;
    const qVec = qEmbeddings[0];

    // Pobieramy wszystkie chunki wektorowe RAG z Workspace'a
    const allChunks = await this.db.getAllRagChunksForWorkspace(workspaceId);
    if (!allChunks || allChunks.length === 0) return null;

    // Obliczamy Similarities czystym JS'em żeby pominąć ciężkie wdrożenia (tylko 50ms)
    function dotProduct(a: number[], b: number[]) {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
      return sum;
    }
    function magnitude(a: number[]) {
      let sum = 0;
      for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
      return Math.sqrt(sum);
    }
    
    const qMag = magnitude(qVec);

    const scored = allChunks.map(chunk => {
      let vec = [];
      try { vec = JSON.parse(chunk.embedding_json); } catch(_) {}
      if (!vec.length) return { chunk, score: -1 };
      const score = dotProduct(qVec, vec) / (qMag * magnitude(vec));
      return { chunk, score };
    });

    // Bierzemy top 10 kawałków
    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, 15).filter(s => s.score > 0.1);
    
    return topChunks.map(s => s.chunk);
  }
}
