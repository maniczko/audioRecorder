class TranscriptionService {
  constructor(db, audioPipeline, speakerEmbedder) {
    this.db = db;
    this.audioPipeline = audioPipeline;
    this.speakerEmbedder = speakerEmbedder;
    this.transcriptionJobs = new Map();
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
        const result = await this.audioPipeline.transcribeRecording(asset, {
          ...options,
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

  async normalizeRecording(filePath) {
    return this.audioPipeline.normalizeRecording(filePath);
  }

  async generateVoiceCoaching(asset, speakerId, segments) {
    return this.audioPipeline.generateVoiceCoaching(asset, speakerId, segments);
  }

  async diarizeFromTranscript(whisperLike) {
    return this.audioPipeline.diarizeFromTranscript(whisperLike);
  }

  async transcribeLiveChunk(tmpPath, contentType) {
    return this.audioPipeline.transcribeLiveChunk(tmpPath, contentType);
  }

  async analyzeMeetingWithOpenAI(data) {
    return this.audioPipeline.analyzeMeetingWithOpenAI(data);
  }

  async computeEmbedding(audioPath) {
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }
}

module.exports = TranscriptionService;
