var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
let modelCache = null;
let processorCache = null;
async function getEmbeddingModels() {
    if (modelCache && processorCache)
        return { model: modelCache, processor: processorCache };
    try {
        const { AutoModel, AutoProcessor, env } = await Promise.resolve().then(() => __importStar(require("@xenova/transformers")));
        env.allowLocalModels = false; // force download from HuggingFace
        modelCache = await AutoModel.from_pretrained("Xenova/wavlm-base-plus-sv", {
            quantized: false,
        });
        processorCache = await AutoProcessor.from_pretrained("Xenova/wavlm-base-plus-sv");
        return { model: modelCache, processor: processorCache };
    }
    catch (err) {
        console.error("[speakerEmbedder] Failed to load WavLM models:", err.message);
        return null;
    }
}
function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length)
        return 0;
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
        execSync(`"${FFMPEG_BINARY}" -y -i "${inputPath}" -ar 16000 -ac 1 -f f32le "${tmpPath}"`, { stdio: "pipe", timeout: 30000 });
        const buf = fs.readFileSync(tmpPath);
        const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        return float32;
    }
    catch (err) {
        console.warn("[speakerEmbedder] ffmpeg decode failed:", err.message);
        return null;
    }
    finally {
        try {
            fs.unlinkSync(tmpPath);
        }
        catch (_) { }
    }
}
/**
 * Compute a 512-dim embedding for an audio file.
 * Returns null on failure.
 */
async function computeEmbedding(audioFilePath) {
    const models = await getEmbeddingModels();
    if (!models)
        return null;
    const pcm = decodeAudioToFloat32(audioFilePath);
    if (!pcm || pcm.length < 160)
        return null; // too short
    try {
        const inputs = await models.processor(pcm, 16000);
        const output = await models.model(inputs);
        // Normalize the 512-dim embedding vector (L2 norm)
        const arr = Array.from(output.embeddings.data);
        let sqSum = 0;
        for (let i = 0; i < arr.length; i++) {
            sqSum += arr[i] * arr[i];
        }
        const norm = Math.sqrt(sqSum) || 1e-8;
        return arr.map(v => v / norm);
    }
    catch (err) {
        console.error("[speakerEmbedder] Embedding computation failed:", err.message);
        return null;
    }
}
/**
 * Given a list of voice profiles (with .embedding arrays) and an audio file,
 * return the best matching profile name (or null if no match above threshold).
 */
async function matchSpeakerToProfile(audioFilePath, voiceProfiles) {
    if (!voiceProfiles || !voiceProfiles.length)
        return null;
    const embedding = await computeEmbedding(audioFilePath);
    if (!embedding)
        return null;
    let best = null;
    let bestScore = SIMILARITY_THRESHOLD;
    for (const profile of voiceProfiles) {
        let profileEmbedding;
        try {
            profileEmbedding = typeof profile.embedding === "string"
                ? JSON.parse(profile.embedding)
                : profile.embedding;
        }
        catch (_) {
            continue;
        }
        if (!Array.isArray(profileEmbedding))
            continue;
        const score = cosineSimilarity(embedding, profileEmbedding);
        if (score > bestScore) {
            bestScore = score;
            best = { name: profile.speaker_name, score };
        }
    }
    return best ? best.name : null;
}
module.exports = { computeEmbedding, matchSpeakerToProfile, cosineSimilarity };
