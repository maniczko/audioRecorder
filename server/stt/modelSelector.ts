/**
 * modelSelector.ts
 *
 * Selects appropriate STT model based on processing mode.
 * - "fast": Uses smaller/faster model (e.g., whisper-tiny, groq turbo)
 * - "full": Uses larger/more accurate model (e.g., whisper-large-v3)
 */

import { config } from "../config.ts";

export function getSttModelForProcessingMode(processingMode: "fast" | "full"): string {
  if (processingMode === "fast") {
    // Fast mode: use smaller model for quicker transcription
    // Can be configured via VOICELOG_STT_MODEL_FAST env var
    // Examples: "whisper-1", "groq/whisper-large-v3-turbo", "groq/whisper-large-v3"
    return config.VOICELOG_STT_MODEL_FAST || "whisper-1";
  }

  // Full mode: use larger model for better accuracy
  // Can be configured via VOICELOG_STT_MODEL_FULL env var
  return config.VOICELOG_STT_MODEL_FULL || "whisper-1";
}

export function shouldUseFastModel(processingMode: string): boolean {
  return processingMode === "fast";
}
