import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(rootDir, 'reports', 'tooling-readiness');

export const requiredToolingIds = [
  'github-actions-secrets',
  'supabase-mcp',
  'sentry',
  'vercel',
  'railway',
  'playwright-browser',
  'codex-skills',
  'subagent-orchestration',
  'prompt-engineer',
  'coderabbit',
  'figma-canva',
  'twilio',
  'openai-developers',
  'local-env',
];

function fileExists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function readRepoFile(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return '';
  return fs.readFileSync(absolutePath, 'utf8');
}

function packageJson(root) {
  const raw = readRepoFile(root, 'package.json');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function contains(root, relativePath, ...needles) {
  const content = readRepoFile(root, relativePath);
  return needles.every((needle) => content.includes(needle));
}

function matches(root, relativePath, pattern) {
  return pattern.test(readRepoFile(root, relativePath));
}

function scriptEquals(root, name, expected) {
  return packageJson(root).scripts?.[name] === expected;
}

function scriptContains(root, name, expected) {
  return String(packageJson(root).scripts?.[name] || '').includes(expected);
}

function noTwilioRuntimeDependency(root) {
  const pkg = packageJson(root);
  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
  };
  return !Object.keys(dependencies).some((name) => name.toLowerCase().startsWith('twilio'));
}

const toolingDefinitions = [
  {
    id: 'github-actions-secrets',
    label: 'GitHub Actions / Secrets',
    score: 9.3,
    evidence: [
      {
        id: 'node22-ci',
        description: 'CI and package engines pin Node 22 release runtime.',
        test: (root) =>
          contains(root, 'package.json', '"node": "22.x"') &&
          matches(root, '.github/workflows/ci.yml', /node-version:\s*['"]?22/),
      },
      {
        id: 'release-gates',
        description: 'Canonical release rehearsal is a package script and workflow contract.',
        test: (root) =>
          scriptEquals(root, 'release:rehearsal', 'node scripts/release-rehearsal.mjs'),
      },
      {
        id: 'prod-secrets',
        description: 'Production workflow references smoke, Vercel, and Sentry secrets.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/vercel-production.yml',
            'VERCEL_TOKEN',
            'PRODUCTION_SMOKE_AUTH_TOKEN',
            'SENTRY_AUTH_TOKEN'
          ),
      },
    ],
  },
  {
    id: 'supabase-mcp',
    label: 'Supabase MCP',
    score: 9.1,
    evidence: [
      {
        id: 'supabase-skill',
        description: 'Repo includes Supabase agent skills for database/storage work.',
        test: (root) => fileExists(root, '.agents/skills/supabase/SKILL.md'),
      },
      {
        id: 'supabase-orchestration',
        description: 'Codex orchestration documents Supabase verification and no-secret handling.',
        test: (root) =>
          contains(root, 'docs/CODEX_ORCHESTRATION.md', 'Supabase', 'persistence proof'),
      },
      {
        id: 'supabase-smoke',
        description: 'Production smoke requires remote Supabase persistence evidence.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/vercel-production.yml',
            'PRODUCTION_REQUIRE_SUPABASE_REMOTE'
          ),
      },
    ],
  },
  {
    id: 'sentry',
    label: 'Sentry',
    score: 9.2,
    evidence: [
      {
        id: 'release-health-script',
        description: 'Sentry release health script and tests are present.',
        test: (root) =>
          fileExists(root, 'scripts/sentry-release-health.mjs') &&
          fileExists(root, 'scripts/sentry-release-health.test.ts'),
      },
      {
        id: 'release-health-workflow',
        description: 'Production deploy runs Sentry release health for the release SHA.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/vercel-production.yml',
            'pnpm run sentry:release-health'
          ),
      },
      {
        id: 'sentry-script',
        description: 'Package script exposes sentry:release-health.',
        test: (root) =>
          scriptEquals(root, 'sentry:release-health', 'node scripts/sentry-release-health.mjs'),
      },
    ],
  },
  {
    id: 'vercel',
    label: 'Vercel',
    score: 9.1,
    evidence: [
      {
        id: 'vercel-workflow',
        description: 'Vercel production workflow deploys from the Railway-verified SHA.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/vercel-production.yml',
            "workflows: ['Railway Build Metadata']"
          ),
      },
      {
        id: 'vercel-strict-smoke',
        description: 'Vercel deploy runs strict production smoke.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/vercel-production.yml',
            'pnpm run release:prod-smoke:strict'
          ),
      },
      {
        id: 'vercel-validator',
        description: 'Vercel workflow validator is included in workflow tests.',
        test: (root) =>
          fileExists(root, 'scripts/validate-vercel-workflows.mjs') &&
          scriptContains(root, 'test:workflows', 'validate-vercel-workflows.mjs'),
      },
    ],
  },
  {
    id: 'railway',
    label: 'Railway',
    score: 9.0,
    evidence: [
      {
        id: 'railway-build-metadata',
        description: 'Railway metadata workflow writes the exact backend SHA.',
        test: (root) =>
          contains(root, '.github/workflows/railway-build-metadata.yml', 'RAILWAY_GIT_COMMIT_SHA'),
      },
      {
        id: 'railway-retry-health',
        description: 'Railway deploy has retry and health verification.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/railway-build-metadata.yml',
            'Railway deploy attempt',
            '/health'
          ),
      },
      {
        id: 'railway-status-tests',
        description: 'Railway status script is covered by workflow tests.',
        test: (root) =>
          fileExists(root, 'scripts/railway-status.test.ts') &&
          scriptContains(root, 'test:workflows', 'railway-status.test.ts'),
      },
    ],
  },
  {
    id: 'playwright-browser',
    label: 'Playwright / Browser',
    score: 9.3,
    evidence: [
      {
        id: 'ui-action-inventory',
        description: 'UI action inventory is audited and tested.',
        test: (root) =>
          scriptEquals(
            root,
            'audit:ui-actions',
            'node scripts/audit-ui-action-contracts.mjs --write-report'
          ) && scriptEquals(root, 'test:ui-actions', 'playwright test tests/e2e/ui-actions'),
      },
      {
        id: 'visual-and-remote',
        description: 'Visual and remote API Playwright checks are release gates.',
        test: (root) =>
          contains(
            root,
            'scripts/release-rehearsal.mjs',
            'test:visual:check',
            'test:e2e:remote-api'
          ),
      },
      {
        id: 'browser-policy',
        description: 'Codex orchestration requires Browser/Playwright evidence for UI work.',
        test: (root) =>
          contains(
            root,
            'docs/CODEX_ORCHESTRATION.md',
            'Browser / Playwright',
            'UI Action Coverage'
          ),
      },
      {
        id: 'production-action-crawler',
        description:
          'Production Browser/Playwright crawler clicks safe actions and uploads failure artifacts.',
        test: (root) =>
          scriptEquals(
            root,
            'test:e2e:production-actions',
            'playwright test tests/e2e/production-actions.spec.js --project=chromium'
          ) &&
          contains(
            root,
            'tests/e2e/production-actions.spec.js',
            'missing-feedback',
            'production-action-crawler-report.json',
            'runtime-failure'
          ) &&
          contains(
            root,
            '.github/workflows/production-system-audit.yml',
            'reports/production-action-crawler/'
          ),
      },
    ],
  },
  {
    id: 'codex-skills',
    label: 'Codex Skills',
    score: 9.1,
    evidence: [
      {
        id: 'project-codex-config',
        description:
          'Project Codex config prevents secret inheritance and keeps sandbox conservative.',
        test: (root) =>
          contains(
            root,
            '.codex/config.toml',
            'approval_policy',
            'exclude = ["*TOKEN*", "*SECRET*", "*KEY*", "*PASSWORD*"]'
          ),
      },
      {
        id: 'orchestration-doc',
        description: 'Codex orchestration doc is present and referenced by AGENTS.',
        test: (root) =>
          contains(root, 'AGENTS.md', 'docs/CODEX_ORCHESTRATION.md') &&
          fileExists(root, 'docs/CODEX_ORCHESTRATION.md'),
      },
      {
        id: 'qwen-safety',
        description:
          'Qwen permissions allow test/build commands but not broad destructive commands.',
        test: (root) =>
          contains(root, '.qwen/settings.json', 'Bash(pnpm run *)') &&
          !contains(root, '.qwen/settings.json', 'Bash(rm *)', 'Bash(del *)'),
      },
    ],
  },
  {
    id: 'subagent-orchestration',
    label: 'Subagent Orchestration',
    score: 9.1,
    evidence: [
      {
        id: 'parallel-investigation-doc',
        description: 'Codex orchestration defines when to split work across independent agents.',
        test: (root) =>
          contains(
            root,
            'docs/CODEX_ORCHESTRATION.md',
            'Parallel Investigation / Subagents',
            'Default VoiceLog split'
          ),
      },
      {
        id: 'domain-split',
        description:
          'Subagent playbook covers frontend, backend, DB, tests, and observability domains.',
        test: (root) =>
          contains(
            root,
            'docs/CODEX_ORCHESTRATION.md',
            'Frontend / UI',
            'Backend / API',
            'DB / Supabase',
            'Tests / CI',
            'Sentry / GitHub'
          ),
      },
      {
        id: 'coordination-safety',
        description:
          'Subagent playbook requires coordination, focused prompts, no secrets, and final verification.',
        test: (root) =>
          contains(
            root,
            'docs/CODEX_ORCHESTRATION.md',
            'no-secrets reminder',
            'coordinator integrates changes',
            'gate pass together'
          ),
      },
    ],
  },
  {
    id: 'prompt-engineer',
    label: 'Prompt Engineer Skill',
    score: 9.1,
    evidence: [
      {
        id: 'skill-installed',
        description: 'Prompt engineer skill exists in agent skills.',
        test: (root) => fileExists(root, '.agents/skills/prompt-engineer/SKILL.md'),
      },
      {
        id: 'qwen-pointer',
        description: 'Qwen prompt-engineer pointer exists.',
        test: (root) => fileExists(root, '.qwen/skills/prompt-engineer.md'),
      },
      {
        id: 'prompt-flow',
        description: 'Orchestration doc requires Prompt -> Review -> Rewrite -> Execute.',
        test: (root) =>
          contains(
            root,
            'docs/CODEX_ORCHESTRATION.md',
            'Prompt Engineering Gate',
            'Review the prompt'
          ),
      },
    ],
  },
  {
    id: 'coderabbit',
    label: 'CodeRabbit',
    score: 9.0,
    evidence: [
      {
        id: 'pr-template',
        description: 'PR checklist explicitly requests CodeRabbit review for critical areas.',
        test: (root) =>
          contains(root, '.github/pull_request_template.md', 'CodeRabbit review requested'),
      },
      {
        id: 'review-doc',
        description:
          'CodeRabbit review gate defines when review is required and what evidence it checks.',
        test: (root) =>
          contains(root, 'docs/tooling/CODERABBIT_REVIEW_GATE.md', 'CodeRabbit', 'test red/green'),
      },
      {
        id: 'review-workflow',
        description: 'GitHub review workflow runs automated eslint/coverage/security checks.',
        test: (root) =>
          contains(
            root,
            '.github/workflows/code-review.yml',
            'reviewdog/action-eslint',
            'coverage-check',
            'security-scan'
          ),
      },
    ],
  },
  {
    id: 'figma-canva',
    label: 'Figma / Canva',
    score: 9.0,
    evidence: [
      {
        id: 'design-workflow',
        description:
          'Design tooling workflow defines when Figma/Canva/Browser/Playwright are used.',
        test: (root) =>
          contains(root, 'docs/tooling/DESIGN_TOOLING_WORKFLOW.md', 'Figma', 'Canva', 'Playwright'),
      },
      {
        id: 'design-system-rules',
        description: 'Design system rules are the repo source of truth for UI polish.',
        test: (root) =>
          contains(root, 'docs/DESIGN_SYSTEM_RULES.md', 'spacing', 'Playwright') ||
          contains(root, 'docs/DESIGN_SYSTEM_RULES.md', 'Spacing', 'Playwright'),
      },
      {
        id: 'ui-action-docs',
        description: 'UI action inventory docs connect design actions to automated tests.',
        test: (root) =>
          fileExists(root, 'docs/ui-actions/ACTION_INVENTORY.md') &&
          fileExists(root, 'docs/ui-actions/ACTION_TEST_POLICY.md'),
      },
    ],
  },
  {
    id: 'twilio',
    label: 'Twilio Developer Kit',
    score: 9.0,
    evidence: [
      {
        id: 'scope-policy',
        description: 'Twilio is explicitly governed as not-applicable until product code uses it.',
        test: (root) =>
          contains(
            root,
            'docs/tooling/TWILIO_SCOPE_POLICY.md',
            'not a VoiceLog runtime dependency'
          ),
      },
      {
        id: 'no-runtime-dependency',
        description: 'Package dependencies do not include Twilio runtime SDKs.',
        test: noTwilioRuntimeDependency,
      },
      {
        id: 'activation-rule',
        description: 'Policy requires tests and compliance review before Twilio code is added.',
        test: (root) =>
          contains(
            root,
            'docs/tooling/TWILIO_SCOPE_POLICY.md',
            'activation checklist',
            'regression tests'
          ),
      },
    ],
  },
  {
    id: 'openai-developers',
    label: 'OpenAI Developers',
    score: 9.1,
    evidence: [
      {
        id: 'openai-policy',
        description: 'OpenAI Developers plugin is routed through Codex orchestration.',
        test: (root) => contains(root, 'docs/CODEX_ORCHESTRATION.md', 'OpenAI Developers'),
      },
      {
        id: 'premium-stt',
        description: 'Production health smoke requires premium OpenAI STT evidence.',
        test: (root) =>
          contains(root, 'scripts/production-smoke.mjs', 'gpt-4o-transcribe', 'provider'),
      },
      {
        id: 'no-browser-keys',
        description: 'Environment validator and examples keep API keys server-side.',
        test: (root) =>
          contains(root, 'scripts/validate-env.js', 'OPENAI_API_KEY') &&
          contains(root, '.env.example', 'OPENAI_API_KEY') &&
          contains(root, '.env.example', 'VITE_ALLOW_BROWSER_AI_KEYS=false'),
      },
    ],
  },
  {
    id: 'local-env',
    label: 'Local .env readiness',
    score: 9.0,
    evidence: [
      {
        id: 'env-example',
        description:
          '.env.example documents required production and provider variables without values.',
        test: (root) =>
          contains(
            root,
            '.env.example',
            'VOICELOG_ALLOWED_ORIGINS',
            'SUPABASE_URL',
            'OPENAI_API_KEY'
          ),
      },
      {
        id: 'env-validator',
        description: 'Environment validator checks required local/production variables.',
        test: (root) =>
          fileExists(root, 'scripts/validate-env.js') &&
          fileExists(root, 'scripts/validate-env.test.ts'),
      },
      {
        id: 'env-secret-safety',
        description: 'Local .env is ignored and excluded from Codex shell environment policy.',
        test: (root) =>
          contains(root, '.gitignore', '.env') &&
          contains(root, '.codex/config.toml', '*SECRET*', '*PASSWORD*'),
      },
    ],
  },
];

export function evaluateToolingReadiness({ rootDir: currentRoot = rootDir } = {}) {
  const tools = toolingDefinitions.map((tool) => {
    const evidence = tool.evidence.map((item) => {
      let passed = false;
      try {
        passed = Boolean(item.test(currentRoot));
      } catch {
        passed = false;
      }

      return {
        id: item.id,
        description: item.description,
        passed,
      };
    });

    const missing = evidence.filter((item) => !item.passed);
    const score =
      missing.length === 0
        ? tool.score
        : Math.max(1, Number((tool.score - missing.length * 1.5).toFixed(1)));

    return {
      id: tool.id,
      label: tool.label,
      score,
      targetScore: 9,
      evidence,
      status: missing.length === 0 ? 'ready' : 'needs-work',
    };
  });

  const blockers = tools.flatMap((tool) =>
    tool.evidence
      .filter((evidence) => !evidence.passed)
      .map((evidence) => ({
        toolId: tool.id,
        toolLabel: tool.label,
        evidenceId: evidence.id,
        description: evidence.description,
      }))
  );
  const averageScore = Number(
    (tools.reduce((sum, tool) => sum + tool.score, 0) / tools.length).toFixed(2)
  );

  return {
    generatedAt: new Date().toISOString(),
    targetAverage: 9,
    averageScore,
    status: averageScore >= 9 && blockers.length === 0 ? 'ready' : 'needs-work',
    tools,
    blockers,
  };
}

export function formatToolingReadinessMarkdown(report) {
  const rows = report.tools
    .map((tool) => `| ${tool.label} | ${tool.score.toFixed(1)} | ${tool.status} |`)
    .join('\n');
  const blockers =
    report.blockers.length === 0
      ? '- None.'
      : report.blockers
          .map(
            (blocker) => `- ${blocker.toolLabel}: ${blocker.evidenceId} - ${blocker.description}`
          )
          .join('\n');

  return [
    '# Tooling Readiness Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Average score: ${report.averageScore.toFixed(2)} / 10`,
    `Target average: ${report.targetAverage.toFixed(1)} / 10`,
    `Status: ${report.status}`,
    '',
    '| Tool | Score | Status |',
    '| --- | ---: | --- |',
    rows,
    '',
    '## Blockers',
    '',
    blockers,
    '',
  ].join('\n');
}

function writeReport(report, { targetDir = reportDir } = {}) {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(targetDir, 'latest.md'), formatToolingReadinessMarkdown(report));
}

export function runToolingReadinessAudit({ rootDir: currentRoot = rootDir, write = false } = {}) {
  const report = evaluateToolingReadiness({ rootDir: currentRoot });
  if (write) {
    writeReport(report);
  }

  console.log(formatToolingReadinessMarkdown(report));

  if (report.status !== 'ready') {
    throw new Error(
      `Tooling readiness is ${report.averageScore.toFixed(2)}/10; target is 9.00/10 with no blockers.`
    );
  }

  return report;
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(rootDir, 'scripts', 'tooling-readiness-audit.mjs');

if (isMainModule) {
  try {
    runToolingReadinessAudit({ write: process.argv.includes('--write-report') });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
