import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const railwayTomlPath = path.join(ROOT, 'railway.toml');
const nixpacksTomlPath = path.join(ROOT, 'nixpacks.toml');

function readRailwayToml() {
  return fs.readFileSync(railwayTomlPath, 'utf8');
}

function readNixpacksToml() {
  return fs.readFileSync(nixpacksTomlPath, 'utf8');
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

  it('does not have non-standard TOML sections that break Railway parser', () => {
    const content = readRailwayToml();
    // [deploy.envs] and [volumes] are not valid Railway TOML sections and
    // can cause Railway to ignore startCommand and fall back to pnpm start
    expect(content).not.toMatch(/^\[deploy\.envs\]/m);
    expect(content).not.toMatch(/^\[volumes\]/m);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — NIXPACKS auto-detects pnpm start instead of node cmd
// Date: 2026-03-29
// Bug: NIXPACKS reads pnpm-lock.yaml and generates `pnpm start` as the
//      runtime CMD, which fails because pnpm is absent in the container.
// Fix: nixpacks.toml [start] cmd overrides auto-detection.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — NIXPACKS pnpm start override', () => {
  it('nixpacks.toml exists and sets explicit start command', () => {
    expect(() => readNixpacksToml()).not.toThrow();
    const content = readNixpacksToml();
    expect(content).toMatch(/^\[start\]/m);
    expect(content).toMatch(/^cmd\s*=\s*"([^"]+)"/m);
  });

  it('nixpacks.toml start cmd uses node, not pnpm', () => {
    const content = readNixpacksToml();
    const cmdMatch = content.match(/^cmd\s*=\s*"([^"]+)"/m);
    expect(cmdMatch).not.toBeNull();
    const cmd = cmdMatch![1];
    expect(cmd).toBe('node dist-server/index.js');
    expect(cmd).not.toContain('pnpm');
  });
});
