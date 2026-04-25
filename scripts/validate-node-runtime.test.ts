import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();

function readTrimmed(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8').trim();
}

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as {
    engines?: { node?: string };
  };
}

describe('Node runtime pinning', () => {
  it('keeps package.json pinned to the Node 22 major line', () => {
    expect(readPackageJson().engines?.node).toBe('22.x');
  });

  it('provides an nvm-compatible Node version file', () => {
    expect(existsSync(path.join(rootDir, '.nvmrc'))).toBe(true);
    expect(readTrimmed('.nvmrc')).toBe('22');
  });

  it('provides an asdf/fnm-compatible Node version file', () => {
    expect(existsSync(path.join(rootDir, '.node-version'))).toBe(true);
    expect(readTrimmed('.node-version')).toBe('22');
  });

  it('documents the runtime pin in the quick start', () => {
    const readme = readFileSync(path.join(rootDir, 'README.md'), 'utf8');

    expect(readme).toContain('Node.js 22.x');
    expect(readme).toContain('nvm use');
    expect(readme).toContain('fnm use');
  });

  it('keeps Windows setup guidance aligned with the pinned runtime', () => {
    const guide = readFileSync(path.join(rootDir, 'INSTALL_NODEJS_22.md'), 'utf8');

    expect(guide).toContain('Node.js 22.x');
    expect(guide).toContain('.nvmrc');
    expect(guide).toContain('.node-version');
  });
});
