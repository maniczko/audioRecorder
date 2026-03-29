import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const railwayTomlPath = path.join(ROOT, 'railway.toml');
const dockerfilePath = path.join(ROOT, 'Dockerfile');

function readRailwayToml() {
  return fs.readFileSync(railwayTomlPath, 'utf8');
}

function readDockerfile() {
  return fs.readFileSync(dockerfilePath, 'utf8');
}

describe('Railway deployment config', () => {
  it('uses DOCKERFILE builder explicitly', () => {
    const content = readRailwayToml();
    expect(content).toMatch(/^\[build\]/m);
    expect(content).toMatch(/builder\s*=\s*"DOCKERFILE"/m);
  });

  it('does not set startCommand (Dockerfile CMD handles startup)', () => {
    const content = readRailwayToml();
    // startCommand would override Dockerfile CMD and use wrong path
    // (dist-server/ in source vs server/ in container)
    expect(content).not.toMatch(/^startCommand\s*=/m);
  });

  it('has healthcheck configured with sufficient timeout', () => {
    const content = readRailwayToml();
    expect(content).toMatch(/^\[deploy\]/m);
    expect(content).toMatch(/healthcheckPath\s*=\s*"\/health"/m);

    const timeoutMatch = content.match(/healthcheckTimeout\s*=\s*(\d+)/);
    expect(timeoutMatch).not.toBeNull();
    const timeout = Number(timeoutMatch![1]);
    expect(timeout).toBeGreaterThanOrEqual(60);
  });

  it('does not use pnpm in any runtime command', () => {
    const content = readRailwayToml();
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(/^(startCommand|postDeploy)\s*=/)) {
        expect(line).not.toContain('pnpm');
      }
    }
  });

  it('does not have non-standard TOML sections that break Railway parser', () => {
    const content = readRailwayToml();
    expect(content).not.toMatch(/^\[deploy\.envs\]/m);
    expect(content).not.toMatch(/^\[volumes\]/m);
  });
});

// ─────────────────────────────────────────────────────────────────
// Issue #0 — Dockerfile CMD path vs railway.toml startCommand mismatch
// Date: 2026-03-29
// Bug: railway.toml had startCommand = "node dist-server/index.js" but
//      Dockerfile copies dist-server/ -> server/ in the container.
//      Railway overrides Dockerfile CMD with startCommand, causing
//      "file not found" and healthcheck failure.
// Fix: Remove startCommand from railway.toml, let Dockerfile CMD handle it.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — Dockerfile CMD consistency', () => {
  it('Dockerfile CMD uses correct path: server/index.js', () => {
    const content = readDockerfile();
    // CMD should match the COPY destination, not the source build dir
    expect(content).toMatch(/CMD\s+\[.*"server\/index\.js".*\]/);
  });

  it('Dockerfile copies dist-server to server/ in runtime stage', () => {
    const content = readDockerfile();
    // The COPY from build stage maps dist-server -> ./server
    expect(content).toMatch(/COPY.*--from=build.*dist-server.*\.\/server/);
  });

  it('Dockerfile ENTRYPOINT uses tini for signal handling', () => {
    const content = readDockerfile();
    expect(content).toMatch(/ENTRYPOINT.*tini/);
  });
});
