import { describe, test, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

// Mock fs to prevent statSync failures
vi.mock('node:fs', () => ({
  default: {
    statSync: vi.fn().mockReturnValue({ size: 1000, isFile: () => true }),
    existsSync: vi.fn().mockReturnValue(true), // Return true so pipeline thinks file exists
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue(''),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    createReadStream: vi.fn(),
  },
  statSync: vi.fn().mockReturnValue({ size: 1000, isFile: () => true }),
  existsSync: vi.fn().mockReturnValue(true), // Return true so pipeline thinks file exists
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(''),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  createReadStream: vi.fn(),
}));

// Mock all heavy dependencies to test pipeline orchestration logic
vi.mock('../transcription', () => ({
  resolveStoredAudioQuality: vi.fn().mockReturnValue(null),
  analyzeAudioQuality: vi.fn().mockResolvedValue(null),
  transcribeInChunks: vi.fn().mockResolvedValue({
    segments: [{ id: 1, text: 'hello', speakerId: 0 }],
    words: [],
    text: 'hello',
  }),
  mergeChunkedPayloads: vi.fn().mockReturnValue({
    segments: [{ id: 1, text: 'hello', speakerId: 0 }],
    words: [],
    text: 'hello',
    transcriptionDiagnostics: {},
  }),
  transcribeLiveChunk: vi.fn().mockResolvedValue('hello world'),
  runSileroVAD: vi.fn().mockResolvedValue([]),
  preprocessAudio: vi.fn().mockResolvedValue('/tmp/preprocessed.wav'),
  requestAudioTranscription: vi.fn().mockResolvedValue({
    payload: {
      segments: [{ id: 1, text: 'hello', speakerId: 0 }],
      words: [],
      text: 'hello',
    },
    providerId: 'openai',
    providerLabel: 'OpenAI',
    model: 'whisper-1',
  }),
  getUploadDir: vi.fn().mockReturnValue('/tmp'),
  buildAudioPreprocessCacheKey: vi.fn().mockReturnValue('key123'),
  getPreprocessCachePath: vi.fn().mockReturnValue('/tmp/cache/key123.wav'),
  isPreprocessCacheFile: vi.fn().mockReturnValue(false),
  CHUNK_DURATION_SECONDS: 10,
  CHUNK_OVERLAP_SECONDS: 2,
  MAX_CHUNK_RETRIES: 3,
  VAD_ENABLED: false,
  maybeRetryPoorQualityWithOpenAi: vi.fn(async ({ sttResult }) => sttResult),
  retryLowConfidenceSegmentsWithOpenAi: vi.fn().mockResolvedValue({
    segments: [{ id: 1, text: 'hello', speakerId: 0 }],
    words: [],
    text: 'hello',
    diagnostics: {},
  }),
  SILENCE_REMOVE: false,
  STT_PROVIDER_CHAIN: [{ id: 'openai', defaultModel: 'whisper-1' }],
  _sttUseGroq: false,
  VERIFICATION_MODEL: 'whisper-1',
  MAX_FILE_SIZE_BYTES: 1000000,
}));

vi.mock('../diarization', () => ({
  runPyannoteDiarization: vi.fn().mockResolvedValue(null),
  mergeWithPyannote: vi.fn().mockReturnValue(null),
  splitSegmentsByWordSpeaker: vi.fn().mockReturnValue(null),
  diarizeFromTranscript: vi.fn().mockResolvedValue(null),
  applyPerSpeakerNorm: vi.fn().mockReturnValue([{ id: 1, text: 'hello', speakerId: 0 }]),
  VOICELOG_DIARIZER: 'pyannote',
  HF_TOKEN_SET: true,
}));

vi.mock('../postProcessing', () => ({
  correctTranscriptWithLLM: vi.fn().mockResolvedValue([{ id: 1, text: 'hello', speakerId: 0 }]),
  analyzeMeetingWithOpenAI: vi.fn().mockResolvedValue({ summary: 'test' }),
  embedTextChunks: vi.fn().mockResolvedValue([]),
  extractSpeakerAudioClip: vi.fn().mockResolvedValue(new Blob()),
  generateVoiceCoaching: vi.fn().mockResolvedValue(''),
  analyzeAcousticFeatures: vi.fn().mockResolvedValue({}),
  normalizeRecording: vi.fn().mockResolvedValue(''),
}));

vi.mock('../lib/supabaseStorage.js', () => ({
  downloadAudioToFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../speakerEmbedder', () => ({
  matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock('../config', () => ({
  config: {
    VOICELOG_OPENAI_API_KEY: 'sk-test',
    OPENAI_API_KEY: 'sk-test',
    VOICELOG_OPENAI_BASE_URL: 'https://api.openai.com',
    AUDIO_LANGUAGE: 'en',
    VOICELOG_PER_SPEAKER_NORM: false,
    STT_CONCURRENCY_LIMIT: 2,
    VOICELOG_DIARIZER: 'pyannote',
    VOICELOG_STT_PROVIDER: 'openai',
    VOICELOG_STT_FALLBACK_PROVIDER: 'openai',
    VOICELOG_ENABLE_CHUNK_VAD: false,
    VOICELOG_SILENCE_REMOVE: false,
    VOICELOG_PROCESSING_MODE_DEFAULT: 'fast',
    VOICELOG_STT_MODEL_FAST: 'whisper-tiny',
    VOICELOG_STT_MODEL_FULL: 'whisper-1',
    DEBUG: false,
    VOICELOG_CHUNK_OVERLAP_SECONDS: 2,
    VOICELOG_ADAPTIVE_OVERLAP: true,
    STT_PROVIDER_CHAIN: [{ id: 'openai', defaultModel: 'whisper-1' }],
    _sttUseGroq: false,
    VERIFICATION_MODEL: 'whisper-1',
    MAX_FILE_SIZE_BYTES: 1000000,
    CHUNK_DURATION_SECONDS: 10,
    CHUNK_OVERLAP_SECONDS: 2,
    MAX_CHUNK_RETRIES: 3,
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock stt/providers.ts — pipeline.ts imports transcribeWithProviders directly from there
vi.mock('../stt/providers', () => ({
  transcribeWithProviders: vi.fn().mockResolvedValue({
    payload: {
      segments: [{ id: 1, text: 'hello', speakerId: 0 }],
      words: [],
      text: 'hello',
    },
    providerId: 'openai',
    providerLabel: 'OpenAI',
    model: 'whisper-1',
  }),
  resolveConfiguredSttProviders: vi
    .fn()
    .mockReturnValue([{ id: 'openai', defaultModel: 'whisper-1' }]),
  ensureAudioBuffer: vi.fn().mockReturnValue(Buffer.from('mocked-audio')),
  createFormData: vi.fn(),
  runProviderRequest: vi.fn(),
}));

describe('pipeline.ts — orchestration coverage', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('transcribeRecording returns result on success with local mode', async () => {
    const pipeline = await import('../pipeline.ts');
    const result = await pipeline.transcribeRecording(
      { id: 'rec1', file_path: '/tmp/test.wav', content_type: 'audio/wav' },
      { onProgress: vi.fn() }
    );
    expect(result.providerId).toEqual('openai');
    expect(result.pipelineStatus).toEqual('completed');
    expect(result.segments).toMatchObject([{ id: 1, text: 'hello', speakerId: 0 }]);
  });

  test('transcribeLiveChunk returns text on success', async () => {
    const pipeline = await import('../pipeline.ts');
    const result = await pipeline.transcribeLiveChunk('/tmp/test.wav', 'audio/wav', {});
    expect(result).toEqual('hello world');
  });

  test('transcribeRecording handles remote audio path', async () => {
    const pipeline = await import('../pipeline.ts');
    const result = await pipeline.transcribeRecording(
      { id: 'rec1', file_path: 'remote-rec-id', content_type: 'audio/wav' },
      { onProgress: vi.fn() }
    );
    expect(result.pipelineStatus).toEqual('completed');
    expect(result.transcriptOutcome).toEqual('normal');
  });
});
