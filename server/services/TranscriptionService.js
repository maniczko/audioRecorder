class TranscriptionService {
  constructor(db, workspaceService, audioPipeline, speakerEmbedder) {
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
    console.error(`[TranscriptionService] audioPipeline missing methods. Keys: ${Object.keys(this.audioPipeline || {})}. Recovering...`);
    const fallback = require('../audioPipeline');
    this.audioPipeline = fallback;
    return fallback;
  }

  upsertMediaAsset(data) {
    return this.db.upsertMediaAsset(data);
  }

  getMediaAsset(recordingId) {
    return this.db.getMediaAsset(recordingId);
  }

  queueTranscription(recordingId, updates) {
    return this.db.queueTranscription(recordingId, updates);
  }

  markTranscriptionProcessing(recordingId) {
    return this.db.markTranscriptionProcessing(recordingId);
  }

  saveTranscriptionResult(recordingId, result) {
    return this.db.saveTranscriptionResult(recordingId, result);
  }

  markTranscriptionFailure(recordingId, errorMessage) {
    return this.db.markTranscriptionFailure(recordingId, errorMessage);
  }

  ensureTranscriptionJob(recordingId, asset, options) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) {
      return;
    }

    const jobPromise = Promise.resolve()
      .then(async () => {
        this.markTranscriptionProcessing(recordingId);
        const wsState = this.db.getWorkspaceState(asset.workspace_id);
        const result = await this.pipeline.transcribeRecording(asset, {
          ...options,
          participants: [
            ...(options.participants || []),
            ...this.workspaceService.getWorkspaceMemberNames(asset.workspace_id)
          ],
          vocabulary: [
            ...(options.vocabulary ? [options.vocabulary] : []),
            ...(wsState.vocabulary || [])
          ].join(", "),
          voiceProfiles: this.db.getWorkspaceVoiceProfiles(asset.workspace_id),
        });
        this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: "completed",
        });
      })
      .catch((error) => {
        this.markTranscriptionFailure(recordingId, error.message);
      })
      .finally(() => {
        this.transcriptionJobs.delete(recordingId);
      });

    this.transcriptionJobs.set(recordingId, jobPromise);
  }

  async normalizeRecording(filePath, options = {}) {
    return this.pipeline.normalizeRecording(filePath, options);
  }

  async generateVoiceCoaching(asset, speakerId, segments, options = {}) {
    return this.pipeline.generateVoiceCoaching(asset, speakerId, segments, options);
  }

  async diarizeFromTranscript(whisperLike, options = {}) {
    return this.pipeline.diarizeFromTranscript(whisperLike, options);
  }

  async transcribeLiveChunk(tmpPath, contentType, options = {}) {
    return this.pipeline.transcribeLiveChunk(tmpPath, contentType, options);
  }

  async analyzeMeetingWithOpenAI(data) {
    return this.pipeline.analyzeMeetingWithOpenAI(data);
  }

  async computeEmbedding(audioPath) {
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }
}

module.exports = TranscriptionService;
