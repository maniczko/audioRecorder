import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type SmokeStep = {
  name: string;
  ok: boolean;
  status?: number;
  requestId?: string;
  details?: unknown;
  error?: string;
};

export type AudioProdSmokeOptions = {
  baseUrl: string;
  email?: string;
  password?: string;
  token?: string;
  workspaceId: string;
  expectedGitSha?: string;
  reportPath: string;
  uploadModes?: ('chunked' | 'single')[];
  cleanup?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleepMs?: (ms: number) => Promise<void>;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

type AudioUploadMode = 'chunked' | 'single';

type JsonObject = Record<string, unknown>;

const TERMINAL_PIPELINE_STATUSES = new Set(['done', 'failed']);
const TERMINAL_TRANSCRIPT_OUTCOMES = new Set(['normal', 'empty', 'failed', 'failed_permanent']);
const SMOKE_TRANSPORT_DETAILS = Symbol('smokeTransportDetails');
const SMOKE_RECORDING_PREFIX = 'smoke_';
const SMOKE_FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'tests',
  'fixtures',
  'audio',
  'smoke-short.wav.base64'
);

function defaultReportPath() {
  return path.join(process.cwd(), 'reports', `audio-prod-smoke-${Date.now()}.json`);
}

function parseUploadModes(raw: string): AudioUploadMode[] {
  const parsed = String(raw || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const allowed = new Set<AudioUploadMode>(['single', 'chunked']);
  const result: AudioUploadMode[] = [];

  for (const value of parsed) {
    if (allowed.has(value as AudioUploadMode) && !result.includes(value as AudioUploadMode)) {
      result.push(value as AudioUploadMode);
    }
  }

  return result.length > 0 ? result : ['single', 'chunked'];
}

export function optionsFromEnv(env = process.env): AudioProdSmokeOptions {
  return {
    baseUrl: String(
      env.PRODUCTION_SMOKE_BASE_URL || env.PRODUCTION_API_BASE_URL || 'http://localhost:4001'
    ).replace(/\/$/, ''),
    email: String(env.PRODUCTION_SMOKE_EMAIL || ''),
    password: String(env.PRODUCTION_SMOKE_PASSWORD || ''),
    token: String(env.PRODUCTION_SMOKE_AUTH_TOKEN || ''),
    workspaceId: String(env.PRODUCTION_SMOKE_WORKSPACE_ID || ''),
    expectedGitSha: String(env.PRODUCTION_EXPECTED_GIT_SHA || env.GITHUB_SHA || ''),
    reportPath: String(env.PRODUCTION_SMOKE_REPORT || defaultReportPath()),
    uploadModes: parseUploadModes(env.PRODUCTION_SMOKE_AUDIO_UPLOAD_MODES || 'single,chunked'),
    cleanup: String(env.PRODUCTION_SMOKE_CLEANUP || '').toLowerCase() === 'true',
  };
}

export async function loadSmokeAudioFixture(fixturePath = SMOKE_FIXTURE_PATH) {
  const encoded = await fs.readFile(fixturePath, 'utf8');
  const buffer = Buffer.from(encoded.replace(/\s+/g, ''), 'base64');

  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error(`Audio smoke fixture is invalid: ${fixturePath}`);
  }

  return buffer;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function headerValue(headers: Headers, name: string) {
  return headers.get(name) || headers.get(name.toLowerCase()) || undefined;
}

async function readJson(res: Response): Promise<JsonObject> {
  try {
    return asObject(await res.json());
  } catch {
    return {};
  }
}

function sanitizeDetails(value: unknown): JsonObject {
  const source = asObject(value);
  const segments = Array.isArray(source.segments) ? source.segments : [];
  const diagnostics = asObject(source.transcriptionDiagnostics);

  return {
    message: source.message,
    recordingId: source.recordingId || source.id,
    pipelineStatus: source.pipelineStatus || source.status || source.transcription_status,
    transcriptOutcome: source.transcriptOutcome,
    emptyReason: source.emptyReason,
    retryable: source.retryable,
    errorCode: source.errorCode,
    errorMessage: source.errorMessage,
    segmentCount: segments.length,
    durationMs: source.durationMs,
    queuedPosition: source.queuedPosition,
    activeJob: source.activeJob,
    diagnostics: Object.keys(diagnostics).length
      ? {
          chunksAttempted: diagnostics.chunksAttempted,
          chunksWithText: diagnostics.chunksWithText,
          provider: diagnostics.provider,
          model: diagnostics.model,
          retryable: diagnostics.retryable,
          errorCode: diagnostics.errorCode,
        }
      : undefined,
  };
}

function isTerminalTranscriptionStatus(payload: JsonObject) {
  const pipelineStatus = String(payload.pipelineStatus || payload.status || '').toLowerCase();
  const transcriptOutcome = String(payload.transcriptOutcome || '').toLowerCase();
  return (
    TERMINAL_PIPELINE_STATUSES.has(pipelineStatus) ||
    TERMINAL_TRANSCRIPT_OUTCOMES.has(transcriptOutcome)
  );
}

function compareExpectedGitSha(details: JsonObject, expectedGitSha = '') {
  const actual = String(details.gitSha || '').trim();
  const expected = String(expectedGitSha || '')
    .trim()
    .toLowerCase();

  if (!expected) {
    return { ok: true };
  }

  if (!actual) {
    return { ok: false, message: 'health did not return gitSha for SHA verification' };
  }

  if (actual.toLowerCase() !== expected.toLowerCase()) {
    return {
      ok: false,
      message: `backend git SHA mismatch (expected ${expected}, received ${actual})`,
    };
  }

  return { ok: true };
}

function classifyTranscriptFinalState(payload: JsonObject) {
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const transcriptOutcome = String(payload.transcriptOutcome || '').toLowerCase();
  const pipelineStatus = String(payload.pipelineStatus || payload.status || '').toLowerCase();
  const isFailed =
    pipelineStatus === 'failed' ||
    transcriptOutcome === 'failed' ||
    transcriptOutcome === 'failed_permanent';
  const isEmptyOutcome = transcriptOutcome === 'empty';
  const hasText = segments.length > 0;

  if (isFailed) {
    return {
      ok: false,
      state: 'failed',
      segmentCount: segments.length,
      transcriptOutcome,
      emptyReason: payload.emptyReason || null,
      note: `transcription failed with outcome ${transcriptOutcome || pipelineStatus || 'unknown'}`,
    };
  }

  if (isEmptyOutcome) {
    return {
      ok: true,
      state: 'empty',
      segmentCount: segments.length,
      transcriptOutcome,
      emptyReason: payload.emptyReason || null,
      note: 'transcript intentionally empty',
    };
  }

  if (pipelineStatus === 'done' && !isFailed && !isEmptyOutcome && hasText) {
    return {
      ok: true,
      state: 'completed',
      segmentCount: segments.length,
      transcriptOutcome,
      emptyReason: null,
      note: 'transcript persisted',
    };
  }

  return {
    ok: false,
    state: 'not-persisted',
    segmentCount: segments.length,
    transcriptOutcome,
    emptyReason: payload.emptyReason || null,
    note: 'transcript not in a completed successful state',
  };
}

async function smokeRequest(
  options: Required<Pick<AudioProdSmokeOptions, 'fetchImpl'>> &
    Pick<AudioProdSmokeOptions, 'baseUrl'>,
  pathname: string,
  init: RequestInit = {}
) {
  const url = `${options.baseUrl}${pathname}`;
  try {
    return await options.fetchImpl(url, init);
  } catch (error: any) {
    error[SMOKE_TRANSPORT_DETAILS] = {
      kind: 'transport',
      baseUrl: options.baseUrl,
      path: pathname,
      url,
      method: init.method || 'GET',
      hint: 'backend unavailable or unreachable; verify the VoiceLog API process, port, CORS/network access, and /health route',
    };
    throw error;
  }
}

async function step(name: string, run: () => Promise<Partial<SmokeStep>>): Promise<SmokeStep> {
  try {
    const result = await run();
    return { name, ok: result.ok !== false, ...result };
  } catch (error: any) {
    return {
      name,
      ok: false,
      error: error?.message || String(error),
      details: error?.[SMOKE_TRANSPORT_DETAILS],
    };
  }
}

function authHeaders(token: string, workspaceId = '') {
  return {
    Authorization: `Bearer ${token}`,
    ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
  };
}

async function uploadRecordingChunked(
  requestOptions: { baseUrl: string; fetchImpl: typeof fetch },
  recordingId: string,
  token: string,
  workspaceId: string,
  audioFixture: Buffer,
  smokeHeaders: (token: string, workspaceId: string) => Record<string, string>
) {
  const chunkCount = 2;
  const chunkSize = Math.ceil(audioFixture.byteLength / chunkCount);

  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = audioFixture.subarray(index * chunkSize, (index + 1) * chunkSize);
    const res = await smokeRequest(
      requestOptions,
      `/media/recordings/${recordingId}/audio/chunk?index=${index}&total=${chunkCount}`,
      {
        method: 'PUT',
        headers: {
          ...smokeHeaders(token, workspaceId),
          'Content-Type': 'audio/wav',
        },
        body: chunk as unknown as BodyInit,
      }
    );
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(
        `Chunk upload failed with status ${res.status}: ${String(details.message || '')}`
      );
    }
  }

  const finalizeResponse = await smokeRequest(
    requestOptions,
    `/media/recordings/${recordingId}/audio/finalize`,
    {
      method: 'POST',
      headers: {
        ...smokeHeaders(token, workspaceId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workspaceId, total: chunkCount, contentType: 'audio/wav' }),
    }
  );

  return {
    uploadResponse: finalizeResponse,
    uploadMode: 'chunked',
  } as const;
}

async function uploadRecordingSingle(
  requestOptions: { baseUrl: string; fetchImpl: typeof fetch },
  recordingId: string,
  token: string,
  workspaceId: string,
  audioFixture: Buffer,
  smokeHeaders: (token: string, workspaceId: string) => Record<string, string>
) {
  const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}/audio`, {
    method: 'PUT',
    headers: {
      ...smokeHeaders(token, workspaceId),
      'Content-Type': 'audio/wav',
    },
    body: audioFixture as unknown as BodyInit,
  });

  return {
    uploadResponse: res,
    uploadMode: 'single',
  } as const;
}

async function waitForTerminalTranscription(
  requestOptions: { baseUrl: string; fetchImpl: typeof fetch },
  recordingId: string,
  token: string,
  workspaceId: string,
  authHeaders: (token: string, workspaceId: string) => Record<string, string>,
  sleepMs: (ms: number) => Promise<void>,
  maxPollAttempts: number,
  pollIntervalMs: number
) {
  let lastTranscriptionStatus: JsonObject = {};

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}/transcribe`, {
      headers: authHeaders(token, workspaceId),
    });
    const body = await readJson(res);
    lastTranscriptionStatus = body;
    if (isTerminalTranscriptionStatus(body)) {
      return { done: true, status: res.status, response: body };
    }
    await sleepMs(pollIntervalMs);
  }

  return { done: false, status: 408, response: lastTranscriptionStatus };
}

export async function runAudioProdSmoke(input: AudioProdSmokeOptions) {
  const fetchImpl = input.fetchImpl || fetch;
  const sleepMs =
    input.sleepMs || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxPollAttempts = input.maxPollAttempts ?? 30;
  const pollIntervalMs = input.pollIntervalMs ?? 2000;
  const baseUrl = input.baseUrl.replace(/\/$/, '');
  const workspaceId = input.workspaceId;
  const now = input.now || Date.now;

  const requestOptions = { baseUrl, fetchImpl };
  const report: {
    baseUrl: string;
    startedAt: string;
    finishedAt?: string;
    recordingId?: string;
    smokeData: {
      prefix: string;
      cleanupRequested: boolean;
      identifiable: boolean;
      recordingIds: string[];
      uploadModes: AudioUploadMode[];
    };
    steps: SmokeStep[];
  } = {
    baseUrl,
    startedAt: new Date(now()).toISOString(),
    smokeData: {
      prefix: SMOKE_RECORDING_PREFIX,
      cleanupRequested: Boolean(input.cleanup),
      identifiable: true,
      recordingIds: [],
      uploadModes: input.uploadModes || ['single', 'chunked'],
    },
    steps: [],
  };

  let token = input.token || '';
  const baseRecordingId = `${SMOKE_RECORDING_PREFIX}${now()}`;
  const uploadModes: AudioUploadMode[] = input.uploadModes?.length
    ? input.uploadModes
    : ['single', 'chunked'];
  const uploaders = {
    chunked: uploadRecordingChunked,
    single: uploadRecordingSingle,
  };
  const expectedGitSha = input.expectedGitSha || '';

  report.steps.push(
    await step('/health/live', async () => {
      const res = await smokeRequest(requestOptions, '/health/live');
      const body = await readJson(res);
      return {
        ok: res.ok,
        status: res.status,
        requestId: headerValue(res.headers, 'x-request-id'),
        details: sanitizeDetails(body),
      };
    })
  );

  report.steps.push(
    await step('/health and backend git SHA', async () => {
      const res = await smokeRequest(requestOptions, '/health');
      const body = await readJson(res);
      const healthShaCheck = compareExpectedGitSha(body, expectedGitSha);
      return {
        ok: res.ok && healthShaCheck.ok,
        status: res.status,
        requestId: headerValue(res.headers, 'x-request-id'),
        details: {
          ...sanitizeDetails(body),
          expectedGitSha: expectedGitSha || undefined,
          actualGitSha: body?.gitSha || undefined,
          gitShaMismatch: healthShaCheck.ok ? undefined : healthShaCheck.message,
        },
      };
    })
  );

  report.steps.push(
    await step('supabaseRemote true', async () => {
      const res = await smokeRequest(requestOptions, '/health');
      const body = await readJson(res);
      const storage = asObject(body.supabaseStorage);
      const supabaseRemote =
        body.supabaseRemote === true ||
        asObject(body.storage).supabaseRemote === true ||
        asObject(body.checks).supabaseRemote === true;
      return {
        ok: supabaseRemote && storage.ready !== false,
        status: res.status,
        requestId: headerValue(res.headers, 'x-request-id'),
        details: {
          supabaseRemote,
          supabaseStorageReady: storage.ready,
          supabaseStorageStatus: storage.status,
          bucket: storage.bucket,
          hint:
            supabaseRemote && storage.ready !== false
              ? undefined
              : 'Supabase storage is not production-ready; verify SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET and bucket read/write permissions.',
        },
      };
    })
  );

  report.steps.push(
    await step('/ready', async () => {
      const res = await smokeRequest(requestOptions, '/ready');
      const body = await readJson(res);
      return {
        ok: res.ok,
        status: res.status,
        requestId: headerValue(res.headers, 'x-request-id'),
        details: sanitizeDetails(body),
      };
    })
  );

  if (!token && input.email && input.password) {
    report.steps.push(
      await step('auth login', async () => {
        const res = await smokeRequest(requestOptions, '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: input.email,
            password: input.password,
            workspaceId: workspaceId || undefined,
          }),
        });
        const body = await readJson(res);
        token = String(body.token || '');
        return {
          ok: res.ok && Boolean(token),
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: { authenticated: Boolean(token), userId: body.userId || asObject(body.user).id },
        };
      })
    );
  } else {
    report.steps.push({
      name: 'auth login',
      ok: Boolean(token),
      details: { mode: token ? 'token' : 'missing smoke credentials' },
    });
  }

  if (!token || !workspaceId) {
    report.steps.push({
      name: 'preflight credentials',
      ok: false,
      details: {
        hasToken: Boolean(token),
        hasWorkspaceId: Boolean(workspaceId),
      },
    });
    report.finishedAt = new Date(now()).toISOString();
    await writeReport(input.reportPath, report);
    return report;
  }

  const audioFixture = await loadSmokeAudioFixture();

  for (const mode of uploadModes) {
    let recordingId = `${baseRecordingId}_${mode}`;
    const upload = uploaders[mode];

    report.steps.push(
      await step(`upload short audio fixture (${mode})`, async () => {
        const { uploadResponse } = await upload(
          requestOptions,
          recordingId,
          token,
          workspaceId,
          audioFixture,
          authHeaders
        );
        const body = await readJson(uploadResponse);
        recordingId = String(body.id || body.recordingId || recordingId);
        report.recordingId = recordingId;
        report.smokeData.recordingIds.push(recordingId);
        return {
          ok: uploadResponse.ok,
          status: uploadResponse.status,
          requestId: headerValue(uploadResponse.headers, 'x-request-id'),
          details: sanitizeDetails(body),
        };
      })
    );

    report.steps.push(
      await step(`start transcribe (${mode})`, async () => {
        const res = await smokeRequest(
          requestOptions,
          `/media/recordings/${recordingId}/transcribe`,
          {
            method: 'POST',
            headers: {
              ...authHeaders(token, workspaceId),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ workspaceId }),
          }
        );
        const body = await readJson(res);
        return {
          ok: res.ok,
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: sanitizeDetails(body),
        };
      })
    );

    report.steps.push(
      await step(`poll transcription to terminal status (${mode})`, async () => {
        const result = await waitForTerminalTranscription(
          requestOptions,
          recordingId,
          token,
          workspaceId,
          authHeaders,
          sleepMs,
          maxPollAttempts,
          pollIntervalMs
        );
        return {
          ok: result.done,
          status: result.status,
          details: sanitizeDetails(result.response),
        };
      })
    );

    report.steps.push(
      await step(`reload recording and verify persistence (${mode})`, async () => {
        const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}`, {
          headers: authHeaders(token, workspaceId),
        });
        const body = await readJson(res);
        const bodyId = String(body.id || body.recordingId || '');
        return {
          ok: res.ok && bodyId === recordingId,
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: {
            recordingId: body.id || body.recordingId,
            workspaceId:
              body.workspaceId ||
              body.workspace_id ||
              asObject(body.workspace).id ||
              asObject(body.workspace)?.id,
            requestMode: mode,
          },
        };
      })
    );

    report.steps.push(
      await step(`transcript persisted or empty transcript reported (${mode})`, async () => {
        const res = await smokeRequest(
          requestOptions,
          `/media/recordings/${recordingId}/transcribe`,
          {
            headers: authHeaders(token, workspaceId),
          }
        );
        const body = await readJson(res);
        const classification = classifyTranscriptFinalState(body);
        return {
          ok: res.ok && classification.ok,
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: {
            ...sanitizeDetails(body),
            transcriptState: classification.state,
            transcriptNote: classification.note,
            emptyReason: classification.emptyReason,
            segmentCount: classification.segmentCount,
          },
        };
      })
    );

    report.steps.push(
      await step(`audio download works (${mode})`, async () => {
        const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}/audio`, {
          headers: authHeaders(token, workspaceId),
        });
        const contentLength = Number(res.headers.get('content-length') || 0);
        const body = contentLength > 0 ? null : await res.arrayBuffer().catch(() => null);
        return {
          ok: res.ok && (contentLength > 0 || Boolean(body && body.byteLength > 0)),
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: { contentLength: contentLength || body?.byteLength || 0 },
        };
      })
    );

    report.steps.push(
      await step(`retry-transcribe path responds (${mode})`, async () => {
        const res = await smokeRequest(
          requestOptions,
          `/media/recordings/${recordingId}/retry-transcribe`,
          {
            method: 'POST',
            headers: {
              ...authHeaders(token, workspaceId),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ workspaceId }),
          }
        );
        const body = await readJson(res);
        return {
          ok: [200, 202, 409].includes(res.status),
          status: res.status,
          requestId: headerValue(res.headers, 'x-request-id'),
          details: sanitizeDetails(body),
        };
      })
    );

    if (input.cleanup) {
      report.steps.push(
        await step(`cleanup smoke recording (${mode})`, async () => {
          const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}`, {
            method: 'DELETE',
            headers: authHeaders(token, workspaceId),
          });
          return {
            ok: res.status === 204 || res.status === 404 || res.ok,
            status: res.status,
            requestId: headerValue(res.headers, 'x-request-id'),
            details: sanitizeDetails(await readJson(res)),
          };
        })
      );

      report.steps.push(
        await step(`verify recording deletion (${mode})`, async () => {
          const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}`, {
            headers: authHeaders(token, workspaceId),
          });
          const body = await readJson(res);
          return {
            ok: res.status === 404,
            status: res.status,
            requestId: headerValue(res.headers, 'x-request-id'),
            details: sanitizeDetails(body),
          };
        })
      );

      report.steps.push(
        await step(`verify audio object deletion (${mode})`, async () => {
          const res = await smokeRequest(requestOptions, `/media/recordings/${recordingId}/audio`, {
            headers: authHeaders(token, workspaceId),
          });
          const body = await readJson(res);
          return {
            ok: res.status === 404,
            status: res.status,
            requestId: headerValue(res.headers, 'x-request-id'),
            details: sanitizeDetails(body),
          };
        })
      );
    } else {
      report.steps.push({
        name: `smoke data marked as test data (${mode})`,
        ok: recordingId.startsWith(SMOKE_RECORDING_PREFIX),
        details: {
          recordingId,
          prefix: SMOKE_RECORDING_PREFIX,
          cleanupRequested: false,
        },
      });
    }
  }

  report.finishedAt = new Date(now()).toISOString();
  await writeReport(input.reportPath, report);
  return report;
}

async function writeReport(reportPath: string, report: unknown) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
}

export async function runAudioProdSmokeCli(options = optionsFromEnv()) {
  const report = await runAudioProdSmoke(options);
  return {
    ok: report.steps.every((item) => item.ok),
    reportPath: options.reportPath,
  };
}

function isCliEntrypoint() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  runAudioProdSmokeCli()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
