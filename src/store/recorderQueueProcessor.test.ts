import { describe, it, expect, vi, afterEach } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  addQueueBreadcrumb: vi.fn(),
  captureQueueException: vi.fn(),
}));

vi.mock('../sentry', () => ({
  addQueueBreadcrumb: sentryMocks.addQueueBreadcrumb,
  captureQueueException: sentryMocks.captureQueueException,
}));

import {
  RECORDING_WORKSPACE_REQUIRED_MESSAGE,
  createRecordingQueueItem,
  type RecordingQueueItem,
} from '../lib/recordingQueue';
import type { MeetingAnalysis, TranscriptionStatusPayload } from '../shared/types';
import {
  attachRecordingWithRetry,
  buildAudioPreprocessingPlan,
  CLIENT_AUDIO_PREPROCESSING_LIMITS,
  BACKGROUND_TRANSCRIPTION_RETRY_MS,
  BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
  REMOTE_RECORDING_MISSING_MESSAGE,
  calculateTranscriptionHardTimeoutMs,
  processRecordingQueueItem,
  shouldReportBackgroundTranscriptionPendingToConsole,
  waitForCompletedTranscription,
  type QueueProcessorContext,
} from './recorderQueueProcessor';

const NOW_ISO = '2026-04-24T00:00:00.000Z';
const meeting = {
  id: 'meeting-1',
  workspaceId: 'workspace-1',
  title: 'Demo meeting',
  recordings: [],
};

describe('queue diagnostics console policy', () => {
  // -----------------------------------------------------------------
  // Issue #0 - background transcription emits production console noise
  // Date: 2026-05-21
  // Bug: background polling used console.warn in production for normal
  //      processing state, making healthy long-running STT look broken.
  // Fix: keep Sentry breadcrumbs, but only write console diagnostics in
  //      non-production builds or when an explicit debug flag is enabled.
  // -----------------------------------------------------------------
  it('does not report normal background processing to production console by default', () => {
    expect(shouldReportBackgroundTranscriptionPendingToConsole({ PROD: true })).toBe(false);
    expect(
      shouldReportBackgroundTranscriptionPendingToConsole({
        PROD: true,
        VITE_VOICELOG_DEBUG_QUEUE: 'true',
      })
    ).toBe(true);
    expect(shouldReportBackgroundTranscriptionPendingToConsole({ PROD: false })).toBe(true);
  });
});

function makeQueueItem(overrides: Partial<RecordingQueueItem> = {}): RecordingQueueItem {
  return {
    ...createRecordingQueueItem({
      recordingId: 'recording-1',
      meeting,
      duration: 42,
      createdAt: NOW_ISO,
    }),
    ...overrides,
  };
}

function makeTranscription(
  overrides: Partial<TranscriptionStatusPayload> = {}
): TranscriptionStatusPayload {
  return {
    recordingId: 'recording-1',
    pipelineStatus: 'done',
    segments: [
      {
        timestamp: 0,
        endTimestamp: 2,
        text: 'Hello from the transcript',
        speakerId: '0',
        verificationStatus: 'verified',
      },
    ],
    diarization: {
      speakerCount: 1,
      speakerNames: { '0': 'Alice' },
    },
    speakerNames: { '0': 'Alice' },
    speakerCount: 1,
    confidence: 0.91,
    reviewSummary: null,
    errorMessage: '',
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<MeetingAnalysis> = {}): MeetingAnalysis {
  return {
    summary: 'Meeting summary',
    decisions: [],
    actionItems: [],
    tasks: [],
    followUps: [],
    answersToNeeds: [],
    suggestedTags: [],
    meetingType: 'sync',
    energyLevel: 'steady',
    risks: [],
    blockers: [],
    participantInsights: [],
    tensions: [],
    keyQuotes: [],
    suggestedAgenda: [],
    ...overrides,
  };
}

function buildContext(overrides: Partial<QueueProcessorContext> = {}) {
  const nextItem = overrides.nextItem ?? makeQueueItem();
  const mediaService = {
    mode: 'local',
    persistRecordingAudio: vi.fn(async () => ({
      audioQuality: { qualityLabel: 'good' },
    })),
    startTranscriptionJob: vi.fn(async () => makeTranscription()),
    getTranscriptionJobStatus: vi.fn(async () => makeTranscription()),
    subscribeToTranscriptionProgress: vi.fn(() => undefined),
    retryTranscriptionJob: vi.fn(async () => makeTranscription()),
  };

  const defaults = {
    nextItem,
    resolveMeetingForQueueItem: vi.fn(() => meeting),
    attachCompletedRecording: vi.fn(() => true),
    setCurrentSegments: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
    setState: vi.fn(),
    getState: vi.fn(() => ({ lastQueueErrorKey: '' })),
    getAudioBlob: vi.fn(async () => new Blob(['audio'])),
    createMediaService: vi.fn(() => mediaService),
    filterSilence: vi.fn(async (blob: Blob) => ({
      blob,
      originalDurationS: 42,
      filteredDurationS: 42,
      removedS: 0,
    })),
    enhanceAndReencode: vi.fn(async (blob: Blob) => blob),
    analyzeMeeting: vi.fn(async () => makeAnalysis()),
    getPipelineSnapshot: vi.fn(
      (status: string | null | undefined, progress?: number | null, message?: string) => ({
        progressPercent: Number(progress ?? (status === 'done' ? 100 : 0)),
        stageLabel: String(message || status || ''),
      })
    ),
    normalizeTranscriptionResponse: vi.fn((response: unknown) => response),
    buildFallbackAnalysis: vi.fn(
      (
        message: string,
        diarization: { speakerNames?: Record<string, string>; speakerCount?: number }
      ) =>
        makeAnalysis({
          summary: message,
          speakerLabels: diarization?.speakerNames || {},
          speakerCount: diarization?.speakerCount || 0,
        })
    ),
    emptyTranscriptMessage: 'No speech detected.',
    toUserFacingQueueError: vi.fn(
      (error: { message?: string }) => `UI: ${error?.message || 'unknown'}`
    ),
    isExpectedDomainFailure: vi.fn(() => false),
    isTransientNetworkError: vi.fn((error: { message?: string }) =>
      String(error?.message || '').includes('Failed to fetch')
    ),
    maxAutoRetries: 5,
    retryDelaysMs: [1000, 4000, 16000, 32000, 64000],
    sleep: vi.fn(async () => undefined),
    scheduleBackoffReset: vi.fn(),
    now: vi.fn(() => 5000),
  } satisfies QueueProcessorContext;

  return {
    ...defaults,
    ...overrides,
    mediaService,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  sentryMocks.addQueueBreadcrumb.mockClear();
  sentryMocks.captureQueueException.mockClear();
});

describe('buildAudioPreprocessingPlan', () => {
  it('uses client preprocessing for short and small recordings', () => {
    const plan = buildAudioPreprocessingPlan({
      blob: new Blob(['audio']),
      durationSeconds: 60,
    });

    expect(plan.shouldPreprocess).toBe(true);
    expect(plan.mode).toBe('client');
    expect(plan.reason).toBe('within_limits');
  });

  it('skips client preprocessing for recordings above the duration limit', () => {
    const plan = buildAudioPreprocessingPlan({
      blob: new Blob(['audio']),
      durationSeconds: CLIENT_AUDIO_PREPROCESSING_LIMITS.maxDurationSeconds + 1,
    });

    expect(plan.shouldPreprocess).toBe(false);
    expect(plan.mode).toBe('server');
    expect(plan.reason).toBe('duration');
    expect(plan.recordingMessage).toContain('Długie nagranie');
  });

  it('skips client preprocessing for blobs above the size limit', () => {
    const plan = buildAudioPreprocessingPlan({
      blob: { size: CLIENT_AUDIO_PREPROCESSING_LIMITS.maxBlobBytes + 1 },
      durationSeconds: 60,
    });

    expect(plan.shouldPreprocess).toBe(false);
    expect(plan.mode).toBe('server');
    expect(plan.reason).toBe('size');
  });

  it('reports combined reason when duration and size are both above limits', () => {
    const plan = buildAudioPreprocessingPlan({
      blob: { size: CLIENT_AUDIO_PREPROCESSING_LIMITS.maxBlobBytes + 1 },
      durationSeconds: CLIENT_AUDIO_PREPROCESSING_LIMITS.maxDurationSeconds + 1,
    });

    expect(plan.shouldPreprocess).toBe(false);
    expect(plan.mode).toBe('server');
    expect(plan.reason).toBe('duration_and_size');
  });

  it('keeps preprocessing enabled when metadata is missing but blob is small', () => {
    const plan = buildAudioPreprocessingPlan({
      blob: new Blob(['audio']),
      durationSeconds: undefined,
    });

    expect(plan.shouldPreprocess).toBe(true);
    expect(plan.mode).toBe('client');
  });
});

describe('attachRecordingWithRetry', () => {
  it('returns immediately when the recording attaches on the first attempt', async () => {
    const attachCompletedRecording = vi.fn(() => true);
    const sleep = vi.fn(async () => undefined);

    await expect(
      attachRecordingWithRetry({
        attachCompletedRecording,
        meetingId: meeting.id,
        recording: { id: 'recording-1' },
        sleep,
      })
    ).resolves.toBe(true);

    expect(attachCompletedRecording).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries until the meeting becomes available', async () => {
    const attachCompletedRecording = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const sleep = vi.fn(async () => undefined);

    await expect(
      attachRecordingWithRetry({
        attachCompletedRecording,
        meetingId: meeting.id,
        recording: { id: 'recording-1' },
        sleep,
        retries: 5,
        retryDelayMs: 250,
      })
    ).resolves.toBe(true);

    expect(attachCompletedRecording).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 250);
  });

  it('returns false after exhausting all retries', async () => {
    const attachCompletedRecording = vi.fn(() => false);
    const sleep = vi.fn(async () => undefined);

    await expect(
      attachRecordingWithRetry({
        attachCompletedRecording,
        meetingId: meeting.id,
        recording: { id: 'recording-1' },
        sleep,
        retries: 3,
        retryDelayMs: 100,
      })
    ).resolves.toBe(false);

    expect(attachCompletedRecording).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });
});

describe('waitForCompletedTranscription', () => {
  it('calculates hard timeout from recording duration with safe bounds', () => {
    expect(calculateTranscriptionHardTimeoutMs(60)).toBe(30 * 60 * 1000);
    expect(calculateTranscriptionHardTimeoutMs(45 * 60)).toBe(90 * 60 * 1000);
    expect(calculateTranscriptionHardTimeoutMs(0)).toBe(45 * 60 * 1000);
  });

  it('returns the started payload immediately when the pipeline is already done', async () => {
    const started = makeTranscription();
    const mediaService = {
      getTranscriptionJobStatus: vi.fn(),
    };

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem(),
        mediaService,
        started,
        startStatus: 'done',
        updateQueueItem: vi.fn(),
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(),
        normalizeTranscriptionResponse: vi.fn((response) => response),
      })
    ).resolves.toMatchObject({
      recordingId: 'recording-1',
      pipelineStatus: 'done',
    });

    expect(mediaService.getTranscriptionJobStatus).not.toHaveBeenCalled();
  });

  it('polls intermediate states until the transcription is complete', async () => {
    const queued = makeTranscription({ pipelineStatus: 'queued', segments: [] });
    const diarization = makeTranscription({ pipelineStatus: 'diarization', segments: [] });
    const done = makeTranscription();
    const updateQueueItem = vi.fn();
    const setState = vi.fn();
    const sleep = vi.fn(async () => undefined);
    const mediaService = {
      getTranscriptionJobStatus: vi
        .fn()
        .mockResolvedValueOnce(queued)
        .mockResolvedValueOnce(diarization)
        .mockResolvedValueOnce(done),
    };

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem(),
        mediaService,
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem,
        setState,
        getPipelineSnapshot: vi.fn((status) => ({
          progressPercent: status === 'queued' ? 24 : 78,
          stageLabel: String(status),
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep,
      })
    ).resolves.toMatchObject({
      pipelineStatus: 'done',
      segments: done.segments,
    });

    const statusUpdates = updateQueueItem.mock.calls
      .map(([, updates]) => updates)
      .filter((updates) => typeof updates === 'object' && updates !== null && 'status' in updates);

    expect(statusUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'queued' }),
        expect.objectContaining({ status: 'diarization' }),
      ])
    );
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineProgressPercent: 24,
        pipelineStageLabel: 'queued',
      })
    );
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineProgressPercent: 78,
        pipelineStageLabel: 'diarization',
      })
    );
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('throws a diagnostic-rich error when the backend reports a failed status', async () => {
    const failed = makeTranscription({
      pipelineStatus: 'failed',
      errorMessage: 'Backend processing failed.',
      segments: [],
      audioQuality: { qualityLabel: 'poor' } as never,
      transcriptionDiagnostics: { chunksAttempted: 2 } as never,
    } as Partial<TranscriptionStatusPayload>);

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem(),
        mediaService: {
          getTranscriptionJobStatus: vi.fn(async () => failed),
        },
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem: vi.fn(),
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(() => ({
          progressPercent: 0,
          stageLabel: 'failed',
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep: vi.fn(async () => undefined),
      })
    ).rejects.toMatchObject({
      message: 'Backend processing failed.',
      audioQuality: { qualityLabel: 'poor' },
      transcriptionDiagnostics: { chunksAttempted: 2 },
    });
  });

  it('Regression: #0 - preserves retryable rate-limit metadata from failed status', async () => {
    const failed = makeTranscription({
      pipelineStatus: 'failed',
      errorMessage: 'Rate limit reached.',
      segments: [],
      errorCode: 'stt_rate_limited',
      retryable: true,
      retryAfterMs: 45_000,
      transcriptionDiagnostics: {
        errorCode: 'stt_rate_limited',
        retryable: true,
        retryAfterMs: 45_000,
      } as never,
    } as Partial<TranscriptionStatusPayload>);

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem(),
        mediaService: {
          getTranscriptionJobStatus: vi.fn(async () => failed),
        },
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem: vi.fn(),
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(() => ({
          progressPercent: 0,
          stageLabel: 'failed',
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep: vi.fn(async () => undefined),
      })
    ).rejects.toMatchObject({
      message: 'Rate limit reached.',
      errorCode: 'stt_rate_limited',
      retryable: true,
      retryAfterMs: 45_000,
    });
  });

  it('treats transcription status 404 as stale remote recording without polling storm', async () => {
    const notFound = Object.assign(new Error('Nie znaleziono nagrania.'), { status: 404 });
    const mediaService = {
      getTranscriptionJobStatus: vi.fn(async () => {
        throw notFound;
      }),
    };
    const sleep = vi.fn(async () => undefined);

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem({ uploaded: true, status: 'processing' }),
        mediaService,
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem: vi.fn(),
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(() => ({
          progressPercent: 64,
          stageLabel: 'processing',
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep,
      })
    ).rejects.toMatchObject({
      code: 'REMOTE_RECORDING_MISSING',
      status: 404,
      message: REMOTE_RECORDING_MISSING_MESSAGE,
      originalMessage: 'Nie znaleziono nagrania.',
    });

    expect(mediaService.getTranscriptionJobStatus).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('parks active remote processing after the soft polling window instead of failing', async () => {
    let now = 0;
    const processing = makeTranscription({
      pipelineStatus: 'processing',
      segments: [],
      activeJob: true,
      processingAgeMs: 120_000,
      retryAfterMs: 60_000,
    } as Partial<TranscriptionStatusPayload>);
    const updateQueueItem = vi.fn();
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem({
          status: 'processing',
          uploaded: true,
          processingStartedAt: new Date(0).toISOString(),
        }),
        mediaService: {
          getTranscriptionJobStatus: vi.fn(async () => processing),
        },
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem,
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(() => ({
          progressPercent: 64,
          stageLabel: 'processing',
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep,
        now: () => now,
        softPollingMs: 3_000,
      })
    ).rejects.toMatchObject({
      code: 'BACKGROUND_TRANSCRIPTION_PENDING',
      message: BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
      retryAfterMs: 60_000,
      activeJob: true,
      processingAgeMs: 120_000,
    });

    expect(updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'processing',
        errorMessage: '',
      })
    );
  });

  it('throws a terminal timeout only after the hard timeout expires', async () => {
    const now = Date.UTC(2026, 0, 1, 1, 0, 1);
    const processingStartedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)).toISOString();

    await expect(
      waitForCompletedTranscription({
        nextItem: makeQueueItem({
          duration: 60,
          status: 'processing',
          uploaded: true,
          processingStartedAt,
        }),
        mediaService: {
          getTranscriptionJobStatus: vi.fn(),
        },
        started: makeTranscription({ pipelineStatus: 'processing', segments: [] }),
        startStatus: 'processing',
        updateQueueItem: vi.fn(),
        setState: vi.fn(),
        getPipelineSnapshot: vi.fn(() => ({
          progressPercent: 64,
          stageLabel: 'processing',
        })),
        normalizeTranscriptionResponse: vi.fn((response) => response),
        sleep: vi.fn(async () => undefined),
        now: () => now,
      })
    ).rejects.toThrow('Transkrypcja przekroczyla bezpieczny limit czasu.');
  });
});

describe('processRecordingQueueItem', () => {
  it('completes the happy path and removes the item from the queue', async () => {
    const context = buildContext();

    await processRecordingQueueItem(context);

    expect(context.mediaService.persistRecordingAudio).toHaveBeenCalledTimes(1);
    expect(context.mediaService.startTranscriptionJob).toHaveBeenCalledTimes(1);
    expect(context.analyzeMeeting).toHaveBeenCalledTimes(1);
    expect(context.attachCompletedRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        id: meeting.id,
        workspaceId: meeting.workspaceId,
        title: meeting.title,
      }),
      expect.objectContaining({
        id: 'recording-1',
        transcript: expect.arrayContaining([
          expect.objectContaining({ text: 'Hello from the transcript' }),
        ]),
        pipelineStatus: 'done',
      })
    );
    expect(context.removeQueueItem).toHaveBeenCalledWith('recording-1');
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'done',
        pipelineProgressPercent: 100,
      })
    );
  });

  it('passes recording consent metadata when starting transcription', async () => {
    const recordingConsent = {
      acceptedAt: '2026-06-25T10:00:00.000Z',
      workspaceId: 'workspace-1',
      policyVersion: 'recording-consent-v1',
      disclosureTitle: 'Zgoda na nagrywanie i przetwarzanie AI',
      providerNotice: 'Dane moga byc przekazywane do dostawcow AI/audio.',
      providers: [{ id: 'stt', label: 'transkrypcja mowy na tekst', enabled: true }],
    };
    const context = buildContext({
      nextItem: makeQueueItem({ recordingConsent }),
    });

    await processRecordingQueueItem(context);

    expect(context.mediaService.startTranscriptionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingId: 'recording-1',
        recordingConsent,
      })
    );
  });

  it('uses backend duration when imported queue item duration is zero', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({ duration: 0 }),
    });
    context.mediaService.persistRecordingAudio.mockResolvedValueOnce({
      durationMs: 5_455_388,
      audioQuality: { qualityLabel: 'good' },
    });
    context.mediaService.startTranscriptionJob.mockResolvedValueOnce(
      makeTranscription({ durationMs: 5_455_388 } as Partial<TranscriptionStatusPayload>)
    );

    await processRecordingQueueItem(context);

    expect(context.attachCompletedRecording).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'recording-1',
        duration: 5455.388,
      })
    );
  });

  it('prefers backend duration over stale imported queue item duration', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({ duration: 1 }),
    });
    context.mediaService.persistRecordingAudio.mockResolvedValueOnce({
      durationMs: 5_455_388,
      audioQuality: { qualityLabel: 'good' },
    });
    context.mediaService.startTranscriptionJob.mockResolvedValueOnce(
      makeTranscription({ durationMs: 5_455_388 } as Partial<TranscriptionStatusPayload>)
    );

    await processRecordingQueueItem(context);

    expect(context.attachCompletedRecording).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'recording-1',
        duration: 5455.388,
      })
    );
  });

  it('uses transcription duration for empty transcript imports', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({ duration: 0 }),
    });
    context.mediaService.startTranscriptionJob.mockResolvedValueOnce(
      makeTranscription({
        durationMs: 3_600_000,
        transcriptOutcome: 'empty',
        segments: [],
      } as Partial<TranscriptionStatusPayload>)
    );

    await processRecordingQueueItem(context);

    expect(context.analyzeMeeting).not.toHaveBeenCalled();
    expect(context.attachCompletedRecording).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'recording-1',
        duration: 3600,
        transcriptOutcome: 'empty',
      })
    );
  });

  it('keeps active remote processing in the queue after soft polling timeout', async () => {
    let now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const context = buildContext({
      nextItem: makeQueueItem({
        status: 'processing',
        uploaded: true,
        processingStartedAt: new Date(now).toISOString(),
      }),
      sleep: vi.fn(async (ms: number) => {
        now += ms;
      }),
      now: () => now,
    });
    const mediaService = context.createMediaService();
    mediaService.mode = 'remote';
    mediaService.getTranscriptionJobStatus = vi.fn(async () =>
      makeTranscription({
        pipelineStatus: 'processing',
        segments: [],
        activeJob: true,
        processingAgeMs: now - Date.UTC(2026, 0, 1, 0, 0, 0),
        retryAfterMs: 60_000,
      } as Partial<TranscriptionStatusPayload>)
    );

    await processRecordingQueueItem(context);

    expect(context.removeQueueItem).not.toHaveBeenCalled();
    expect(context.analyzeMeeting).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'processing',
        errorMessage: '',
        backoffUntil: now + 60_000,
      })
    );
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'processing',
        recordingMessage: BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
      })
    );
  });

  it('uses completed remote status before retrying an uploaded queue item', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({
        status: 'queued',
        uploaded: true,
      }),
      getAudioBlob: vi.fn(async () => null),
    });
    context.mediaService.mode = 'remote';
    context.mediaService.getTranscriptionJobStatus = vi.fn(async () => makeTranscription());
    context.mediaService.retryTranscriptionJob = vi.fn(async () =>
      makeTranscription({ recordingId: 'should-not-retry' })
    );

    await processRecordingQueueItem(context);

    expect(context.mediaService.getTranscriptionJobStatus).toHaveBeenCalledWith('recording-1');
    expect(context.mediaService.retryTranscriptionJob).not.toHaveBeenCalled();
    expect(context.attachCompletedRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        id: meeting.id,
        workspaceId: meeting.workspaceId,
        title: meeting.title,
      }),
      expect.objectContaining({
        id: 'recording-1',
        pipelineStatus: 'done',
      })
    );
    expect(context.removeQueueItem).toHaveBeenCalledWith('recording-1');
  });

  it('passes the full meeting context so attach can recover when the live id changed', async () => {
    const attachCompletedRecording = vi.fn((target) => {
      return (
        typeof target === 'object' &&
        target?.id === meeting.id &&
        target?.workspaceId === meeting.workspaceId &&
        target?.title === meeting.title
      );
    });
    const context = buildContext({ attachCompletedRecording });

    await processRecordingQueueItem(context);

    expect(attachCompletedRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        id: meeting.id,
        workspaceId: meeting.workspaceId,
        title: meeting.title,
      }),
      expect.objectContaining({ id: 'recording-1', pipelineStatus: 'done' })
    );
    expect(context.removeQueueItem).toHaveBeenCalledWith('recording-1');
  });

  it('keeps a completed transcript recoverable instead of failing when attach is temporarily missing the meeting', async () => {
    const now = 10_000;
    const context = buildContext({
      attachCompletedRecording: vi.fn(() => false),
      now: () => now,
    });

    await processRecordingQueueItem(context);

    expect(context.removeQueueItem).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'processing',
        errorMessage: '',
        lastErrorMessage: '',
        backoffUntil: now + 60_000,
      })
    );
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'processing',
        recordingMessage: 'Nagranie jest gotowe, odtwarzamy spotkanie i podpinamy wynik.',
      })
    );
  });

  it('Regression: retries queue item when processing state is stuck in background polling', async () => {
    let now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const context = buildContext({
      nextItem: makeQueueItem({
        status: 'processing',
        uploaded: true,
        processingStartedAt: new Date(now).toISOString(),
      }),
      sleep: vi.fn(async (ms: number) => {
        now += ms;
      }),
      now: () => now,
    });
    const mediaService = context.createMediaService();
    mediaService.mode = 'remote';
    mediaService.getTranscriptionJobStatus = vi.fn(async () =>
      makeTranscription({
        pipelineStatus: 'processing',
        segments: [],
        processingAgeMs: now - Date.UTC(2026, 0, 1, 0, 0, 0),
      } as never)
    );

    await processRecordingQueueItem(context);

    expect(context.removeQueueItem).not.toHaveBeenCalled();
    expect(context.analyzeMeeting).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'processing',
        errorMessage: '',
        backoffUntil: now + BACKGROUND_TRANSCRIPTION_RETRY_MS,
      })
    );
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'processing',
        recordingMessage: BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
      })
    );
  });

  it('Regression: retries queue item when Vercel proxy times out connecting to backend', async () => {
    const timeoutError = Object.assign(new Error('connect ETIMEDOUT'), {
      code: 'ETIMEDOUT',
      status: 504,
    });
    const context = buildContext({
      now: () => 6_000,
      isTransientNetworkError: vi.fn(
        (error: { code?: string; message?: string }) =>
          error?.code === 'ETIMEDOUT' || String(error?.message || '').includes('ETIMEDOUT')
      ),
      retryDelaysMs: [1_000],
    });

    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(timeoutError);

    await processRecordingQueueItem(context);

    expect(context.mediaService.persistRecordingAudio).toHaveBeenCalledTimes(1);
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 1_000);
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 1,
        backoffUntil: 7_000,
        lastErrorMessage: 'UI: connect ETIMEDOUT',
        errorMessage: '',
      })
    );
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('Regression: retries queue item when backend is temporarily memory overloaded', async () => {
    const overloadError = Object.assign(new Error('Backend temporarily unavailable'), {
      status: 503,
      code: 'EOVERFLOW',
    });
    const context = buildContext({
      now: () => 6_000,
      isTransientNetworkError: vi.fn(
        (error: { status?: number }) => Number(error?.status) >= 500 && error?.status !== 401
      ),
      retryDelaysMs: [1_000],
    });

    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(overloadError);

    await processRecordingQueueItem(context);

    expect(context.mediaService.persistRecordingAudio).toHaveBeenCalledTimes(1);
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 1_000);
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 1,
        backoffUntil: 7_000,
        lastErrorMessage: 'UI: Backend temporarily unavailable',
        errorMessage: '',
      })
    );
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('skips local VAD and enhancement for long recordings before upload', async () => {
    const originalBlob = new Blob(['long-recording'], { type: 'audio/webm' });
    const context = buildContext({
      nextItem: makeQueueItem({
        duration: CLIENT_AUDIO_PREPROCESSING_LIMITS.maxDurationSeconds + 30,
      }),
      getAudioBlob: vi.fn(async () => originalBlob),
    });

    await processRecordingQueueItem(context);

    expect(context.filterSilence).not.toHaveBeenCalled();
    expect(context.enhanceAndReencode).not.toHaveBeenCalled();
    expect(context.mediaService.persistRecordingAudio).toHaveBeenCalledWith(
      'recording-1',
      originalBlob,
      expect.objectContaining({
        workspaceId: meeting.workspaceId,
        meetingId: meeting.id,
      })
    );
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        recordingMessage: expect.stringContaining('Długie nagranie'),
        pipelineStageLabel: expect.stringContaining('serwerowego przetwarzania'),
      })
    );
  });

  it('blocks remote upload when neither meeting nor queue item has workspaceId', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({
        workspaceId: '',
        meetingSnapshot: { id: 'meeting-1', title: 'Missing workspace' },
      }),
      resolveMeetingForQueueItem: vi.fn(() => ({ id: 'meeting-1', title: 'Missing workspace' })),
    });
    context.mediaService.mode = 'remote';

    await processRecordingQueueItem(context);

    expect(context.mediaService.persistRecordingAudio).not.toHaveBeenCalled();
    expect(context.getAudioBlob).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith('recording-1', {
      status: 'failed_permanent',
      errorMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
    });
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'error',
        recordingMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
      })
    );
  });

  it('marks the queue item as failed when the local blob is missing', async () => {
    const context = buildContext({
      getAudioBlob: vi.fn(async () => null),
    });

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith('recording-1', {
      status: 'failed',
      errorMessage: 'Brakuje lokalnego audio.',
    });
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineProgressPercent: 0,
        pipelineStageLabel: 'Brakuje lokalnego audio',
      })
    );
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('requeues transient upload failures with backoff metadata', async () => {
    const transientError = new Error('Failed to fetch');
    const context = buildContext();
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(transientError);

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 1,
        backoffUntil: 6000,
        lastErrorMessage: 'UI: Failed to fetch',
        errorMessage: '',
      })
    );
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 1000);
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('reports unexpected queue failures to Sentry with recording context', async () => {
    const uploadError = Object.assign(new Error('Remote upload crashed'), {
      code: 'upload_failed',
      status: 502,
      transcript: 'raw transcript must not be sent',
    });
    const context = buildContext();
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(uploadError);

    await processRecordingQueueItem(context);

    expect(sentryMocks.captureQueueException).toHaveBeenCalledWith(
      uploadError,
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordingId: 'recording-1',
        pipelineStage: 'queue_failure',
        errorCode: 'upload_failed',
        retryable: false,
        status: 502,
      }),
      expect.objectContaining({
        level: 'error',
        fingerprint: ['recording-queue', 'upload_failed'],
      })
    );
    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'failed',
        errorMessage: 'UI: Remote upload crashed',
      })
    );
  });

  it('advances transient retry delay when previous backoff count exists', async () => {
    const transientError = new Error('Failed to fetch');
    const context = buildContext({
      nextItem: makeQueueItem({ retryCount: 1 }),
      retryDelaysMs: [1000, 4000, 16_000],
    });
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(transientError);

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 2,
        backoffUntil: 9_000,
        lastErrorMessage: 'UI: Failed to fetch',
        errorMessage: '',
      })
    );
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 4_000);
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('preserves item after fetch abort and retries once with backoff', async () => {
    const abortError = Object.assign(new Error('The user aborted a request.'), {
      name: 'AbortError',
    });
    const context = buildContext({
      isTransientNetworkError: vi.fn(
        (error: { name?: string; message?: string }) => error?.name === 'AbortError'
      ),
      retryDelaysMs: [1000],
      maxAutoRetries: 1,
    });
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(abortError);

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 1,
        backoffUntil: 6000,
        lastErrorMessage: 'UI: The user aborted a request.',
        errorMessage: '',
      })
    );
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 1000);
    expect(context.removeQueueItem).not.toHaveBeenCalled();
  });

  it('Regression: #0 - retries STT rate limits with server-provided backoff', async () => {
    const rateLimitError: any = new Error('Rate limit reached.');
    rateLimitError.errorCode = 'stt_rate_limited';
    rateLimitError.retryable = true;
    rateLimitError.retryAfterMs = 45_000;
    const context = buildContext({
      isTransientNetworkError: vi.fn(
        (error: any) => error?.errorCode === 'stt_rate_limited' && error?.retryable
      ),
      toUserFacingQueueError: vi.fn(() => 'Limit transkrypcji, ponawiamy za chwile.'),
      retryDelaysMs: [1000],
      maxAutoRetries: 1,
    });
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(rateLimitError);

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith(
      'recording-1',
      expect.objectContaining({
        status: 'queued',
        retryCount: 1,
        backoffUntil: 50_000,
        lastErrorMessage: 'Limit transkrypcji, ponawiamy za chwile.',
        errorCode: 'stt_rate_limited',
        retryAfterMs: 45_000,
      })
    );
    expect(context.scheduleBackoffReset).toHaveBeenCalledWith('recording-1', 45_000);
  });

  it('Regression: #0 - attaches completed remote recording despite stale failed queue item', async () => {
    const context = buildContext({
      nextItem: makeQueueItem({
        uploaded: true,
        status: 'failed',
        workspaceId: 'workspace-1',
        errorMessage: 'old local failure',
      }),
    });
    context.mediaService.mode = 'remote';
    context.mediaService.getTranscriptionJobStatus.mockResolvedValueOnce(makeTranscription());

    await processRecordingQueueItem(context);

    expect(context.getAudioBlob).not.toHaveBeenCalled();
    expect(context.mediaService.retryTranscriptionJob).not.toHaveBeenCalled();
    expect(context.attachCompletedRecording).toHaveBeenCalled();
    expect(context.removeQueueItem).toHaveBeenCalledWith('recording-1');
  });

  it('marks stale uploaded remote recordings as permanent without retrying STT', async () => {
    const notFound = Object.assign(new Error('Nie znaleziono nagrania.'), { status: 404 });
    const context = buildContext({
      nextItem: makeQueueItem({
        uploaded: true,
        status: 'processing',
        workspaceId: 'workspace-1',
      }),
      toUserFacingQueueError: vi.fn((error: Error) => error.message),
      isExpectedDomainFailure: vi.fn(() => true),
    });
    context.mediaService.mode = 'remote';
    context.mediaService.getTranscriptionJobStatus.mockRejectedValueOnce(notFound);

    await processRecordingQueueItem(context);

    expect(context.getAudioBlob).not.toHaveBeenCalled();
    expect(context.mediaService.retryTranscriptionJob).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith('recording-1', {
      status: 'failed_permanent',
      errorMessage: REMOTE_RECORDING_MISSING_MESSAGE,
    });
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'error',
        recordingMessage: `Blad w kolejce: ${REMOTE_RECORDING_MISSING_MESSAGE}`,
      })
    );
  });

  // -----------------------------------------------------------------
  // Issue #0 - backend missing X-Workspace-Id leaked as retryable queue error
  // Date: 2026-05-21
  // Bug: a 400 workspace-header error could remain retryable and technical.
  // Fix: mark it permanent and show the user-facing workspace message.
  // -----------------------------------------------------------------
  it('marks backend missing workspace errors as permanent friendly queue failures', async () => {
    const missingWorkspace = Object.assign(new Error('Brakuje X-Workspace-Id.'), { status: 400 });
    const context = buildContext({
      nextItem: makeQueueItem({
        uploaded: true,
        status: 'processing',
        workspaceId: 'workspace-1',
      }),
      toUserFacingQueueError: vi.fn(() => RECORDING_WORKSPACE_REQUIRED_MESSAGE),
      isExpectedDomainFailure: vi.fn(() => true),
    });
    context.mediaService.mode = 'remote';
    context.mediaService.getTranscriptionJobStatus.mockRejectedValueOnce(missingWorkspace);

    await processRecordingQueueItem(context);

    expect(context.getAudioBlob).not.toHaveBeenCalled();
    expect(context.mediaService.retryTranscriptionJob).not.toHaveBeenCalled();
    expect(context.updateQueueItem).toHaveBeenCalledWith('recording-1', {
      status: 'failed_permanent',
      errorMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
    });
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'error',
        recordingMessage: `Blad w kolejce: ${RECORDING_WORKSPACE_REQUIRED_MESSAGE}`,
      })
    );
  });

  it('marks non-transient conflicts as permanent failures', async () => {
    const conflictError = Object.assign(new Error('Conflict'), { status: 409 });
    const context = buildContext({
      isTransientNetworkError: vi.fn(() => false),
      toUserFacingQueueError: vi.fn(() => 'Conflict'),
    });
    context.mediaService.persistRecordingAudio.mockRejectedValueOnce(conflictError);

    await processRecordingQueueItem(context);

    expect(context.updateQueueItem).toHaveBeenCalledWith('recording-1', {
      status: 'failed_permanent',
      errorMessage: 'Conflict',
    });
    expect(context.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisStatus: 'error',
        recordingMessage: 'Blad w kolejce: Conflict',
      })
    );
  });
});
