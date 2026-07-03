// @ts-check

export function wavToneBuffer({ sampleRate = 16_000, durationSeconds = 1, frequency = 440 } = {}) {
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const buffer = Buffer.alloc(44 + sampleCount * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + sampleCount * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(sampleCount * 2, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(
      Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.25 * 32767
    );
    buffer.writeInt16LE(sample, 44 + index * 2);
  }

  return buffer;
}

export function fixtureAudioFile(name = 'audio-e2e-fixture.wav') {
  return {
    name,
    mimeType: 'audio/wav',
    buffer: Buffer.concat([wavToneBuffer(), Buffer.alloc(25 * 1024 * 1024)]),
  };
}
