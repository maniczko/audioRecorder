import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

vi.unmock('node:fs');
vi.unmock('fs');

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
        file !== 'data-test' &&
        file !== 'tests' &&  // Skip test files to speed up
        file !== 'coverage'
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
  // P0 Fix: Increase timeout for dependency scanning
  it('should declare all externally imported modules in server/package.json', { timeout: 30000 }, () => {
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

      const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

      const findImports = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
          if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            addExternal(node.moduleSpecifier.text);
          }
        } else if (ts.isCallExpression(node)) {
          if (node.expression.getText(sourceFile) === 'require' && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg)) {
              addExternal(arg.text);
            }
          } else if (
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length > 0
          ) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg)) {
              addExternal(arg.text);
            }
          }
        }
        ts.forEachChild(node, findImports);
      };

      const addExternal = (mod: string) => {
        if (
          mod.startsWith('.') ||
          mod.startsWith('/') ||
          mod.startsWith('~/') ||
          mod.startsWith('src/')
        ) {
          return;
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
      };

      findImports(sourceFile);
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
    const allowedMissing = new Set([
      '@types/jest',
      'vitest',
      'cross-env',
      'jest',
      'ts-jest',
      'typescript',
    ]);

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
