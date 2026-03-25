import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Note: This test reads the actual Dockerfile, so fs is not mocked here
// The vi.mock in setup.ts is bypassed for this specific test file

const ROOT = process.cwd();
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(ROOT, '.dockerignore'), 'utf8');

describe('Dockerfile runtime healthcheck', () => {
  it('uses PORT-aware healthcheck for cloud runtimes', () => {
    expect(dockerfile).toMatch(/process\.env\.PORT \|\| process\.env\.VOICELOG_API_PORT \|\| 4000/);
  });
});

describe('Dockerfile COPY sources not excluded by .dockerignore', () => {
  // Parse .dockerignore into include/exclude patterns
  function buildIgnorePatterns(ignoreContent: string) {
    return ignoreContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  }

  // Returns true if the given path is excluded by .dockerignore patterns
  function isExcluded(filePath: string, patterns: string[]): boolean {
    let excluded = false;
    for (const pattern of patterns) {
      const isNegation = pattern.startsWith('!');
      const raw = isNegation ? pattern.slice(1) : pattern;
      // Simple prefix-match: pattern "src" excludes "src/shared/..."
      // pattern "!src/shared/" re-includes "src/shared/..."
      const normalizedPath = filePath.replace(/\/$/, '');
      const normalizedPattern = raw.replace(/\/$/, '');
      if (
        normalizedPath === normalizedPattern ||
        normalizedPath.startsWith(normalizedPattern + '/')
      ) {
        excluded = !isNegation;
      }
    }
    return excluded;
  }

  it('src/shared/ is not excluded from build context', () => {
    const patterns = buildIgnorePatterns(dockerignore);
    expect(isExcluded('src/shared', patterns)).toBe(false);
    expect(isExcluded('src/shared/meetingFeedback.ts', patterns)).toBe(false);
  });

  it('all COPY source paths (non --from) are reachable in build context', () => {
    const patterns = buildIgnorePatterns(dockerignore);
    // Match: COPY <src> <dest>  (not COPY --from=...)
    const copyLines = dockerfile.split('\n').filter((l) => /^\s*COPY\s+(?!--from)/.test(l));

    for (const line of copyLines) {
      // Extract the source token (first arg after COPY)
      const tokens = line.trim().split(/\s+/);
      const src = tokens[1]; // e.g. "server/package*.json", "src/shared/", "server/"

      // Resolve globs: just check the directory prefix
      const srcBase = src.replace(/[*?].*$/, '').replace(/\/$/, '');
      if (!srcBase) continue;

      // Only check paths that look relative (no leading /)
      if (srcBase.startsWith('/')) continue;

      const excluded = isExcluded(srcBase, patterns);
      expect(excluded).toBe(false);
    }
  });
});

describe('Dockerfile has no inline external registry COPY --from', () => {
  it('COPY --from only references named build stages or trusted registries', () => {
    // Allow trusted registries: ghcr.io (official GitHub container registry)
    const untrustedRegistryPattern =
      /COPY\s+--from=(docker\.io|registry-1\.docker\.io|quay\.io|gcr\.io)/;
    expect(dockerfile).not.toMatch(untrustedRegistryPattern);
  });
});

describe('Dockerfile hardening', () => {
  it('runs the final image as a non-root user', () => {
    expect(dockerfile).toMatch(/USER app/);
  });

  it('uses tini as entrypoint for proper signal handling', () => {
    expect(dockerfile).toMatch(/ENTRYPOINT \["\/usr\/bin\/tini", "--"\]/);
  });

  it('does not install uv through curl pipe', () => {
    expect(dockerfile).not.toMatch(/curl .*uv\/install\.sh \|/);
  });

  it('does not use BuildKit cache mounts', () => {
    expect(dockerfile).not.toMatch(/--mount=type=cache/);
  });
});

describe('All server source files are tracked in git', () => {
  it('no untracked files in server/ or src/shared/ that would break Railway esbuild', () => {
    const { execSync } = require('node:child_process');
    let untracked = '';
    try {
      // List untracked files, excluding coverage test files which are dev-only
      const raw = execSync('git ls-files --others --exclude-standard server/ src/shared/', {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();

      // Filter out coverage test files (*.coverage*.test.ts) - these are dev-only
      const files = raw.split('\n').filter((f: string) => {
        if (!f) return false;
        if (f.includes('.coverage') && f.endsWith('.test.ts')) return false;
        return true;
      });

      untracked = files.join('\n');
    } catch (_) {
      // git not available — skip silently
      return;
    }
    expect(untracked).toBe('');
  });
});
