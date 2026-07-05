import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SECRET_PATTERNS = [
  {
    kind: 'openai-api-key',
    pattern: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    kind: 'anthropic-api-key',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    kind: 'groq-api-key',
    pattern: /\bgsk_[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    kind: 'huggingface-token',
    pattern: /\bhf_[A-Za-z0-9]{24,}\b/g,
  },
  {
    kind: 'github-pat',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{24,}\b/g,
  },
  {
    kind: 'supabase-service-role-jwt',
    pattern: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\b/g,
  },
  {
    kind: 'google-oauth-client-secret',
    pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g,
  },
];

const TEXT_FILE_PATTERN =
  /\.(?:cjs|css|env|example|html|js|json|jsx|md|mjs|ps1|py|sh|sql|ts|tsx|txt|yaml|yml)$/i;
const SKIP_PATH_PATTERN =
  /^(?:build|coverage|dist|node_modules|playwright-report|test-results|\.git)\//i;
const PLACEHOLDER_PATTERN =
  /(?:dummy|example|placeholder|test|fake|mock|sample|your[_ -]?|change[-_]?this|xxx|xxxx|x4x4|secret-123|new-secret|ops-secret|validating-env)/i;

export function normalizeGitPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

export function isScannableTextPath(filePath) {
  const normalized = normalizeGitPath(filePath);
  return Boolean(
    normalized && !SKIP_PATH_PATTERN.test(normalized) && TEXT_FILE_PATTERN.test(normalized)
  );
}

function isAllowedPlaceholder({ path: filePath, line }) {
  const normalizedPath = normalizeGitPath(filePath).toLowerCase();
  const normalizedLine = String(line || '').toLowerCase();
  return (
    PLACEHOLDER_PATTERN.test(normalizedLine) || /(^|\/)(tests?|fixtures?)\//.test(normalizedPath)
  );
}

export function findForbiddenSecretLiterals(files = []) {
  const violations = [];
  for (const file of files) {
    const filePath = normalizeGitPath(file.path);
    const content = String(file.content || '');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (isAllowedPlaceholder({ path: filePath, line })) {
        return;
      }
      for (const rule of SECRET_PATTERNS) {
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(line)) {
          violations.push({
            path: filePath,
            line: index + 1,
            kind: rule.kind,
          });
        }
      }
    });
  }
  return violations;
}

export function readTrackedTextFiles({ cwd = process.cwd(), maxBytes = 1024 * 1024 } = {}) {
  const output = execFileSync('git', ['ls-files'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return output
    .split(/\r?\n/)
    .filter(isScannableTextPath)
    .map((filePath) => {
      const absolutePath = path.join(cwd, filePath);
      const content = readFileSync(absolutePath, 'utf8');
      return {
        path: filePath,
        content: content.length > maxBytes ? content.slice(0, maxBytes) : content,
      };
    });
}

export function validateSecretHygiene(options = {}) {
  const files = options.files || readTrackedTextFiles(options);
  const violations = findForbiddenSecretLiterals(files);
  if (violations.length > 0) {
    const preview = violations
      .slice(0, 40)
      .map((violation) => `- ${violation.path}:${violation.line} (${violation.kind})`)
      .join('\n');
    const suffix =
      violations.length > 40
        ? `\n...and ${violations.length - 40} more secret-looking literal(s).`
        : '';
    throw new Error(
      `Potential committed secrets detected:\n${preview}${suffix}\nMove real credentials to GitHub, Railway, Vercel, or provider secret stores.`
    );
  }

  return true;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(process.cwd(), 'scripts/validate-secret-hygiene.mjs');

if (isMainModule) {
  validateSecretHygiene();
  console.log('Secret hygiene validation passed.');
}
