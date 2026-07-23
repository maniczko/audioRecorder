import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadSmokeAudioFixture,
  optionsFromEnv,
  runAudioProdSmoke,
  runAudioProdSmokeCli,
} from '../server/scripts/audio-prod-smoke.ts';

function jsonResponse(body: unknown, status = 200, requestId = 'req-test') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });
}

function binaryResponse(body: Uint8Array, status = 200, requestId = 'req-audio') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(body.byteLength),
      'X-Request-Id': requestId,
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('audio production smoke', () => {
  it('runs the audio release smoke with sanitized JSON report and current media route contract', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const pathName = new URL(url).pathname;

      if (pathName === '/health/live') {
        return jsonResponse({
          ok: true,
          check: 'liveness',
          gitSha: 'abc123',
        });
      }

      if (pathName === '/health') {
        return jsonResponse({
          ok: true,
          gitSha: 'abc123',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/ready') {
        return jsonResponse({
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio' && init?.method === 'PUT') {
        expect(init.headers).toMatchObject({
          Authorization: 'Bearer smoke-token',
          'Content-Type': 'audio/wav',
          'X-Workspace-Id': 'workspace_1',
        });
        const body = init.body as Buffer;
        expect(Buffer.isBuffer(body)).toBe(true);
        expect(body.toString('ascii', 0, 4)).toBe('RIFF');
        return jsonResponse({ id: 'smoke_1780000000000', recordingId: 'smoke_1780000000000' }, 201);
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000/transcribe' &&
        init?.method === 'POST'
      ) {
        return jsonResponse({ recordingId: 'smoke_1780000000000', pipelineStatus: 'queued' }, 202);
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000/transcribe' &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse({
          recordingId: 'smoke_1780000000000',
          pipelineStatus: 'done',
          transcriptOutcome: 'normal',
          segments: [{ text: 'Sensitive transcript text should not be reported.' }],
          transcriptionDiagnostics: {
            chunksAttempted: 1,
            chunksWithText: 1,
            provider: 'openai',
            model: 'gpt-4o-transcribe',
          },
        });
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000' &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse({
          id: 'smoke_1780000000000',
          workspaceId: 'workspace_1',
          durationMs: 500,
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio' && init?.method !== 'PUT') {
        return binaryResponse(new Uint8Array([1, 2, 3, 4]));
      }

      if (pathName === '/media/recordings/smoke_1780000000000/retry-transcribe') {
        return jsonResponse(
          {
            recordingId: 'smoke_1780000000000',
            pipelineStatus: 'done',
            transcriptOutcome: 'normal',
          },
          409
        );
      }

      if (pathName === '/media/recordings/smoke_1780000000000' && init?.method === 'DELETE') {
        return jsonResponse({ deleted: true });
      }

      throw new Error(`Unexpected smoke request: ${init?.method || 'GET'} ${pathName}`);
    });

    const report = await runAudioProdSmoke({
      baseUrl: 'https://api.example.com',
      token: 'smoke-token',
      workspaceId: 'workspace_1',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
      sleepMs: async () => {},
      maxPollAttempts: 1,
      cleanup: true,
    });

    expect(report.steps.every((step) => step.ok)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/media/recordings/smoke_1780000000000/transcribe',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer smoke-token',
          'X-Workspace-Id': 'workspace_1',
        }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/transcribe-status'),
      expect.anything()
    );

    const persisted = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    const reportText = JSON.stringify(persisted);
    expect(reportText).toContain('requestId');
    expect(reportText).toContain('segmentCount');
    expect(reportText).not.toContain('Sensitive transcript text');
    expect(persisted.steps.map((step: any) => step.name)).toContain(
      'transcript persisted or empty transcript reported'
    );
    expect(persisted.steps.map((step: any) => step.name)).toContain('audio download works');
    expect(persisted.steps.map((step: any) => step.name)).toContain(
      'reload recording and verify persistence'
    );
    expect(persisted.steps.map((step: any) => step.name)).toContain('cleanup smoke recording');
    expect(persisted.smokeData).toMatchObject({
      prefix: 'smoke_',
      cleanupRequested: true,
      identifiable: true,
    });
    expect(
      persisted.steps.find(
        (step: any) => step.name === 'transcript persisted or empty transcript reported'
      )
    ).toMatchObject({
      ok: true,
      details: {
        transcriptState: 'completed',
        transcriptNote: 'transcript persisted',
        segmentCount: 1,
      },
    });
    expect(
      persisted.steps.find((step: any) => step.name === 'reload recording and verify persistence')
    ).toMatchObject({
      ok: true,
      details: {
        recordingId: 'smoke_1780000000000',
        workspaceId: 'workspace_1',
      },
    });
  });

  it('loads the deterministic seeded short WAV fixture', async () => {
    const fixture = await loadSmokeAudioFixture();

    expect(fixture.toString('ascii', 0, 4)).toBe('RIFF');
    expect(fixture.toString('ascii', 8, 12)).toBe('WAVE');
    expect(fixture.byteLength).toBeGreaterThan(44);
  });

  it('marks smoke recordings as identifiable test data when cleanup is disabled', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-test-data-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const pathName = new URL(url).pathname;

      if (pathName === '/health/live') {
        return jsonResponse({
          ok: true,
          check: 'liveness',
          gitSha: 'abc123',
        });
      }

      if (pathName === '/health') {
        return jsonResponse({
          ok: true,
          gitSha: 'abc123',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/ready') {
        return jsonResponse({
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio' && init?.method === 'PUT') {
        return jsonResponse({ recordingId: 'smoke_1780000000000' }, 201);
      }

      if (pathName === '/media/recordings/smoke_1780000000000/transcribe') {
        return jsonResponse({
          recordingId: 'smoke_1780000000000',
          pipelineStatus: init?.method === 'POST' ? 'queued' : 'done',
          transcriptOutcome: 'empty',
          emptyReason: 'fixture silence',
          segments: [],
        });
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000' &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse({
          id: 'smoke_1780000000000',
          workspaceId: 'workspace_1',
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio') {
        return binaryResponse(new Uint8Array([1, 2, 3, 4]));
      }

      if (pathName === '/media/recordings/smoke_1780000000000/retry-transcribe') {
        return jsonResponse({ recordingId: 'smoke_1780000000000', pipelineStatus: 'done' }, 409);
      }

      throw new Error(`Unexpected smoke request: ${init?.method || 'GET'} ${pathName}`);
    });

    const report = await runAudioProdSmoke({
      baseUrl: 'https://api.example.com',
      token: 'smoke-token',
      workspaceId: 'workspace_1',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
      sleepMs: async () => {},
      maxPollAttempts: 1,
    });

    expect(report.steps).toContainEqual(
      expect.objectContaining({
        name: 'smoke data marked as test data',
        ok: true,
      })
    );
    expect(
      report.steps.find(
        (step: any) => step.name === 'transcript persisted or empty transcript reported'
      )
    ).toMatchObject({
      ok: true,
      details: {
        transcriptState: 'empty',
        transcriptNote: 'transcript intentionally empty',
      },
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://api.example.com/media/recordings/smoke_1780000000000',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('reads cleanup and staging smoke credentials from environment', () => {
    const options = optionsFromEnv({
      PRODUCTION_SMOKE_BASE_URL: 'https://staging.example.com/',
      PRODUCTION_SMOKE_AUTH_TOKEN: 'secret-token',
      PRODUCTION_SMOKE_WORKSPACE_ID: 'workspace_smoke',
      PRODUCTION_EXPECTED_GIT_SHA: 'abc123',
      PRODUCTION_SMOKE_CLEANUP: 'true',
      PRODUCTION_SMOKE_REPORT: 'reports/custom.json',
    } as any);

    expect(options).toMatchObject({
      baseUrl: 'https://staging.example.com',
      token: 'secret-token',
      expectedGitSha: 'abc123',
      workspaceId: 'workspace_smoke',
      cleanup: true,
      reportPath: 'reports/custom.json',
    });
  });

  it('treats failed transcript outcome as hard-failure while keeping transcript data sanitized', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-failed-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const pathName = new URL(url).pathname;

      if (pathName === '/health/live') {
        return jsonResponse({
          ok: true,
          check: 'liveness',
          gitSha: 'abc123',
        });
      }

      if (pathName === '/health') {
        return jsonResponse({
          ok: true,
          gitSha: 'abc123',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/ready') {
        return jsonResponse({
          ok: true,
          status: 'ok',
          supabaseRemote: true,
          supabaseStorage: { ready: true, status: 'ready', bucket: 'recordings' },
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio' && init?.method === 'PUT') {
        return jsonResponse({ id: 'smoke_1780000000000' }, 201);
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000/transcribe' &&
        init?.method === 'POST'
      ) {
        return jsonResponse({ recordingId: 'smoke_1780000000000', pipelineStatus: 'queued' }, 202);
      }

      if (pathName === '/media/recordings/smoke_1780000000000/transcribe') {
        return jsonResponse({
          recordingId: 'smoke_1780000000000',
          pipelineStatus: 'failed',
          transcriptOutcome: 'failed',
          errorCode: 'timeout',
          segments: [{ text: 'do-not-leak-this-transcript' }],
        });
      }

      if (
        pathName === '/media/recordings/smoke_1780000000000' &&
        (!init?.method || init.method === 'GET')
      ) {
        return jsonResponse({
          id: 'smoke_1780000000000',
          workspaceId: 'workspace_1',
        });
      }

      if (pathName === '/media/recordings/smoke_1780000000000/audio' && init?.method !== 'PUT') {
        return binaryResponse(new Uint8Array([1, 2, 3, 4]));
      }

      if (pathName === '/media/recordings/smoke_1780000000000/retry-transcribe') {
        return jsonResponse({ recordingId: 'smoke_1780000000000', pipelineStatus: 'failed' }, 200);
      }

      if (pathName === '/media/recordings/smoke_1780000000000' && init?.method === 'DELETE') {
        return jsonResponse({ deleted: true });
      }

      throw new Error(`Unexpected smoke request: ${init?.method || 'GET'} ${pathName}`);
    });

    const report = await runAudioProdSmoke({
      baseUrl: 'https://api.example.com',
      token: 'smoke-token',
      workspaceId: 'workspace_1',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
      sleepMs: async () => {},
      maxPollAttempts: 1,
      cleanup: true,
    });

    const persisted = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    expect(
      report.steps.find(
        (step: any) => step.name === 'transcript persisted or empty transcript reported'
      )
    ).toMatchObject({
      ok: false,
      details: { transcriptState: 'failed', transcriptOutcome: 'failed' },
    });
    expect(report.steps.every((step) => step.ok)).toBe(false);
    expect(JSON.stringify(persisted)).not.toContain('do-not-leak-this-transcript');
  });

  it('stops before upload when auth or workspace evidence is missing', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-missing-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        supabaseRemote: true,
        supabaseStorage: { ready: true, status: 'ready' },
      })
    );

    const report = await runAudioProdSmoke({
      baseUrl: 'https://api.example.com',
      token: '',
      workspaceId: '',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
    });

    expect(report.steps.some((step) => step.name === 'preflight credentials' && !step.ok)).toBe(
      true
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('Regression: CLI result reports the same JSON path that was written', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-cli-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async () => {
      throw new Error('backend unavailable');
    });

    const result = await runAudioProdSmokeCli({
      baseUrl: 'http://localhost:4001',
      token: '',
      workspaceId: '',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
    });

    expect(result).toEqual({ ok: false, reportPath });
    await expect(fs.stat(reportPath)).resolves.toMatchObject({ isFile: expect.any(Function) });
  });

  it('Regression: transport failures include actionable backend diagnostics', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-transport-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    const report = await runAudioProdSmoke({
      baseUrl: 'http://localhost:4001',
      token: '',
      workspaceId: '',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
    });

    const healthStep = report.steps.find((step) => step.name === '/health and backend git SHA');
    expect(healthStep).toMatchObject({
      ok: false,
      error: 'fetch failed',
      details: {
        kind: 'transport',
        baseUrl: 'http://localhost:4001',
        path: '/health',
        url: 'http://localhost:4001/health',
      },
    });
    expect(JSON.stringify(healthStep?.details)).toContain('backend');
  });

  it('Regression: Supabase storage failures include actionable diagnostics', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-prod-smoke-supabase-'));
    const reportPath = path.join(tempDir, 'report.json');
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        supabaseRemote: false,
        supabaseStorage: {
          ready: false,
          status: 'fetch failed',
          bucket: 'recordings',
        },
      })
    );

    const report = await runAudioProdSmoke({
      baseUrl: 'http://localhost:4001',
      token: '',
      workspaceId: '',
      reportPath,
      fetchImpl: fetchMock as any,
      now: () => 1780000000000,
    });

    const supabaseStep = report.steps.find((step) => step.name === 'supabaseRemote true');
    expect(supabaseStep).toMatchObject({
      ok: false,
      details: {
        supabaseRemote: false,
        supabaseStorageReady: false,
        supabaseStorageStatus: 'fetch failed',
        bucket: 'recordings',
      },
    });
    expect(JSON.stringify(supabaseStep?.details)).toContain('Supabase');
    expect(JSON.stringify(supabaseStep?.details)).toContain('SUPABASE');
  });
});
