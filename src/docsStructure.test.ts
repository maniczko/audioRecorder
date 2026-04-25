import fs from 'node:fs';
import path from 'node:path';

describe('documentation structure', () => {
  test('keeps only entry-point markdown files in the repository root', () => {
    const allowedRootDocs = new Set([
      '.prettier-docs.md',
      'AGENTS.md',
      'ARCHITECTURE.md',
      'CHANGELOG.md',
      'README.md',
    ]);
    const rootDocs = fs.readdirSync(process.cwd()).filter((entry) => entry.endsWith('.md'));

    expect(rootDocs.sort()).toEqual([...allowedRootDocs].sort());
  });

  test('documents the docs directory structure in an index', () => {
    const index = fs.readFileSync(path.resolve('docs/README.md'), 'utf8');

    expect(index).toContain('ops/');
    expect(index).toContain('automation/');
    expect(index).toContain('testing/');
    expect(index).toContain('archive/audits/');
  });
});
