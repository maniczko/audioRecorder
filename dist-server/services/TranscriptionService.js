class TranscriptionService {
    constructor(db, workspaceService, audioPipeline, speakerEmbedder) {
        this.db = db;
        this.workspaceService = workspaceService;
        this.audioPipeline = audioPipeline;
        this.speakerEmbedder = speakerEmbedder;
        this.transcriptionJobs = new Map();
    }
    get pipeline() {
        if (this.audioPipeline)
            return this.audioPipeline;
        this.audioPipeline = require('../audioPipeline');
        return this.audioPipeline;
    }
    async upsertMediaAsset(data) {
        return await this.db.upsertMediaAsset(data);
    }
    async getMediaAsset(recordingId) {
        return await this.db.getMediaAsset(recordingId);
    }
    async queueTranscription(recordingId, updates) {
        return await this.db.queueTranscription(recordingId, updates);
    }
    async markTranscriptionProcessing(recordingId) {
        return await this.db.markTranscriptionProcessing(recordingId);
    }
    async saveTranscriptionResult(recordingId, result) {
        return await this.db.saveTranscriptionResult(recordingId, result);
    }
    async markTranscriptionFailure(recordingId, errorMessage) {
        return await this.db.markTranscriptionFailure(recordingId, errorMessage);
    }
    async ensureTranscriptionJob(recordingId, asset, options) {
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
            .catch(async (error) => {
            await this.markTranscriptionFailure(recordingId, error.message);
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
        if (!this.speakerEmbedder) {
            this.speakerEmbedder = require('../speakerEmbedder');
        }
        return this.speakerEmbedder.computeEmbedding(audioPath);
    }
}
module.exports = TranscriptionService;
