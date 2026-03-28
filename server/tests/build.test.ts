import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getAllTsFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = join(dirPath, file);
    if (statSync(fullPath).isDirectory()) {
      // Ignore builds, modules and tests from deep checking
      if (
        file !== 'node_modules' &&
        file !== 'dist-server' &&
        file !== 'data' &&
        file !== 'data-test'
      ) {
        arrayOfFiles = getAllTsFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        arrayOfFiles.push(fullPath);
      }
    }
  });
  return arrayOfFiles;
}

describe('Server Dependencies Verification', () => {
  it('should declare all externally imported modules in server/package.json', () => {
    const pkgPath = join(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    // The modules required inside server/package.json for `pnpm deploy` to work during Docker build
    const declaredDeps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]);

    const isBuiltin = (name: string) =>
      name.startsWith('node:') ||
      [
        'fs',
        'path',
        'crypto',
        'child_process',
        'url',
        'http',
        'https',
        'util',
        'os',
        'stream',
        'events',
        'zlib',
        'buffer',
        'perf_hooks',
        'worker_threads',
        'readline',
        'assert',
        'tty',
      ].includes(name);

    const tsFiles = getAllTsFiles(join(__dirname, '../'));
    const externalImports = new Set<string>();

    for (const file of tsFiles) {
      const content = readFileSync(file, 'utf8');

      // Match basic ES imports and CJS requires
      const matches = [
        ...content.matchAll(/from\s+['"]([^'.][^'"]*)['"]/g),
        ...content.matchAll(/import\s+['"]([^'.][^'"]*)['"]/g),
        ...content.matchAll(/import\(['"]([^'.][^'"]*)['"]\)/g),
        ...content.matchAll(/require\(['"]([^'.][^'"]*)['"]\)/g),
      ];

      for (const match of matches) {
        const mod = match[1].trim();
        // Ignore local imports, dynamic injections, aliases
        if (
          mod.startsWith('.') ||
          mod.startsWith('/') ||
          mod.startsWith('~/') ||
          mod.startsWith('src/')
        ) {
          continue;
        }

        let pkgName = mod;
        if (mod.startsWith('@')) {
          const parts = mod.split('/');
          pkgName = parts.length > 1 ? `${parts[0]}/${parts[1]}` : mod;
        } else {
          pkgName = mod.split('/')[0];
        }

        if (!isBuiltin(pkgName)) {
          externalImports.add(pkgName);
        }
      }
    }

    const missingDeps: string[] = [];
    const rootPkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

    for (const dep of externalImports) {
      if (
        !declaredDeps.has(dep) &&
        (rootPkg.dependencies?.[dep] ||
          rootPkg.devDependencies?.[dep] ||
          rootPkg.peerDependencies?.[dep])
      ) {
        missingDeps.push(dep);
      }
    }

    // Types or dev tools that we don't strictly require on production runtime isolated server package.json
    const allowedMissing = new Set(['@types/jest', 'vitest', 'cross-env', 'jest', 'ts-jest']);

    const trueMissing = missingDeps.filter((d) => !allowedMissing.has(d));

    if (trueMissing.length > 0) {
      console.error(
        `[502 Gateway Protection] ERROR: The following modules are imported in the 'server' codebase but missing from 'server/package.json':\n` +
          trueMissing.map((d) => ` - ${d}`).join('\n') +
          `\nPlease add them to server/package.json to prevent 'ERR_MODULE_NOT_FOUND' crashing the Railway docker build.`
      );
    }

    expect(trueMissing, 'Missing explicit workspace dependencies for server/ module.').toEqual([]);
  });
});
