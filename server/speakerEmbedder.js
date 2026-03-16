/**
 * Speaker embedding using WavLM (via @xenova/transformers ONNX).
 * Requires ffmpeg on PATH for audio decoding.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const SIMILARITY_THRESHOLD = 0.82;
const FFMPEG_BINARY = process.env.FFMPEG_BINARY || "ffmpeg";

let pipelineCache = null;

async function getEmbeddingPipeline() {
  if (pipelineCache) return pipelineCache;
  try {
    const { pipeline, env } = await import("@xenova/transformers");
    env.allowLocalModels = false; // force download from HuggingFace
    pipelineCache = await pipeline("feature-extraction", "Xenova/wavlm-base-plus-sv", {
      quantized: true,
    });
    return pipelineCache;
  } catch (err) {
    console.error("[speakerEmbedder] Failed to load WavLM pipeline:", err.message);
    return null;
  }
}

function cosineSimilarity(a, b) {
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
function decodeAudioToFloat32(inputPath) {
  const tmpPath = path.join(os.tmpdir(), `spkemb_${Date.now()}.raw`);
  try {
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${inputPath}" -ar 16000 -ac 1 -f f32le "${tmpPath}"`,
      { stdio: "pipe", timeout: 30000 }
    );
    const buf = fs.readFileSync(tmpPath);
    const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return float32;
  } catch (err) {
    console.warn("[speakerEmbedder] ffmpeg decode failed:", err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

/**
 * Compute a 768-dim embedding for an audio file.
 * Returns null on failure.
 */
async function computeEmbedding(audioFilePath) {
  const pipe = await getEmbeddingPipeline();
  if (!pipe) return null;

  const pcm = decodeAudioToFloat32(audioFilePath);
  if (!pcm || pcm.length < 160) return null; // too short

  try {
    const output = await pipe(pcm, {
      sampling_rate: 16000,
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  } catch (err) {
    console.error("[speakerEmbedder] Embedding computation failed:", err.message);
    return null;
  }
}

/**
 * Given a list of voice profiles (with .embedding arrays) and an audio file,
 * return the best matching profile name (or null if no match above threshold).
 */
async function matchSpeakerToProfile(audioFilePath, voiceProfiles) {
  if (!voiceProfiles || !voiceProfiles.length) return null;

  const embedding = await computeEmbedding(audioFilePath);
  if (!embedding) return null;

  let best = null;
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

module.exports = { computeEmbedding, matchSpeakerToProfile, cosineSimilarity };
