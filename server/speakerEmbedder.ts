import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { config } from "./config.ts";

const SIMILARITY_THRESHOLD = 0.82;
const FFMPEG_BINARY = config.FFMPEG_BINARY;

let modelCache: any = null;
let processorCache: any = null;

async function getEmbeddingModels() {
  if (modelCache && processorCache) return { model: modelCache, processor: processorCache };
  try {
    const { AutoModel, AutoProcessor, env } = await import("@xenova/transformers") as any;
    
    // Potężne optymalizacje 10/10 dla środowiska Node.js:
    env.allowLocalModels = true;       // Preferuj cache lokalny
    env.use_env_vars = true;           // Pozwól na wymuszanie backendów
    const threads = Math.max(1, Math.floor(os.cpus().length / 2));
    if (env.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = threads;
    }
    // Dzięki ONNXRuntime-Node aplikacja C++ automatycznie porzuca ociężałe WASM.

    // Używamy skwantowanego modelu (q8/int8) dla drastycznego spadku zużycia VRAM/RAM (~380MB -> 95MB) -> "quantized: true"
    modelCache = await AutoModel.from_pretrained("Xenova/wavlm-base-plus-sv", {
      quantized: true,
      dtype: "int8", // Explicit INT8 
    });
    processorCache = await AutoProcessor.from_pretrained("Xenova/wavlm-base-plus-sv");
    return { model: modelCache, processor: processorCache };
  } catch (err: any) {

    console.error("[speakerEmbedder] Failed to load WavLM models:", err.message);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

/**
 * Decodes audio file to 16kHz mono Float32Array using ffmpeg.
 * Returns null if ffmpeg is unavailable.
 */
function decodeAudioToFloat32(inputPath: string) {
  const tmpPath = path.join(os.tmpdir(), `spkemb_${Date.now()}.raw`);
  try {
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${inputPath}" -ar 16000 -ac 1 -f f32le "${tmpPath}"`,
      { stdio: "pipe", timeout: 30000 }
    );
    const buf = fs.readFileSync(tmpPath);
    const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return float32;
  } catch (err: any) {
    console.warn("[speakerEmbedder] ffmpeg decode failed:", err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

/**
 * Compute a 512-dim embedding for an audio file.
 * Returns null on failure.
 */
export async function computeEmbedding(audioFilePath: string) {
  const models = await getEmbeddingModels();
  if (!models) return null;

  const pcm = decodeAudioToFloat32(audioFilePath);
  if (!pcm || pcm.length < 160) return null; // too short

  try {
    const inputs = await models.processor(pcm, 16000);
    const output = await models.model(inputs);
    
    // Normalize the 512-dim embedding vector (L2 norm)
    const arr = Array.from(output.embeddings.data) as number[];
    let sqSum = 0;
    for (let i = 0; i < arr.length; i++) {
        sqSum += arr[i] * arr[i];
    }
    const norm = Math.sqrt(sqSum) || 1e-8;
    return arr.map(v => v / norm);
  } catch (err: any) {
    console.error("[speakerEmbedder] Embedding computation failed:", err.message);
    return null;
  }
}

/**
 * Given a list of voice profiles (with .embedding arrays) and an audio file,
 * return the best matching profile name (or null if no match above threshold).
 */
export async function matchSpeakerToProfile(audioFilePath: string, voiceProfiles: any[]) {
  if (!voiceProfiles || !voiceProfiles.length) return null;

  const embedding = await computeEmbedding(audioFilePath);
  if (!embedding) return null;

  let best: any = null;
  let bestScore = SIMILARITY_THRESHOLD;

  for (const profile of voiceProfiles) {
    let profileEmbedding;
    try {
      profileEmbedding = typeof profile.embedding === "string"
        ? JSON.parse(profile.embedding)
        : profile.embedding;
    } catch (_) { continue; }

    if (!Array.isArray(profileEmbedding)) continue;
    const score = cosineSimilarity(embedding, profileEmbedding);
    if (score > bestScore) {
      bestScore = score;
      best = { name: profile.speaker_name, score };
    }
  }

  return best ? best.name : null;
}

