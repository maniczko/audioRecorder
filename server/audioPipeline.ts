/**
 * audioPipeline.ts — backward-compatibility re-export shim
 *
 * All logic has been split into:
 *   server/transcription.ts   — STT, chunking, preprocessing, audio quality
 *   server/diarization.ts     — pyannote, VAD, GPT diarization, per-speaker norm
 *   server/postProcessing.ts  — LLM correction, analysis, coaching, embeddings
 *   server/pipeline.ts        — orchestration (transcribeRecording)
 *
 * This file re-exports everything so existing imports keep working.
 */
export * from './pipeline.ts';
