/**
 * Audio Quality Enhancement Utilities
 *
 * Provides post-processing for recorded audio to remove:
 * - Background noise
 * - Clicks and pops
 * - Hiss and hum
 * - Echo
 */

/**
 * Apply simple high-pass filter to remove low-frequency rumble
 */
export async function applyHighPassFilter(
  audioBuffer: AudioBuffer,
  cutoffFreq = 80
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineContext.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = cutoffFreq;

  source.connect(filter);
  filter.connect(offlineContext.destination);
  source.start();

  return offlineContext.startRendering();
}

/**
 * Apply noise gate to remove quiet background noise
 */
export async function applyNoiseGate(
  audioBuffer: AudioBuffer,
  threshold = -40,
  attack = 0.01,
  release = 0.1
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const noiseGate = offlineContext.createDynamicsCompressor();
  noiseGate.threshold.value = threshold;
  noiseGate.knee.value = 0;
  noiseGate.ratio.value = 20;
  noiseGate.attack.value = attack;
  noiseGate.release.value = release;

  source.connect(noiseGate);
  noiseGate.connect(offlineContext.destination);
  source.start();

  return offlineContext.startRendering();
}

/**
 * Apply spectral noise reduction using Web Audio API
 * This is a simplified version - RNNoise is better for real-time
 */
export async function applySpectralNoiseReduction(
  audioBuffer: AudioBuffer,
  noiseReduction = 0.7
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Use equalizer to reduce noisy frequencies
  const lowShelf = offlineContext.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 300;
  lowShelf.gain.value = -3;

  const highShelf = offlineContext.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 8000;
  highShelf.gain.value = -noiseReduction * 6;

  const midPeak = offlineContext.createBiquadFilter();
  midPeak.type = 'peaking';
  midPeak.frequency.value = 1000;
  midPeak.Q.value = 0.5;
  midPeak.gain.value = -noiseReduction * 3;

  source.connect(lowShelf);
  lowShelf.connect(midPeak);
  midPeak.connect(highShelf);
  highShelf.connect(offlineContext.destination);

  source.start();

  return offlineContext.startRendering();
}

/**
 * Remove clicks and pops using simple interpolation
 */
export function removeClicks(audioBuffer: AudioBuffer, threshold = 0.95): AudioBuffer {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const output = offlineContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const inputData = audioBuffer.getChannelData(channel);
    const outputData = output.getChannelData(channel);

    for (let i = 0; i < inputData.length; i++) {
      const sample = inputData[i];

      // Detect clicks (sudden large changes)
      if (i > 0 && i < inputData.length - 1) {
        const prevSample = inputData[i - 1];
        const nextSample = inputData[i + 1];
        const predictedSample = (prevSample + nextSample) / 2;
        const deviation = Math.abs(sample - predictedSample);

        if (deviation > threshold && Math.abs(sample) > 0.8) {
          // Interpolate to remove click
          outputData[i] = predictedSample;
        } else {
          outputData[i] = sample;
        }
      } else {
        outputData[i] = sample;
      }
    }
  }

  return output;
}

/**
 * Apply all enhancement filters in sequence
 */
export async function enhanceAudioQuality(
  audioBlob: Blob,
  options: {
    removeNoise?: boolean;
    removeClicks?: boolean;
    normalizeVolume?: boolean;
  } = {}
): Promise<Blob> {
  const {
    removeNoise = true,
    removeClicks: removeClicksOption = false,
    normalizeVolume = true,
  } = options;

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  let enhancedBuffer = audioBuffer;

  // Apply filters in sequence
  if (removeNoise) {
    enhancedBuffer = await applyHighPassFilter(enhancedBuffer, 80);
    enhancedBuffer = await applySpectralNoiseReduction(enhancedBuffer, 0.6);
  }

  if (removeClicksOption) {
    enhancedBuffer = removeClicks(enhancedBuffer);
  }

  if (normalizeVolume) {
    enhancedBuffer = await applyNoiseGate(enhancedBuffer, -35);
  }

  // Convert back to blob
  const offlineContext = new OfflineAudioContext(
    enhancedBuffer.numberOfChannels,
    enhancedBuffer.length,
    enhancedBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = enhancedBuffer;
  source.connect(offlineContext.destination);
  source.start();

  const renderedBuffer = await offlineContext.startRendering();
  const wavBlob = bufferToWave(renderedBuffer, 0, renderedBuffer.length);

  audioContext.close();

  return wavBlob;
}

/**
 * Re-encode an AudioBuffer to WebM/Opus (or best supported format) via MediaRecorder.
 * Falls back to WAV if MediaRecorder is unavailable.
 */
function reencode(buffer: AudioBuffer, targetBitrate = 64000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof MediaRecorder === 'undefined') {
      // Fallback: return WAV if no MediaRecorder (unlikely in modern browsers)
      resolve(bufferToWave(buffer, 0, buffer.length));
      return;
    }

    const ctx = new AudioContext({ sampleRate: buffer.sampleRate });
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);

    const preferredTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

    const recorder = new MediaRecorder(dest.stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: targetBitrate,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      ctx.close().catch(() => {});
      resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
    };
    recorder.onerror = (e) => {
      ctx.close().catch(() => {});
      reject(e);
    };

    recorder.start();
    source.start();

    // Stop recording when the buffer finishes playing
    source.onended = () => {
      // Small delay to ensure all data is flushed
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 100);
    };
  });
}

/**
 * Enhance audio quality and re-encode to compressed format (WebM/Opus).
 * Runs entirely in the browser — zero server cost.
 *
 * Pipeline: decode → high-pass filter → spectral noise reduction → noise gate → re-encode to Opus
 */
export async function enhanceAndReencode(
  audioBlob: Blob,
  options: {
    removeNoise?: boolean;
    removeClicks?: boolean;
    normalizeVolume?: boolean;
    targetBitrate?: number;
  } = {}
): Promise<Blob> {
  const {
    removeNoise = true,
    removeClicks: removeClicksOption = false,
    normalizeVolume = true,
    targetBitrate = 64000,
  } = options;

  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new AudioContext();
  let enhancedBuffer: AudioBuffer;

  try {
    enhancedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    // Cannot decode (e.g. already compressed in unsupported format) — return original
    audioContext.close().catch(() => {});
    return audioBlob;
  }

  if (removeNoise) {
    enhancedBuffer = await applyHighPassFilter(enhancedBuffer, 80);
    enhancedBuffer = await applySpectralNoiseReduction(enhancedBuffer, 0.6);
  }

  if (removeClicksOption) {
    enhancedBuffer = removeClicks(enhancedBuffer);
  }

  if (normalizeVolume) {
    enhancedBuffer = await applyNoiseGate(enhancedBuffer, -35);
  }

  audioContext.close().catch(() => {});

  return reencode(enhancedBuffer, targetBitrate);
}

/**
 * Convert AudioBuffer to WAV blob
 */
function bufferToWave(abuffer: AudioBuffer, offset: number, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels: Float32Array[] = [];
  let sample;
  let pos = 0;

  // Write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this dem)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved data
  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < len) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset + pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + pos * 2 * numOfChan + i * 2, sample, true);
    }
    pos++;
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
