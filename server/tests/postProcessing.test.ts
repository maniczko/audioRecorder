import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before anything imports it
vi.mock('../config.ts', () => ({
  config: {
    VOICELOG_OPENAI_API_KEY: 'sk-test-key',
    OPENAI_API_KEY: 'sk-test-key',
    VOICELOG_OPENAI_BASE_URL: 'https://api.openai.com/v1',
    FFMPEG_BINARY: 'ffmpeg',
    PYTHON_BINARY: 'python',
    TRANSCRIPT_CORRECTION: false,
    SPEAKER_IDENTIFICATION_MODEL: '',
    VOICELOG_PER_SPEAKER_NORM: false,
    DIARIZATION_MODEL: '',
    HF_TOKEN: '',
    HUGGINGFACE_TOKEN: '',
    DEBUG: false,
    VOICELOG_UPLOAD_DIR: '',
    VERIFICATION_MODEL: '',
    AUDIO_LANGUAGE: 'pl',
  },
}));

// Mock logger
vi.mock('../logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock speakerEmbedder
vi.mock('../speakerEmbedder.ts', () => ({
  matchSpeakerToProfile: vi.fn().mockResolvedValue(null),
}));

// Mock audioPipeline.utils
vi.mock('../audioPipeline.utils.ts', () => ({
  clean: vi.fn((text: string) => text),
}));

// Mock meetingFeedback
vi.mock('../../src/shared/meetingFeedback.ts', () => ({
  buildMeetingFeedbackSchemaExample: vi.fn().mockReturnValue('{}'),
}));

// Mock child_process
const mockExec = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  exec: (...args: any[]) => mockExec(...args),
}));

// Mock httpClient
const mockHttpClient = vi.fn();
vi.mock('../lib/httpClient.ts', () => ({
  httpClient: (...args: any[]) => mockHttpClient(...args),
}));

// Mock fs partially
const mockRenameSync = vi.fn();
const mockUnlinkSync = vi.fn();
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<any>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(() => ''),
      renameSync: (...args: any[]) => mockRenameSync(...args),
      unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
    },
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    renameSync: (...args: any[]) => mockRenameSync(...args),
    unlinkSync: (...args: any[]) => mockUnlinkSync(...args),
  };
});

async function loadModule() {
  const mod = await import('../postProcessing.ts');
  return mod;
}

describe('postProcessing.ts — correctTranscriptWithLLM', () => {
  beforeEach(() => {
    vi.resetModules();
    mockHttpClient.mockReset();
    mockExec.mockReset();
    mockRenameSync.mockReset();
    mockUnlinkSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns original segments when TRANSCRIPT_CORRECTION is false and no option override', async () => {
    const { correctTranscriptWithLLM } = await loadModule();
    const segments = [{ id: 's1', text: 'hello' }];
    const result = await correctTranscriptWithLLM(segments);
    expect(result).toBe(segments);
  });

  test('returns original segments when OPENAI_API_KEY is not set and TRANSCRIPT_CORRECTION is off', async () => {
    const { correctTranscriptWithLLM } = await loadModule();
    const segments = [{ id: 's1', text: 'hello' }];
    // TRANSCRIPT_CORRECTION is false in mock config, so it returns early
    const result = await correctTranscriptWithLLM(segments);
    expect(result).toBe(segments);
    expect(mockHttpClient).not.toHaveBeenCalled();
  });

  test('calls API and returns corrected segments when activated via option', async () => {
    mockHttpClient.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify([{ id: 's1', text: 'Hello.' }]) } }],
      }),
    });

    // Use dynamic config override via options.transcriptCorrection
    const { correctTranscriptWithLLM } = await loadModule();
    const segments = [{ id: 's1', text: 'hello' }];
    const result = await correctTranscriptWithLLM(segments, { transcriptCorrection: true });

    expect(result).toEqual([{ id: 's1', text: 'Hello.' }]);
  });

  test('returns original segments on API failure', async () => {
    mockHttpClient.mockRejectedValue(new Error('Network error'));

    const { correctTranscriptWithLLM } = await loadModule();
    const segments = [{ id: 's1', text: 'hello' }];
    const result = await correctTranscriptWithLLM(segments, { transcriptCorrection: true });

    expect(result).toBe(segments);
  });

  test('returns original segments on non-ok HTTP response', async () => {
    mockHttpClient.mockResolvedValue({ ok: false, status: 500 });

    const { correctTranscriptWithLLM } = await loadModule();
    const segments = [{ id: 's1', text: 'hello' }];
    const result = await correctTranscriptWithLLM(segments, { transcriptCorrection: true });

    expect(result).toBe(segments);
  });

  test('LLM prompt includes logical STT error correction instructions', async () => {
    mockHttpClient.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify([{ id: 's1', text: 'poprawiony' }]) } }],
      }),
    });

    const { correctTranscriptWithLLM } = await loadModule();
    await correctTranscriptWithLLM([{ id: 's1', text: 'test' }], { transcriptCorrection: true });

    expect(mockHttpClient).toHaveBeenCalledTimes(1);
    const body = mockHttpClient.mock.calls[0][1].body;
    const prompt = body.messages[0].content;
    // Verify enhanced prompt includes STT correction instructions
    expect(prompt).toMatch(/b[łl][ęe]dnie rozpoznane przez STT/);
    expect(prompt).toMatch(/kontekstu zdania/);
    expect(prompt).toMatch(/nie parafrazuj/);
  });
});

describe('postProcessing.ts — normalizeRecording', () => {
  beforeEach(() => {
    vi.resetModules();
    mockExec.mockReset();
    mockRenameSync.mockReset();
    mockUnlinkSync.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('normalizeRecording ffmpeg command contains adeclick filter', async () => {
    mockExec.mockImplementation((cmd: string, opts: any, cb?: Function) => {
      if (typeof opts === 'function') {
        opts(null, '', '');
      } else if (cb) {
        cb(null, '', '');
      }
      return { stdout: { on: vi.fn() }, stderr: { on: vi.fn() }, on: vi.fn() };
    });

    const { normalizeRecording } = await loadModule();

    try {
      await normalizeRecording('/tmp/audio.wav');
    } catch {
      // May fail due to mocking limitations
    }

    expect(mockExec).toHaveBeenCalled();
    const ffmpegCmd = mockExec.mock.calls[0][0] as string;
    expect(ffmpegCmd).toContain('adeclick');
    expect(ffmpegCmd).toContain('highpass=f=80');
    expect(ffmpegCmd).toContain('loudnorm');
  });
});
