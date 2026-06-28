import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import packageJson from '../package.json';

type OrchestrationConfig = {
  provider?: string;
  task_truth?: string;
  branch_prefix?: string;
  required_labels?: string[];
  blocking_labels?: string[];
  area_labels?: Record<string, string[]>;
  gate_commands?: Record<string, string>;
};

const repoRoot = process.cwd();
const issueTemplatePath = path.join(repoRoot, '.github/ISSUE_TEMPLATE/agent_task.yml');
const orchestrationPath = path.join(repoRoot, '.codex/orchestration.json');
const agentsPath = path.join(repoRoot, 'AGENTS.md');

function readOrchestrationConfig(): OrchestrationConfig {
  return JSON.parse(readFileSync(orchestrationPath, 'utf8')) as OrchestrationConfig;
}

describe('Codex GitHub issue orchestration contract', () => {
  it('keeps the agent issue template available with required contract sections', () => {
    expect(existsSync(issueTemplatePath)).toBe(true);

    const template = parse(readFileSync(issueTemplatePath, 'utf8')) as {
      labels?: string[];
      body?: Array<{
        id?: string;
        attributes?: { label?: string };
        validations?: { required?: boolean };
      }>;
    };
    const labels = template.labels ?? [];
    const fields = new Map(
      (template.body ?? []).filter((entry) => entry.id).map((entry) => [entry.id, entry])
    );

    expect(labels).toContain('agent:ready');
    for (const fieldId of [
      'goal',
      'context',
      'scope',
      'acceptance',
      'validation',
      'final-report',
    ]) {
      expect(fields.get(fieldId)?.validations?.required, fieldId).toBe(true);
    }
  });

  it('defines required, blocking, area, and gate labels without placeholders', () => {
    expect(existsSync(orchestrationPath)).toBe(true);

    const config = readOrchestrationConfig();
    const requiredLabels = config.required_labels ?? [];
    const blockingLabels = config.blocking_labels ?? [];
    const areaLabels = config.area_labels ?? {};
    const gateCommands = config.gate_commands ?? {};
    const serialized = JSON.stringify(config);

    expect(config.provider).toBe('github_issues');
    expect(config.task_truth).toBe('github_issue_state_labels_comments');
    expect(requiredLabels).toEqual(expect.arrayContaining(['agent:ready', 'autopilot:allowed']));
    expect(blockingLabels).toEqual(
      expect.arrayContaining([
        'agent:blocked',
        'autopilot:requires-human',
        'needs-product-decision',
      ])
    );
    expect(Object.keys(areaLabels).length).toBeGreaterThan(0);
    for (const [area, gates] of Object.entries(areaLabels)) {
      expect(area.startsWith('area:'), area).toBe(true);
      expect(gates.length, area).toBeGreaterThan(0);
      for (const gate of gates) {
        expect(gateCommands[gate], gate).toBeTruthy();
      }
    }
    for (const command of Object.values(gateCommands)) {
      expect(command).not.toMatch(/PROJECT_/);
      expect(command.trim().length).toBeGreaterThan(0);
    }
    expect(serialized).not.toContain('PROJECT_');
  });

  it('maps ready governance issues to the quick gate command', () => {
    const config = readOrchestrationConfig();

    expect(config.area_labels?.['area:governance']).toContain('gate:quick');
    expect(config.gate_commands?.['gate:quick']).toBe('pnpm run test');
  });

  it('documents the issue execution policy in AGENTS.md', () => {
    const agents = readFileSync(agentsPath, 'utf8');

    expect(agents).toContain('GitHub Issue Orchestration');
    expect(agents).toContain('agent:ready');
    expect(agents).toContain('autopilot:allowed');
    expect(agents).toContain('needs-product-decision');
  });

  it('runs this drift test in the quick gate', () => {
    expect(packageJson.scripts.test).toContain('scripts/validate-codex-orchestration.test.ts');
  });
});
