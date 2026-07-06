import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE_DIR = 'src';
const DEFAULT_REPORT_PATH = 'docs/ui/css-layout-audit.md';
const DEFAULT_BASELINE_PATH = 'docs/ui/css-debt-baseline.json';
const IMPORTANT_PATTERN = /!important\b/i;
const HARDCODED_COLOR_PATTERN =
  /(?:#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|red|blue|green|yellow|orange|purple|gray|grey)\b)/i;
const HARDCODED_SPACING_PATTERN =
  /\b(?:margin|padding|gap|row-gap|column-gap|inset|top|right|bottom|left|width|height|min-width|max-width|min-height|max-height|border-radius|translate|transform)\s*:[^;]*(?:-?(?!0(?:px|rem|em)?\b)\d*\.?\d+(?:px|rem|em|vh|vw))/i;
const Z_INDEX_PATTERN = /\bz-index\s*:\s*([^;]+)/i;
const GLOBAL_SELECTOR_PATTERN =
  /^(?:html|body|:root|\*|button|input|textarea|select|a|p|h[1-6])(?:\b|[,:.#\s[{>+~])/i;
const TOKEN_Z_INDEX_VALUES = new Set(['0', '1', '2', '5', '10', '20', '30', '40', '50', '100']);

export function collectStyleFiles(rootDir = process.cwd(), sourceDir = DEFAULT_SOURCE_DIR) {
  const sourceRoot = path.resolve(rootDir, sourceDir);
  const files = [];

  function visit(directory) {
    if (!fs.existsSync(directory)) {
      return;
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      if (!/\.(css|scss)$/i.test(entry.name) || /\.(test|spec)\.(css|scss)$/i.test(entry.name)) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  visit(sourceRoot);
  return files.sort();
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function extractSelectors(line) {
  if (!line.includes('{')) {
    return [];
  }

  const selectorText = line.split('{')[0].trim();
  if (!selectorText || selectorText.startsWith('@')) {
    return [];
  }

  return selectorText
    .split(',')
    .map((selector) => selector.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function isTokenizedZIndex(value) {
  const normalized = value.trim();
  if (/^var\(/i.test(normalized)) {
    return true;
  }
  const numeric = normalized.match(/^-?\d+/)?.[0];
  return Boolean(numeric && TOKEN_Z_INDEX_VALUES.has(numeric));
}

export function auditCssText(text, filePath = 'inline.css') {
  const lines = text.split(/\r?\n/);
  const selectorCounts = new Map();
  const findings = {
    file: filePath,
    important: [],
    hardcodedSpacing: [],
    hardcodedColors: [],
    zIndexOutsideTokenScale: [],
    globalSelectors: [],
    duplicateSelectors: [],
  };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (IMPORTANT_PATTERN.test(line)) {
      findings.important.push({ line: lineNumber, text: trimmed });
    }

    if (HARDCODED_SPACING_PATTERN.test(line)) {
      findings.hardcodedSpacing.push({ line: lineNumber, text: trimmed });
    }

    if (HARDCODED_COLOR_PATTERN.test(line) && !line.includes('var(')) {
      findings.hardcodedColors.push({ line: lineNumber, text: trimmed });
    }

    const zIndex = line.match(Z_INDEX_PATTERN);
    if (zIndex && !isTokenizedZIndex(zIndex[1])) {
      findings.zIndexOutsideTokenScale.push({ line: lineNumber, text: trimmed });
    }

    for (const selector of extractSelectors(line)) {
      if (GLOBAL_SELECTOR_PATTERN.test(selector)) {
        findings.globalSelectors.push({ line: lineNumber, selector });
      }
      const previous = selectorCounts.get(selector) ?? [];
      previous.push(lineNumber);
      selectorCounts.set(selector, previous);
    }
  });

  for (const [selector, occurrences] of selectorCounts.entries()) {
    if (occurrences.length > 1) {
      findings.duplicateSelectors.push({ selector, lines: occurrences });
    }
  }

  return findings;
}

function priorityFor(fileAudit) {
  if (fileAudit.important.length > 0 || fileAudit.zIndexOutsideTokenScale.length > 0) {
    return 'P0';
  }
  if (fileAudit.duplicateSelectors.length > 0 || fileAudit.hardcodedColors.length > 0) {
    return 'P1';
  }
  if (fileAudit.hardcodedSpacing.length > 0 || fileAudit.globalSelectors.length > 0) {
    return 'P2';
  }
  return 'P3';
}

export function auditCssFiles(files, rootDir = process.cwd()) {
  const fileAudits = files.map((file) => {
    const relativePath = toPosix(path.relative(rootDir, file));
    const audit = auditCssText(fs.readFileSync(file, 'utf8'), relativePath);
    const counts = {
      important: audit.important.length,
      duplicateSelectors: audit.duplicateSelectors.length,
      hardcodedSpacing: audit.hardcodedSpacing.length,
      hardcodedColors: audit.hardcodedColors.length,
      zIndexOutsideTokenScale: audit.zIndexOutsideTokenScale.length,
      globalSelectors: audit.globalSelectors.length,
    };
    const totalFindings = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      ...audit,
      counts,
      totalFindings,
      priority: priorityFor(audit),
    };
  });

  const totals = fileAudits.reduce(
    (accumulator, audit) => {
      for (const [key, value] of Object.entries(audit.counts)) {
        accumulator[key] += value;
      }
      accumulator.totalFindings += audit.totalFindings;
      return accumulator;
    },
    {
      important: 0,
      duplicateSelectors: 0,
      hardcodedSpacing: 0,
      hardcodedColors: 0,
      zIndexOutsideTokenScale: 0,
      globalSelectors: 0,
      totalFindings: 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    generatedOn: os.hostname(),
    sourceFiles: fileAudits.length,
    totals,
    files: fileAudits.sort(
      (a, b) => b.totalFindings - a.totalFindings || a.file.localeCompare(b.file)
    ),
  };
}

export function createImportantBaseline(result) {
  return {
    version: 1,
    generatedAt: result.generatedAt,
    sourceFiles: result.sourceFiles,
    importantByFile: Object.fromEntries(
      result.files
        .filter((file) => file.counts.important > 0)
        .map((file) => [file.file, file.counts.important])
        .sort(([a], [b]) => a.localeCompare(b))
    ),
  };
}

export function assertNoNewImportant(result, baseline) {
  const baselineByFile = baseline?.importantByFile ?? {};
  const violations = [];

  for (const file of result.files) {
    const allowed = Number(baselineByFile[file.file] ?? 0);
    if (file.counts.important > allowed) {
      violations.push({
        file: file.file,
        allowed,
        actual: file.counts.important,
        added: file.counts.important - allowed,
      });
    }
  }

  return violations;
}

function renderCount(value) {
  return String(value).padStart(1, '0');
}

export function renderMarkdownReport(result, options = {}) {
  const command = options.command ?? 'pnpm run audit:css-debt';
  const topFiles = result.files.filter((file) => file.totalFindings > 0).slice(0, 30);
  const importantFiles = result.files.filter((file) => file.counts.important > 0);
  const zIndexFiles = result.files.filter((file) => file.counts.zIndexOutsideTokenScale > 0);

  return [
    '# CSS Layout Debt Audit',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    '## Gate',
    '',
    `- Local/CI command: \`${command}\``,
    '- The command compares current `!important` counts against `docs/ui/css-debt-baseline.json`.',
    '- New `!important` usage fails the audit per file unless the baseline is intentionally updated.',
    '- This issue is report-mode only: existing CSS debt is documented, not mass-refactored.',
    '',
    '## Summary',
    '',
    `- Files scanned: ${result.sourceFiles}`,
    `- Total findings: ${renderCount(result.totals.totalFindings)}`,
    `- \`!important\`: ${renderCount(result.totals.important)}`,
    `- Duplicate selectors: ${renderCount(result.totals.duplicateSelectors)}`,
    `- Hardcoded spacing values: ${renderCount(result.totals.hardcodedSpacing)}`,
    `- Hardcoded colors: ${renderCount(result.totals.hardcodedColors)}`,
    `- z-index outside token scale: ${renderCount(result.totals.zIndexOutsideTokenScale)}`,
    `- Global selectors: ${renderCount(result.totals.globalSelectors)}`,
    '',
    '## Priority',
    '',
    '- P0: `!important` and z-index values outside the token scale.',
    '- P1: duplicate selectors and hardcoded colors.',
    '- P2: hardcoded spacing and broad global selectors.',
    '',
    '## Top Files',
    '',
    '| Priority | File | Total | !important | Duplicate selectors | Hardcoded spacing | Hardcoded colors | z-index | Global selectors |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...topFiles.map(
      (file) =>
        `| ${file.priority} | \`${file.file}\` | ${file.totalFindings} | ${file.counts.important} | ${file.counts.duplicateSelectors} | ${file.counts.hardcodedSpacing} | ${file.counts.hardcodedColors} | ${file.counts.zIndexOutsideTokenScale} | ${file.counts.globalSelectors} |`
    ),
    '',
    '## P0: Existing `!important` Debt',
    '',
    importantFiles.length
      ? '| File | Count | First lines |\n| --- | ---: | --- |\n' +
        importantFiles
          .map((file) => {
            const firstLines = file.important
              .slice(0, 8)
              .map((item) => item.line)
              .join(', ');
            return `| \`${file.file}\` | ${file.counts.important} | ${firstLines} |`;
          })
          .join('\n')
      : 'No `!important` declarations found.',
    '',
    '## P0: z-index Outside Token Scale',
    '',
    zIndexFiles.length
      ? '| File | Count | First lines |\n| --- | ---: | --- |\n' +
        zIndexFiles
          .map((file) => {
            const firstLines = file.zIndexOutsideTokenScale
              .slice(0, 8)
              .map((item) => item.line)
              .join(', ');
            return `| \`${file.file}\` | ${file.counts.zIndexOutsideTokenScale} | ${firstLines} |`;
          })
          .join('\n')
      : 'No out-of-scale z-index declarations found.',
    '',
    '## Recommended Cleanup Order',
    '',
    '1. Remove or localize `!important` from the top P0 files, starting with component-owned CSS before legacy global bundles.',
    '2. Replace out-of-scale `z-index` values with a documented token scale.',
    '3. Consolidate duplicate selectors in the largest CSS bundles before changing visual styling.',
    '4. Move repeated hardcoded colors and spacing into existing design tokens as files are touched.',
    '',
    '## Notes',
    '',
    '- Counts are static-analysis heuristics and should guide cleanup, not replace visual review.',
    '- The report intentionally does not fail on existing debt. The baseline gate fails only when `!important` usage increases.',
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    sourceDir: DEFAULT_SOURCE_DIR,
    reportPath: DEFAULT_REPORT_PATH,
    baselinePath: DEFAULT_BASELINE_PATH,
    write: false,
  };

  for (const arg of argv) {
    if (arg === '--write') {
      args.write = true;
      continue;
    }
    const [key, value] = arg.split('=');
    if (key === '--source' && value) {
      args.sourceDir = value;
    }
    if (key === '--report' && value) {
      args.reportPath = value;
    }
    if (key === '--baseline' && value) {
      args.baselinePath = value;
    }
  }

  return args;
}

export function run(argv = process.argv.slice(2), rootDir = process.cwd()) {
  const args = parseArgs(argv);
  const files = collectStyleFiles(rootDir, args.sourceDir);
  const result = auditCssFiles(files, rootDir);
  const reportPath = path.resolve(rootDir, args.reportPath);
  const baselinePath = path.resolve(rootDir, args.baselinePath);

  if (args.write) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      renderMarkdownReport(result, { command: 'pnpm run audit:css-debt' })
    );
    fs.writeFileSync(baselinePath, JSON.stringify(createImportantBaseline(result), null, 2) + '\n');
    console.log(`CSS debt report updated: ${args.reportPath}`);
    console.log(`CSS !important baseline updated: ${args.baselinePath}`);
    return { result, violations: [] };
  }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing CSS debt baseline: ${args.baselinePath}`);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const violations = assertNoNewImportant(result, baseline);
  if (violations.length > 0) {
    const details = violations
      .map((violation) => {
        return `- ${violation.file}: ${violation.actual} !important declarations, baseline ${violation.allowed} (+${violation.added})`;
      })
      .join('\n');
    throw new Error(
      `New CSS !important usage detected. Run \`pnpm run audit:css-debt:update\` only when intentionally accepting baseline changes.\n${details}`
    );
  }

  console.log(
    `CSS debt audit passed: ${result.sourceFiles} files, ${result.totals.important} existing !important declarations, no per-file increases.`
  );
  return { result, violations };
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
