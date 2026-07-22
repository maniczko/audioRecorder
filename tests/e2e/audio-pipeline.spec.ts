import { expect, test } from '@playwright/test';
import { fixtureAudioFile, wavToneBuffer } from './fixtures/audioFixture.js';
import { seedLoggedInUser } from './helpers/seed.js';

test.skip(
  process.env.PLAYWRIGHT_MEDIA_PROVIDER !== 'remote',
  'Audio pipeline E2E requires PLAYWRIGHT_MEDIA_PROVIDER=remote; use pnpm run test:e2e:audio.'
);

type AudioRouteOptions = {
  holdUpload?: boolean;
  failUpload?: boolean;
  failFirstUpload?: boolean;
  failTranscriptionStart?: boolean;
};

async function openShellTab(page, label: string) {
  const hamburger = page.locator('.modern-hamburger-btn');
  const navItem = page.locator('.modern-nav-item').filter({ hasText: label }).first();

  if (!(await navItem.isVisible().catch(() => false)) && (await hamburger.isVisible())) {
    await hamburger.click();
  }

  await expect(navItem).toBeVisible();
  await navItem.click();
}

async function acceptRecordingConsent(page) {
  const dialog = page.getByRole('dialog', { name: /zgod|nagrywanie/i });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: /Akceptuje i zaczynam nagrywanie/i }).click();
}

async function readPersistedRecordingQueue(page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('voicelog.recordingQueue.v1');
    return raw ? JSON.parse(raw) : null;
  });
}

async function readPersistedMeetings(page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('voicelog_meetings_store');
    return raw ? JSON.parse(raw)?.state?.meetings || [] : [];
  });
}

async function installFakeAudioCapture(page, mode: 'ready' | 'permission-denied' | 'unsupported') {
  await page.addInitScript((captureMode) => {
    const createFakeStream = () => ({
      id: `fake_stream_${Date.now()}`,
      active: true,
      getTracks: () => [{ kind: 'audio', enabled: true, stop() {} }],
      getAudioTracks: () => [{ kind: 'audio', enabled: true, stop() {} }],
    });

    class FakeAudioNode {
      connect() {
        return this;
      }
      disconnect() {}
    }

    class FakeAnalyserNode extends FakeAudioNode {
      fftSize = 256;
      frequencyBinCount = 32;
      getByteFrequencyData(target: Uint8Array) {
        for (let index = 0; index < target.length; index += 1) {
          target[index] = index % 3 === 0 ? 36 : 12;
        }
      }
    }

    class FakeAudioContext {
      state = 'running';
      createMediaStreamSource() {
        return new FakeAudioNode();
      }
      createAnalyser() {
        return new FakeAnalyserNode();
      }
      createMediaStreamDestination() {
        return { stream: createFakeStream() };
      }
      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    }

    class FakeMediaRecorder {
      static isTypeSupported() {
        return true;
      }
      stream: MediaStream;
      mimeType: string;
      state = 'inactive';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(stream: MediaStream, options: MediaRecorderOptions = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        this.ondataavailable?.({
          data: new Blob([new Uint8Array(25 * 1024 * 1024)], {
            type: this.mimeType || 'audio/webm',
          }),
        });
        this.onstop?.();
      }
      pause() {
        this.state = 'paused';
      }
      resume() {
        this.state = 'recording';
      }
    }

    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: async () => ({
          state: captureMode === 'permission-denied' ? 'denied' : 'granted',
          onchange: null,
        }),
      },
    });

    if (captureMode === 'unsupported') {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: undefined,
      });
      return;
    }

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (captureMode === 'permission-denied') {
            const error = new Error('Permission denied by E2E test');
            error.name = 'NotAllowedError';
            throw error;
          }
          return createFakeStream();
        },
      },
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, 'webkitAudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  }, mode);
}

async function mockRemoteWorkspaceShell(page) {
  const user = {
    id: 'user_e2e',
    email: 'e2e@voicelog.test',
    name: 'E2E Tester',
    workspaceMemberRole: 'owner',
  };
  const workspace = {
    id: 'ws_e2e',
    name: 'E2E Workspace',
    memberIds: [user.id],
    memberRoles: { [user.id]: 'owner' },
  };
  const capabilities = {
    ok: true,
    status: 'ready',
    capabilities: {},
    degradedCapabilities: [],
    telemetry: {
      fallbackModeUsed: false,
      fallbackModeCapabilities: [],
    },
  };

  await page.route('**/state/bootstrap?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        workspaceId: workspace.id,
        users: [user],
        workspaces: [workspace],
        state: {
          meetings: [],
          manualPeople: [],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
      }),
    })
  );
  await page.route('**/api/capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capabilities),
    })
  );
  await page.route('**/workspaces/*/capabilities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capabilities),
    })
  );
  await page.route('**/state/workspaces/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  );
  await page.route('**/voice-profiles', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profiles: [] }),
    })
  );
  await page.route('**/integrations/google/status?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: false, connected: false, writable: false }),
    })
  );
}

async function mockRemoteAudioPipeline(page, options: AudioRouteOptions = {}) {
  const stats = {
    uploadRequests: 0,
    transcriptionStartRequests: 0,
    transcriptionStatusRequests: 0,
    retryRequests: 0,
  };
  let releaseUpload: (() => void) | null = null;
  let uploadReleased = false;
  let resolveUploadStarted: () => void = () => {};
  const uploadStarted = new Promise<void>((resolve) => {
    resolveUploadStarted = resolve;
  });

  const completeUpload = async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        storageMode: 'remote',
        durationMs: 4200,
        audioQuality: { rmsDb: -18, clipping: false },
      }),
    });
  };

  const maybeHoldOrFailUpload = async (route, isFirstChunkOrSingleUpload: boolean) => {
    if (isFirstChunkOrSingleUpload) {
      stats.uploadRequests += 1;
      resolveUploadStarted();
    }

    if (options.holdUpload && isFirstChunkOrSingleUpload) {
      await new Promise<void>((uploadRelease) => {
        releaseUpload = () => {
          uploadReleased = true;
          uploadRelease();
        };
        if (uploadReleased) uploadRelease();
      });
    }

    if (
      isFirstChunkOrSingleUpload &&
      (options.failUpload || (options.failFirstUpload && stats.uploadRequests === 1))
    ) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Upload audio odrzucony przez test E2E.' }),
      });
      return true;
    }

    return false;
  };

  await page.route('**/media/recordings/*/audio/chunk-status?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ nextIndex: 0 }),
    });
  });

  await page.route('**/media/recordings/*/audio/chunk?*', async (route, request) => {
    if (request.method() !== 'PUT') {
      await route.fallback();
      return;
    }

    const index = Number(new URL(request.url()).searchParams.get('index') || 0);
    if (await maybeHoldOrFailUpload(route, index === 0)) {
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/media/recordings/*/audio/finalize', async (route) => {
    await completeUpload(route);
  });

  await page.route('**/media/recordings/*/audio', async (route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: wavToneBuffer(),
      });
      return;
    }

    if (request.method() !== 'PUT') {
      await route.fallback();
      return;
    }

    if (await maybeHoldOrFailUpload(route, true)) {
      return;
    }

    await completeUpload(route);
  });

  await page.route('**/media/recordings/*/transcribe', async (route, request) => {
    if (request.method() === 'POST') {
      stats.transcriptionStartRequests += 1;
      if (options.failTranscriptionStart) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Transkrypcja odrzucona przez test E2E.' }),
        });
        return;
      }
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          pipelineStatus: 'processing',
          activeJob: true,
          queuedPosition: 1,
          retryAfterMs: 1500,
        }),
      });
      return;
    }

    stats.transcriptionStatusRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pipelineStatus: stats.transcriptionStatusRequests === 1 ? 'processing' : 'done',
        activeJob: stats.transcriptionStatusRequests === 1,
        retryAfterMs: 1500,
        segments:
          stats.transcriptionStatusRequests === 1
            ? []
            : [
                {
                  id: 'audio-e2e-seg-1',
                  timestamp: 0,
                  endTimestamp: 4.2,
                  speakerId: 0,
                  text: 'Audio E2E transcript attached.',
                  verificationStatus: 'verified',
                },
              ],
        speakerNames: { 0: 'Audio E2E' },
        speakerCount: 1,
        confidence: 0.98,
      }),
    });
  });

  await page.route('**/media/recordings/*/retry-transcribe', async (route) => {
    stats.retryRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pipelineStatus: 'done',
        segments: [
          {
            id: 'audio-e2e-retry-seg-1',
            timestamp: 0,
            endTimestamp: 3,
            speakerId: 0,
            text: 'Audio E2E retry transcript attached.',
            verificationStatus: 'verified',
          },
        ],
        speakerNames: { 0: 'Audio E2E' },
        speakerCount: 1,
      }),
    });
  });

  await page.route('**/media/recordings/*/progress*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: completed\ndata: {"status":"done"}\n\n',
    })
  );

  await page.route('**/media/analyze', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: 'Audio E2E summary',
        actionItems: [{ text: 'Confirm audio E2E coverage.' }],
        decisions: ['Audio pipeline E2E is covered'],
      }),
    });
  });

  await page.route('**/media/upload-policy', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        maxRawUploadBytes: 200 * 1024 * 1024,
        clientChunkBytes: 4 * 1024 * 1024,
        singleObjectMaxBytes: 24 * 1024 * 1024,
        segmentPartMaxBytes: 20 * 1024 * 1024,
        storageContentType: 'audio/webm',
      }),
    });
  });

  return {
    stats,
    uploadStarted,
    releaseUpload: () => {
      uploadReleased = true;
      releaseUpload?.();
    },
  };
}

test.describe('Audio recording pipeline E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await mockRemoteWorkspaceShell(page);
  });

  test('records, pauses, resumes, uploads, processes, and attaches transcript', async ({
    page,
  }) => {
    const pipeline = await mockRemoteAudioPipeline(page, { holdUpload: true });
    await installFakeAudioCapture(page, 'ready');
    await seedLoggedInUser(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Nagraj ad hoc' }).click();
    await acceptRecordingConsent(page);

    await expect(page.getByText(/Nagrywanie/i).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Wstrzymaj/i }).click();
    await expect(page.getByText(/Wstrzymano/i)).toBeVisible();
    await page.getByRole('button', { name: /Wzn/i }).click();
    await expect(page.getByText(/Nagrywanie/i).first()).toBeVisible();
    await page
      .getByRole('button', { name: /Zako|Stop/i })
      .first()
      .click();

    await pipeline.uploadStarted;
    await expect(page.getByText(/Wgrywanie|Wysy|audio/i).first()).toBeVisible();

    pipeline.releaseUpload();
    await expect(page.getByText('Audio E2E transcript attached.')).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.getByText('Audio E2E summary')).toBeVisible();
    expect(pipeline.stats.uploadRequests).toBe(1);
    expect(pipeline.stats.transcriptionStartRequests).toBe(1);
    expect(pipeline.stats.transcriptionStatusRequests).toBeGreaterThanOrEqual(2);

    const meetings = await readPersistedMeetings(page);
    const completedRecording = meetings
      .flatMap((meeting: { recordings?: unknown[] }) => meeting.recordings || [])
      .find((recording: { transcript?: Array<{ text?: string }> }) =>
        recording.transcript?.some((segment) => segment.text === 'Audio E2E transcript attached.')
      );
    expect(completedRecording).toBeTruthy();
  });

  test('shows unsupported microphone state without creating queue item', async ({ page }) => {
    await installFakeAudioCapture(page, 'unsupported');
    await seedLoggedInUser(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Nagraj ad hoc' }).click();
    await acceptRecordingConsent(page);

    await expect(page.getByText(/nie obs.*dost.*mikrofonu/i)).toBeVisible();
    const queue = await readPersistedRecordingQueue(page);
    expect(queue?.state?.recordingQueue || []).toHaveLength(0);
  });

  test('shows permission denied state without creating queue item', async ({ page }) => {
    await installFakeAudioCapture(page, 'permission-denied');
    await seedLoggedInUser(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Nagraj ad hoc' }).click();
    await acceptRecordingConsent(page);

    await expect(page.getByText(/mikrofon.*zablokowany|dostep.*mikrofonu/i)).toBeVisible();
    const queue = await readPersistedRecordingQueue(page);
    expect(queue?.state?.recordingQueue || []).toHaveLength(0);
  });

  test('keeps failed upload retryable and succeeds after retry', async ({ page }) => {
    const pipeline = await mockRemoteAudioPipeline(page, { failFirstUpload: true });
    await seedLoggedInUser(page);

    await page.goto('/');
    await openShellTab(page, 'Nagrania');
    await page.getByTestId('recordings-file-input').setInputFiles(fixtureAudioFile('retry.webm'));
    await expect(page.getByText(/Upload audio odrzucony/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await page
      .getByRole('button', { name: /Spr.*ponownie|Ponow przetwarzanie/i })
      .first()
      .click();
    await expect
      .poll(
        async () => {
          const meetings = await readPersistedMeetings(page);
          return meetings
            .flatMap((meeting: { recordings?: unknown[] }) => meeting.recordings || [])
            .some((recording: { transcript?: Array<{ text?: string }> }) =>
              recording.transcript?.some(
                (segment) => segment.text === 'Audio E2E transcript attached.'
              )
            );
        },
        { timeout: 25_000 }
      )
      .toBe(true);
    expect(pipeline.stats.uploadRequests).toBe(2);
    expect(pipeline.stats.transcriptionStartRequests).toBe(1);
  });

  test('uploads fixture audio file through deterministic import path', async ({ page }) => {
    const pipeline = await mockRemoteAudioPipeline(page);
    await seedLoggedInUser(page);

    await page.goto('/');
    await openShellTab(page, 'Nagrania');
    await page.getByTestId('recordings-file-input').setInputFiles(fixtureAudioFile());

    await expect
      .poll(
        async () => {
          const meetings = await readPersistedMeetings(page);
          return meetings
            .flatMap((meeting: { recordings?: unknown[] }) => meeting.recordings || [])
            .some((recording: { transcript?: Array<{ text?: string }> }) =>
              recording.transcript?.some(
                (segment) => segment.text === 'Audio E2E transcript attached.'
              )
            );
        },
        { timeout: 25_000 }
      )
      .toBe(true);
    await page.getByText('Import: audio-e2e-fixture').first().click();
    await expect(page.getByText('Audio E2E transcript attached.')).toBeVisible();
    expect(pipeline.stats.uploadRequests).toBe(1);
    expect(pipeline.stats.transcriptionStartRequests).toBe(1);
  });
});
