/**
 * rnnoise-worklet.js — AudioWorklet spectral-subtraction noise reducer
 *
 * Implements Wiener-filter noise reduction using:
 *   • 512-pt Cooley-Tukey radix-2 FFT
 *   • Minimum-statistics noise-floor estimator
 *   • Wiener gain: G(k) = max(FLOOR, SNR(k) / (SNR(k)+1))
 *   • Weighted overlap-add (WOLA) with Hann window, hop=128 (75% overlap)
 *
 * No external dependencies — runs entirely inside AudioWorkletGlobalScope.
 */

"use strict";

const FFT_SIZE = 512;
const HOP_SIZE = 128; // one AudioWorklet quantum = 128 samples
const NUM_BINS = FFT_SIZE / 2 + 1;

// ── Hann window (analysis + synthesis) ────────────────────────────────────────
const HANN = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  HANN[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}
// With WOLA + 75% overlap, sum of HANN² per position ≈ 1.5
const WOLA_NORM = 1 / 1.5;

// ── Cooley-Tukey radix-2 FFT ──────────────────────────────────────────────────
function bitRev(re, im, n) {
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
}

function fft(re, im) {
  const n = re.length;
  bitRev(re, im, n);
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const wStep = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const a = wStep * k;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const ur = cos * re[i + k + half] - sin * im[i + k + half];
        const ui = sin * re[i + k + half] + cos * im[i + k + half];
        re[i + k + half] = re[i + k] - ur;
        im[i + k + half] = im[i + k] - ui;
        re[i + k] += ur;
        im[i + k] += ui;
      }
    }
  }
}

function ifft(re, im) {
  for (let i = 0; i < re.length; i++) im[i] = -im[i];
  fft(re, im);
  const inv = 1 / re.length;
  for (let i = 0; i < re.length; i++) {
    re[i] *= inv;
    im[i] = -im[i] * inv;
  }
}

// ── Processor ─────────────────────────────────────────────────────────────────
class NoiseReducerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Running input window (last FFT_SIZE samples)
    this.inBuf = new Float32Array(FFT_SIZE);

    // Overlap-add accumulator (FFT_SIZE + one extra hop for safety)
    this.olaBuf = new Float32Array(FFT_SIZE + HOP_SIZE);

    // Noise floor per bin: initialised to a small positive value
    this.noiseFloor = new Float32Array(NUM_BINS).fill(1e-10);

    // Running per-bin minimum power within each reset window
    this.minPow = new Float32Array(NUM_BINS).fill(1e8);

    // How many times process() has been called
    this.tick = 0;

    // Number of warmup frames (pass-through while we gather a noise estimate)
    this.warmup = 6;

    // Bypass flag — can be toggled via port message
    this.bypassed = false;

    this.port.onmessage = (e) => {
      if (e.data.type === "bypass") this.bypassed = !!e.data.value;
    };
  }

  process(inputs, outputs) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;

    // Bypass path: pure pass-through
    if (this.bypassed) {
      out.set(inp);
      return true;
    }

    // ── 1. Slide input window ────────────────────────────────────────────────
    this.inBuf.copyWithin(0, HOP_SIZE);
    this.inBuf.set(inp, FFT_SIZE - HOP_SIZE);

    // ── 2. Window + FFT ──────────────────────────────────────────────────────
    const re = new Float32Array(FFT_SIZE);
    const im = new Float32Array(FFT_SIZE); // zeros by default
    for (let i = 0; i < FFT_SIZE; i++) re[i] = this.inBuf[i] * HANN[i];
    fft(re, im);

    // ── 3. Power spectrum (positive frequencies only) ────────────────────────
    for (let k = 0; k < NUM_BINS; k++) {
      const p = re[k] * re[k] + im[k] * im[k];

      // Track per-bin minimum over a short window
      if (p < this.minPow[k]) this.minPow[k] = p;
    }

    // ── 4. Update noise floor every 50 ticks (~133 ms at 48 kHz / hop=128) ──
    if (this.tick % 50 === 0) {
      for (let k = 0; k < NUM_BINS; k++) {
        // Slow IIR smoothing so floor adapts to changing room noise
        this.noiseFloor[k] = 0.97 * this.noiseFloor[k] + 0.03 * this.minPow[k];
        this.minPow[k] = 1e8; // reset minimum tracker
      }
    }

    // ── 5. Wiener gain (skip during warmup to collect noise profile) ─────────
    if (this.tick >= this.warmup) {
      const OVER = 2.5;   // over-subtraction factor (stronger reduction)
      const FLOOR = 0.03; // spectral floor to prevent musical noise
      for (let k = 0; k < NUM_BINS; k++) {
        const snr = (re[k] * re[k] + im[k] * im[k]) /
                    (this.noiseFloor[k] * OVER + 1e-20);
        const g = Math.max(FLOOR, snr / (snr + 1));
        re[k] *= g;
        im[k] *= g;
      }

      // Mirror conjugate-symmetric negative frequencies
      for (let k = 1; k < FFT_SIZE / 2; k++) {
        re[FFT_SIZE - k] = re[k];
        im[FFT_SIZE - k] = -im[k];
      }
    }

    // ── 6. IFFT + synthesis window ───────────────────────────────────────────
    ifft(re, im);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.olaBuf[i] += re[i] * HANN[i] * WOLA_NORM;
    }

    // ── 7. Output first HOP_SIZE samples then shift buffer ───────────────────
    out.set(this.olaBuf.subarray(0, HOP_SIZE));
    this.olaBuf.copyWithin(0, HOP_SIZE);
    this.olaBuf.fill(0, FFT_SIZE); // zero the tail

    this.tick++;
    return true;
  }
}

registerProcessor("noise-reducer", NoiseReducerProcessor);
