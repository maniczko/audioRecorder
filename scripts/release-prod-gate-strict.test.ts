import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  parsePositiveInteger,
  productionGateCommands,
  productionGateRequiredEnv,
  runProductionGate,
  validateProductionGateEnv,
  verifyConsecutiveProductionGateRuns,
} from './release-prod-gate-strict.mjs';

const workflowRunEventPath = path.join(
  tmpdir(),
  `voicelog-release-prod-gate-event-${Date.now()}.json`
);
writeFileSync(
  workflowRunEventPath,
  JSON.stringify({ workflow_run: { id: 'manual-test-workflow-run' } })
);

function createStrictEnv(overrides: Record<string, string> = {}) {
  return {
    ...productionGateRequiredEnv.reduce(
      (acc, key) => ({
        ...acc,
        [key]: `value-for-${key}`,
      }),
      {}
    ),
    GITHUB_TOKEN: 'ghs_1234567890',
    GITHUB_EVENT_NAME: 'workflow_run',
    GITHUB_EVENT_PATH: workflowRunEventPath,
    GITHUB_REF_NAME: 'main',
    GITHUB_REPOSITORY: 'owner/example',
    GITHUB_RUN_ID: '4242',
    GITHUB_WORKFLOW_REF:
      'owner/example/.github/workflows/production-system-audit.yml@refs/heads/main',
    ...overrides,
  };
}

function createMockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('release:prod-gate:strict consecutive run guard', () => {
  it('does not enforce consecutive-success window for workflow dispatch triggers', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('should not query api');
    });

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv({ GITHUB_EVENT_NAME: 'workflow_dispatch' }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).resolves.toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not enforce consecutive-success window for non-main branches', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('should not query api');
    });

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv({ GITHUB_REF_NAME: 'feature/beta' }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).resolves.toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not enforce consecutive-success window when workflow event is missing (safety fallback)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('should not query api');
    });

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv({ GITHUB_EVENT_NAME: '', GITHUB_EVENT_PATH: '' }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).resolves.toBe(true);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts consecutive successful run history', async () => {
    const fetchMock = vi.fn(async () =>
      createMockResponse({
        workflow_runs: [
          { id: '201', conclusion: 'success' },
          { id: '200', conclusion: 'success' },
        ],
      })
    );

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv(),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).resolves.toBe(true);

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain(
      '/repos/owner/example/actions/workflows/production-system-audit.yml/runs'
    );
    expect(calledUrl).toContain('status=completed');
  });

  it('rejects when recent history contains failures', async () => {
    const fetchMock = vi.fn(async () =>
      createMockResponse({
        workflow_runs: [
          { id: '201', conclusion: 'failure' },
          { id: '200', conclusion: 'success' },
        ],
      })
    );

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv(),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow('consecutive successful');
  });

  it('falls back to anonymous workflow run lookup when token is not configured', async () => {
    const fetchMock = vi.fn(async () =>
      createMockResponse({
        workflow_runs: [
          { id: '201', conclusion: 'success' },
          { id: '200', conclusion: 'success' },
        ],
      })
    );

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv({
          GITHUB_TOKEN: '',
          GH_TOKEN: '',
          GH_PAT: '',
        }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).resolves.toBe(true);
  });

  it('throws explicit token guidance when anonymous lookup is rejected (private workflow history)', async () => {
    const fetchMock = vi.fn(async () => createMockResponse({ message: 'Not Found' }, 404));

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv({
          GITHUB_TOKEN: '',
          GH_TOKEN: '',
          GH_PAT: '',
        }),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow('release:prod-gate:strict missing required env: GITHUB_TOKEN');
  });

  it('rejects when consecutive history is too short', async () => {
    const fetchMock = vi.fn(async () =>
      createMockResponse({
        workflow_runs: [{ id: '201', conclusion: 'success' }],
      })
    );

    await expect(
      verifyConsecutiveProductionGateRuns({
        env: createStrictEnv(),
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    ).rejects.toThrow('only found 1 completed run');
  });

  it('validates parsePositiveInteger defaults', () => {
    expect(parsePositiveInteger('3', 5)).toBe(3);
    expect(parsePositiveInteger('0', 5)).toBe(5);
    expect(parsePositiveInteger('', 7)).toBe(7);
  });
});

describe('release:prod-gate:strict', () => {
  it('validates required environment variables', () => {
    expect(() =>
      validateProductionGateEnv({
        ...createStrictEnv(),
        PRODUCTION_FRONTEND_URL: 'https://frontend.test',
      })
    ).not.toThrow();

    expect(() =>
      validateProductionGateEnv({
        ...createStrictEnv(),
        PRODUCTION_FRONTEND_URL: '',
      })
    ).toThrow(/missing required env/);
  });

  it('wires gate env into Playwright aliases and runs commands in required order', async () => {
    const seen: string[] = [];
    const run = vi.fn(
      async (command: string, args: string[], options: { env?: Record<string, string> }) => {
        seen.push(`${command} ${args.join(' ')}`);

        if (options?.env) {
          expect(options.env.PLAYWRIGHT_BASE_URL).toBe('https://frontend.internal');
          expect(options.env.PLAYWRIGHT_API_BASE_URL).toBe('https://api.internal');
          expect(options.env.PRODUCTION_SYSTEM_AUDIT_REQUIRED).toBe('true');
        }

        return 0;
      }
    );

    const verifyConsecutiveRuns = vi.fn(async () => true);
    const env = createStrictEnv({
      PRODUCTION_FRONTEND_URL: 'https://frontend.internal',
      PRODUCTION_API_BASE_URL: 'https://api.internal',
    });

    const code = await runProductionGate({ run, env, verifyConsecutiveRuns });

    expect(code).toBe(0);
    expect(verifyConsecutiveRuns).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(productionGateCommands.length);
    expect(seen).toEqual(
      productionGateCommands.map(([command, args]) => `${command} ${args.join(' ')}`)
    );
  });

  it('stops on the first failing command and returns non-zero', async () => {
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === 'pnpm' && args[1] === 'test:e2e:production-persistence') {
        return 3;
      }

      return 0;
    });

    const verifyConsecutiveRuns = vi.fn(async () => true);
    const code = await runProductionGate({
      run,
      verifyConsecutiveRuns,
      commands: [
        ['pnpm', ['run', 'test:e2e:production-actions']],
        ['pnpm', ['run', 'test:e2e:production-persistence']],
        ['pnpm', ['run', 'release:prod-smoke:strict']],
      ],
      env: createStrictEnv({
        PRODUCTION_FRONTEND_URL: 'https://frontend.internal',
        PRODUCTION_API_BASE_URL: 'https://api.internal',
      }),
    });

    expect(code).toBe(3);
    expect(verifyConsecutiveRuns).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs the production smoke command and workspace verification after e2e checks', () => {
    const run = vi.fn(async () => 0);
    const verifyConsecutiveRuns = vi.fn(async () => true);

    const hasSmokeCommands = productionGateCommands.some(
      ([command, args]) =>
        command === 'pnpm' && args[0] === 'run' && args[1] === 'release:audio-prod-smoke'
    );
    const hasVerifyCommand = productionGateCommands.some(
      ([command, args]) =>
        command === 'pnpm' && args[0] === 'run' && args[1] === 'verify:supabase:workspace'
    );

    expect(hasSmokeCommands).toBe(true);
    expect(hasVerifyCommand).toBe(true);

    return runProductionGate({
      run,
      verifyConsecutiveRuns,
      env: createStrictEnv({
        PRODUCTION_FRONTEND_URL: 'https://frontend.internal',
        PRODUCTION_API_BASE_URL: 'https://api.internal',
      }),
    }).then((code) => {
      const summary = run.mock.calls
        .map((entry) => `${entry[0]} ${entry[1].join(' ')}`)
        .join(' | ');
      expect(code).toBe(0);
      expect(verifyConsecutiveRuns).toHaveBeenCalledTimes(1);
      expect(summary).toContain('test:e2e:production-actions');
      expect(summary).toContain('test:e2e:production-persistence');
      expect(summary).toContain('release:prod-smoke:strict');
      expect(summary).toContain('release:audio-prod-smoke');
      expect(summary).toContain('sentry:release-health');
    });
  });
});
