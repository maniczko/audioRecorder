import { describe, expect, it, vi } from 'vitest';

import {
  productionGateCommands,
  productionGateRequiredEnv,
  runProductionGate,
  validateProductionGateEnv,
} from './release-prod-gate-strict.mjs';

function createStrictEnv(overrides: Record<string, string> = {}) {
  return {
    ...productionGateRequiredEnv.reduce(
      (acc, key) => ({
        ...acc,
        [key]: `value-for-${key}`,
      }),
      {}
    ),
    ...overrides,
  };
}

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

    const env = createStrictEnv({
      PRODUCTION_FRONTEND_URL: 'https://frontend.internal',
      PRODUCTION_API_BASE_URL: 'https://api.internal',
    });

    const code = await runProductionGate({ run, env });

    expect(code).toBe(0);
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

    const code = await runProductionGate({
      run,
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
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs the production smoke command and workspace verification after e2e checks', () => {
    const run = vi.fn(async () => 0);

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
      env: createStrictEnv({
        PRODUCTION_FRONTEND_URL: 'https://frontend.internal',
        PRODUCTION_API_BASE_URL: 'https://api.internal',
      }),
    }).then((code) => {
      const summary = run.mock.calls
        .map((entry) => `${entry[0]} ${entry[1].join(' ')}`)
        .join(' | ');
      expect(code).toBe(0);
      expect(summary).toContain('test:e2e:production-actions');
      expect(summary).toContain('test:e2e:production-persistence');
      expect(summary).toContain('release:prod-smoke:strict');
      expect(summary).toContain('release:audio-prod-smoke');
      expect(summary).toContain('sentry:release-health');
    });
  });
});
