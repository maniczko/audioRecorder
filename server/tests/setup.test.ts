import fs from 'node:fs';
import { spawn } from 'node:child_process';

import { describe, expect, it } from 'vitest';

describe('test setup fs mocks', () => {
  it('Regression: preserves real YAML file contents for utf-8 encoded contract reads', () => {
    const content = fs.readFileSync('docs/openapi.yaml', 'utf-8');

    expect(typeof content).toBe('string');
    expect(content).toContain('openapi: "3.0.3"');
  });

  it('Regression: keeps spawn mock stdout available for streaming tests', () => {
    const child = spawn('node', ['fake-script.js']);

    expect(child.stdout).toBeDefined();
    expect(typeof child.stdout?.setEncoding).toBe('function');
  });
});
