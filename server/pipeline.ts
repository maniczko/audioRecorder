```typescript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { matchSpeakerToProfile } from "./speakerEmbedder.ts";
import { getSttModelForProcessingMode } from "./stt/modelSelector.ts";

// ── Sub-module imports ────────────────────────────────────────────────────────
import {
  getUploadDir,
  buildAudioPreprocessCacheKey,
  getPreprocessCachePath,
  isPreprocessCacheFile,
  resolveStoredAudioQuality,
  analyzeAudioQuality,
  preprocessAudio,
  requestAudioTranscription,
  runSileroVAD,
  transcribeInChunks,
  mergeChunkedPayloads,
  transcribeLiveChunk,
  _sttUseGroq,
  VERIFICATION_MODEL,
  STT_PROVIDER_CHAIN,
  SILENCE_REMOVE,
  MAX_FILE_SIZE_BYTES,
} from "./transcription.ts";

import {
  runPyannoteDiarization,
  mergeWithPyannote,
  splitSegmentsByWordSpeaker,
  diarizeFromTranscript,
  applyPerSpeakerNorm,
  VOICELOG_DIARIZER,
  HF_TOKEN_SET,
} from "./diarization.ts";

import {
  correctTranscriptWithLLM,
  analyzeMeetingWithOpenAI,
  embedTextChunks,
  extractSpeakerAudioClip,
  generateVoiceCoaching,
  analyzeAcousticFeatures,
  normalizeRecording,
} from "./postProcessing.ts";

import {
  buildWhisperPrompt,
  buildVerificationResult,
  buildEmptyTranscriptResult,
  normalizeVerificationSegments,
  normalizeDiarizedSegments,
  computeWerProxy,
  isHallucination,
  removeConsecutiveDuplicates,
  mergeShortSegments,
  clean,
  getRawWords,
} from "./audioPipeline.utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ────────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
const AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;
const PER_SPEAKER_NORM = config.VOICELOG_PER_SPEAKER_NORM;
const DEBUG = process.env.VOICELOG_DEBUG === "true";

// ── Internal helpers ──────────────────────────────────────────────────────────

function isRemoteAudioPath(filePath: string) {
  return Boolean(
    filePath && !filePath.includes(path.sep) && !filePath.includes("/")
  );
}

function buildAudioQualityForAttempt(
  audioQuality: any,
  profile: "standard" | "enhanced",
  enhancementApplied = false
) {
  if (!audioQuality || typeof audioQuality !== "object") return null;
  return {
    ...audioQuality,
    enhancementApplied,
    enhancementProfile: enhancementApplied ? profile : "none",
  };
}

function shouldRetryWithEnhancedProfile(
  profile: "standard" | "enhanced",
  attemptCount: number,
  outcome: any
) {
  if (profile !== "standard" || attemptCount >= 2) return false;
  return outcome === "retry";
}

// Ensure VAD_ENABLED is defined
const VAD_ENABLED = process.env.VAD_ENABLED === "true"; // Added definition for VAD_ENABLED

// Rest of the code...
```

