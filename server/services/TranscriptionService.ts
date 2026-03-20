export default class TranscriptionService {
  db: any;
  workspaceService: any;
  audioPipeline: any;
  speakerEmbedder: any;
  transcriptionJobs: Map<string, Promise<void>>;

  constructor(db: any, workspaceService: any, audioPipeline: any, speakerEmbedder: any) {
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

  async queueTranscription(recordingId: string, updates: any) {
    return await this.db.queueTranscription(recordingId, updates);
  }

  async markTranscriptionProcessing(recordingId: string) {
    return await this.db.markTranscriptionProcessing(recordingId);
  }

  async saveTranscriptionResult(recordingId: string, result: any) {
    return await this.db.saveTranscriptionResult(recordingId, result);
  }

  async markTranscriptionFailure(recordingId: string, errorMessage: string) {
    return await this.db.markTranscriptionFailure(recordingId, errorMessage);
  }

  async ensureTranscriptionJob(recordingId: string, asset: any, options: any) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) {
      return;
    }

    const jobPromise = Promise.resolve()
      .then(async () => {
        await this.markTranscriptionProcessing(recordingId);
        const wsState = await this.db.getWorkspaceState(asset.workspace_id);
        const result = await this.pipeline.transcribeRecording(asset, {
          ...options,
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
        await this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: "completed",
        });
      })
      .catch(async (error: any) => {
        await this.markTranscriptionFailure(recordingId, error.message);
      })
      .finally(() => {
        this.transcriptionJobs.delete(recordingId);
      });

    this.transcriptionJobs.set(recordingId, jobPromise);
  }

  async normalizeRecording(filePath: string, options = {}) {
    return this.pipeline.normalizeRecording(filePath, options);
  }

  async generateVoiceCoaching(asset: any, speakerId: string, segments: any[], options = {}) {
    return this.pipeline.generateVoiceCoaching(asset, speakerId, segments, options);
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
}

