import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = path.resolve('.');

function read(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

type OrchestrationConfig = {
  required_labels?: string[];
  blocking_labels?: string[];
  area_labels?: Record<string, string[]>;
  gate_commands?: Record<string, string>;
};

describe('AudioRecorder GitHub issue orchestration contract', () => {
  it('keeps the required orchestration files present', () => {
    for (const relativePath of [
      '.github/ISSUE_TEMPLATE/agent_task.yml',
      '.github/PULL_REQUEST_TEMPLATE.md',
      '.codex/orchestration.json',
      'AGENTS.md',
    ]) {
      expect(existsSync(path.join(rootDir, relativePath)), relativePath).toBe(true);
    }
  });

  it('keeps label contract, blocking labels, and gate commands explicit', () => {
    const config = readJson<OrchestrationConfig>('.codex/orchestration.json');
    const serialized = JSON.stringify(config);

    expect(serialized).not.toContain('PROJECT_');
    expect(config.required_labels).toEqual(['agent:ready', 'autopilot:allowed']);
    expect(config.blocking_labels).toEqual(
      expect.arrayContaining([
        'agent:blocked',
        'autopilot:requires-human',
        'needs-product-decision',
      ])
    );

    const areaLabels = config.area_labels || {};
    const gateCommands = config.gate_commands || {};
    for (const [areaLabel, gateLabels] of Object.entries(areaLabels)) {
      expect(areaLabel, 'area labels must use the area:* namespace').toMatch(/^area:/);
      expect(gateLabels.length, `${areaLabel} must map to at least one gate`).toBeGreaterThan(0);
      for (const gateLabel of gateLabels) {
        expect(gateCommands[gateLabel], `${gateLabel} must map to a concrete command`).toMatch(
          /^pnpm run /
        );
      }
    }

    expect(gateCommands['gate:quick']).toBe('pnpm run test');
    expect(gateCommands['gate:quality-critical']).toBe('pnpm run test:release:guard');
    expect(gateCommands['gate:browser']).toBe('pnpm run test:e2e');
    expect(gateCommands['gate:release']).toBe('pnpm run test:release:guard');
  });

  it('keeps the agent issue template and AGENTS guidance aligned', () => {
    const issueTemplate = read('.github/ISSUE_TEMPLATE/agent_task.yml');
    const agents = read('AGENTS.md');

    expect(issueTemplate).toContain('agent:ready');
    expect(issueTemplate).toContain('autopilot:allowed');
    expect(issueTemplate).toContain('Cel / Goal');
    expect(issueTemplate).toContain('Kryteria akceptacji / Acceptance Criteria');
    expect(issueTemplate).toContain('Walidacja / Validation');

    expect(agents).toContain('## GitHub Issue Orchestration');
    expect(agents).toContain('GitHub Issues are task truth');
    expect(agents).toContain('autopilot:requires-human');
    expect(agents).toContain('needs-product-decision');
  });

  it('runs this drift test through the quick gate', () => {
    const packageJson = readJson<{ scripts?: Record<string, string> }>('package.json');

    expect(packageJson.scripts?.test).toContain(
      'vitest run -c vitest.scripts.config.ts scripts/orchestration-contract.test.ts'
    );
  });
});
