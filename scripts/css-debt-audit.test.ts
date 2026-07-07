import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  assertNoNewImportant,
  auditCssFiles,
  auditCssText,
  createImportantBaseline,
  renderMarkdownReport,
} from './css-debt-audit.mjs';

function findAdjacentDuplicateRuleBlocks(css: string) {
  const blockPattern = /([^{}]+\{[^{}]*\})(\r?\n\s*)*/g;
  const duplicates: Array<{ index: number; block: string }> = [];
  let previousBlock: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(css))) {
    const normalizedBlock = match[1].trim().replace(/\s+/g, ' ');

    if (normalizedBlock === previousBlock) {
      duplicates.push({ index: match.index, block: normalizedBlock });
    }

    previousBlock = normalizedBlock;
  }

  return duplicates;
}

describe('css debt audit', () => {
  it('detects important declarations, duplicates, hardcoded values and global selectors', () => {
    const audit = auditCssText(
      [
        ':root { --token: 1; }',
        'body { margin: 0; }',
        '.panel { color: #123456; padding: 12px; z-index: 10000; }',
        '.panel { background: rgba(255, 255, 255, 0.9) !important; }',
      ].join('\n'),
      'src/example.css'
    );

    expect(audit.important).toHaveLength(1);
    expect(audit.duplicateSelectors).toEqual([{ selector: '.panel', lines: [3, 4] }]);
    expect(audit.hardcodedColors.map((item) => item.line)).toEqual([3, 4]);
    expect(audit.hardcodedSpacing.map((item) => item.line)).toEqual([3]);
    expect(audit.zIndexOutsideTokenScale.map((item) => item.line)).toEqual([3]);
    expect(audit.globalSelectors.map((item) => item.selector)).toEqual([':root', 'body']);
  });

  it('creates an important baseline and fails only when a file exceeds it', () => {
    const baseline = {
      version: 1,
      importantByFile: {
        'src/a.css': 1,
      },
    };
    const result = {
      files: [
        { file: 'src/a.css', counts: { important: 1 } },
        { file: 'src/b.css', counts: { important: 2 } },
      ],
    } as any;

    expect(assertNoNewImportant(result, baseline)).toEqual([
      { file: 'src/b.css', allowed: 0, actual: 2, added: 2 },
    ]);
  });

  it('renders the command and priority sections in the committed report', () => {
    const result = {
      generatedAt: '2026-07-06T00:00:00.000Z',
      sourceFiles: 1,
      totals: {
        important: 1,
        duplicateSelectors: 1,
        hardcodedSpacing: 1,
        hardcodedColors: 1,
        zIndexOutsideTokenScale: 1,
        globalSelectors: 1,
        totalFindings: 6,
      },
      files: [
        {
          file: 'src/example.css',
          priority: 'P0',
          totalFindings: 6,
          counts: {
            important: 1,
            duplicateSelectors: 1,
            hardcodedSpacing: 1,
            hardcodedColors: 1,
            zIndexOutsideTokenScale: 1,
            globalSelectors: 1,
          },
          important: [{ line: 2 }],
          zIndexOutsideTokenScale: [{ line: 3 }],
        },
      ],
    } as any;

    const markdown = renderMarkdownReport(result);

    expect(markdown).toContain('pnpm run audit:css-debt');
    expect(markdown).toContain('## P0: Existing `!important` Debt');
    expect(markdown).toContain('## P0: z-index Outside Token Scale');
    expect(markdown).toContain('`src/example.css`');
  });

  it('builds a baseline from audited files', () => {
    const result = {
      generatedAt: '2026-07-06T00:00:00.000Z',
      sourceFiles: 2,
      files: [
        { file: 'src/b.css', counts: { important: 0 } },
        { file: 'src/a.css', counts: { important: 3 } },
      ],
    } as any;

    expect(createImportantBaseline(result)).toEqual({
      version: 1,
      generatedAt: '2026-07-06T00:00:00.000Z',
      sourceFiles: 2,
      importantByFile: {
        'src/a.css': 3,
      },
    });
  });

  it('summarizes real files without mutating source content', () => {
    const files = ['src/PeopleTabStyles.css'];
    const result = auditCssFiles(
      files.map((file) => `${process.cwd()}/${file}`),
      process.cwd()
    );

    expect(result.sourceFiles).toBe(1);
    expect(result.files[0].file).toBe('src/PeopleTabStyles.css');
    expect(result.totals.totalFindings).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #1389 — adjacent duplicate CSS selector blocks
  // Date: 2026-07-07
  // Bug: recordings and tasks styles carried repeated copy-pasted blocks.
  // Fix: remove adjacent duplicates and guard against reintroducing them.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: Issue #1389 — adjacent duplicate CSS selector blocks', () => {
    it.each(['src/styles/recordings.css', 'src/styles/tasks.css'])(
      'keeps %s free of adjacent duplicate rule blocks',
      (filePath) => {
        const css = readFileSync(filePath, 'utf8');

        expect(findAdjacentDuplicateRuleBlocks(css)).toEqual([]);
      }
    );
  });
});
