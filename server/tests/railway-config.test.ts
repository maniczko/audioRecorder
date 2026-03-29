import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const railwayTomlPath = path.join(ROOT, 'railway.toml');

function readRailwayToml() {
  return fs.readFileSync(railwayTomlPath, 'utf8');
}

describe('Railway deployment config', () => {
  it('contains explicit build and deploy commands', () => {
    const content = readRailwayToml();

    expect(content).toMatch(/^\[build\]/m);
    expect(content).toMatch(/^\[deploy\]/m);
    expect(content).toMatch(/^buildCommand\s*=\s*".+"/m);
    expect(content).toMatch(/^startCommand\s*=\s*".+"/m);
  });

  it('starts runtime with node dist-server/index.js (no pnpm at runtime)', () => {
    const content = readRailwayToml();

    const startMatch = content.match(/^startCommand\s*=\s*"([^"]+)"/m);
    expect(startMatch).not.toBeNull();

    const startCommand = startMatch![1];
    expect(startCommand).toBe('node dist-server/index.js');
    expect(startCommand).not.toContain('pnpm');
  });

  it('does not use pnpm in postDeploy hook when present', () => {
    const content = readRailwayToml();
    const postDeployMatch = content.match(/^postDeploy\s*=\s*"([^"]+)"/m);

    if (!postDeployMatch) {
      expect(content).not.toMatch(/^postDeploy\s*=\s*"\s*pnpm\b/m);
      return;
    }

    expect(postDeployMatch[1]).not.toContain('pnpm');
  });

  it('build command produces backend artifact using esbuild', () => {
    const content = readRailwayToml();
    const buildMatch = content.match(/^buildCommand\s*=\s*"([^"]+)"/m);
    expect(buildMatch).not.toBeNull();

    const buildCommand = buildMatch![1];
    expect(buildCommand).toContain('esbuild');
    expect(buildCommand).toContain('server/index.ts');
    expect(buildCommand).toContain('--outdir=dist-server');
  });
});
