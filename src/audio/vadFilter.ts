/**
 * vadFilter.ts — Silence removal for audio blobs before upload.
 *
 * Uses Web Audio API amplitude analysis to detect speech activity and strips
 * silence gaps > 2s from the upload blob. The original local blob is unchanged.
 *
 * Falls back to the original blob on any error (e.g., AudioContext unavailable,
 * browser compatibility issues).
 *
 * Note: upgrade path to ML-based SileroVAD via @ricky0123/vad-web when
 * onnxruntime-web ≥1.17 is available in this project.
 */

const FRAME_S = 0.05; // 50ms analysis window
const SPEECH_THRESHOLD_DB = -42; // RMS threshold below which a frame is "silent"
const MIN_SILENCE_REMOVE_S = 2.0; // Only strip silence gaps longer than this
const PRE_PAD_S = 0.25; // Keep 250ms before each speech onset
const POST_PAD_S = 0.35; // Keep 350ms after each speech offset

export interface VadFilterResult {
  /** Filtered (or original) blob ready for upload */
  blob: Blob;
  originalDurationS: number;
  filteredDurationS: number;
  /** Seconds of silence removed (0 if fallback / no significant silence) */
  removedS: number;
}

/** Encode mono Float32 PCM samples as a standard IEEE-float WAV. */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 4);
  const v = new DataView(buf);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 4, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); // IEEE float
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 32, true);
  write(36, 'data');
  v.setUint32(40, samples.length * 4, true);
  for (let i = 0; i < samples.length; i++) v.setFloat32(44 + i * 4, samples[i], true);
  return buf;
}

/**
 * Remove silence gaps > MIN_SILENCE_REMOVE_S from an audio blob.
 * Returns a shorter WAV blob, or the original blob if nothing was removed
 * or on any error.
 */
export async function filterSilence(blob: Blob): Promise<VadFilterResult> {
  const fallback = (dur = 0): VadFilterResult => ({
    blob,
    originalDurationS: dur,
    filteredDurationS: dur,
    removedS: 0,
  });

  try {
    const ArrayCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!ArrayCtx) return fallback();

    const audioCtx = new ArrayCtx();
    let decoded: AudioBuffer;
    try {
      const arrBuf = await blob.arrayBuffer();
      decoded = await audioCtx.decodeAudioData(arrBuf);
    } finally {
      audioCtx.close();
    }

    const { sampleRate, duration: originalDurationS } = decoded;
    const pcm = decoded.getChannelData(0); // Use first (or only) channel

    // Per-frame RMS analysis
    const frameSamples = Math.round(FRAME_S * sampleRate);
    const threshLin = Math.pow(10, SPEECH_THRESHOLD_DB / 20);
    const frameCount = Math.ceil(pcm.length / frameSamples);
    const isSpeech = new Uint8Array(frameCount);

    for (let f = 0; f < frameCount; f++) {
      const start = f * frameSamples;
      const end = Math.min(start + frameSamples, pcm.length);
      let rmsSum = 0;
      for (let i = start; i < end; i++) rmsSum += pcm[i] * pcm[i];
      if (Math.sqrt(rmsSum / (end - start)) > threshLin) isSpeech[f] = 1;
    }

    // Expand speech regions with padding
    const prePad = Math.round(PRE_PAD_S / FRAME_S);
    const postPad = Math.round(POST_PAD_S / FRAME_S);
    const expanded = new Uint8Array(frameCount);
    for (let f = 0; f < frameCount; f++) {
      if (isSpeech[f]) {
        const lo = Math.max(0, f - prePad);
        const hi = Math.min(frameCount - 1, f + postPad);
        for (let p = lo; p <= hi; p++) expanded[p] = 1;
      }
    }

    // Collect contiguous speech segments
    type Seg = { start: number; end: number };
    const segs: Seg[] = [];
    let segStart = -1;
    for (let f = 0; f <= frameCount; f++) {
      const active = f < frameCount && expanded[f];
      if (active && segStart < 0) {
        segStart = f;
      } else if (!active && segStart >= 0) {
        segs.push({ start: segStart, end: f });
        segStart = -1;
      }
    }

    if (segs.length === 0) return fallback(originalDurationS);

    // Count speech samples and measure removed silence
    let speechSamples = 0;
    for (const seg of segs) {
      const s = seg.start * frameSamples;
      const e = Math.min(seg.end * frameSamples, pcm.length);
      speechSamples += e - s;
    }

    const filteredDurationS = speechSamples / sampleRate;
    const removedS = originalDurationS - filteredDurationS;

    if (removedS < MIN_SILENCE_REMOVE_S) return fallback(originalDurationS);

    // Assemble filtered PCM
    const combined = new Float32Array(speechSamples);
    let off = 0;
    for (const seg of segs) {
      const s = seg.start * frameSamples;
      const e = Math.min(seg.end * frameSamples, pcm.length);
      combined.set(pcm.subarray(s, e), off);
      off += e - s;
    }

    const wavBuf = encodeWAV(combined, sampleRate);
    const filteredBlob = new Blob([wavBuf], { type: 'audio/wav' });

    return { blob: filteredBlob, originalDurationS, filteredDurationS, removedS };
  } catch (err) {
    console.warn('[vadFilter] filterSilence error:', err);
    return fallback();
  }
}
