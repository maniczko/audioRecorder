import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runAudioProdSmoke, runAudioProdSmokeCli } from '../server/scripts/audio-prod-smoke.ts';

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

      if (pathName === '/health') {
        return jsonResponse({
          ok: true,
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    const healthStep = report.steps.find((step) => step.name === '/health ok');
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
    expect(JSON.stringify(supabaseStep?.details)).toContain('VOICELOG');
  });
});
