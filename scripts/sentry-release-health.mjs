import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ORG = 'vatlar';
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_WINDOW_MINUTES = 20;
const DEFAULT_WARNING_THRESHOLD = 5;

function toCsvList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createSentryReleaseHealthConfig(env = process.env) {
  const token = String(env.SENTRY_AUTH_TOKEN || '').trim();
  if (!token) {
    throw new Error('SENTRY_AUTH_TOKEN is required for production release health.');
  }

  const release = String(env.SENTRY_RELEASE || env.GITHUB_SHA || env.VERCEL_GIT_COMMIT_SHA || '')
    .trim()
    .toLowerCase();
  if (!release) {
    throw new Error('SENTRY_RELEASE or GITHUB_SHA is required for production release health.');
  }

  return {
    token,
    org: String(env.SENTRY_ORG || DEFAULT_ORG).trim(),
    projects: toCsvList(env.SENTRY_PROJECT),
    release,
    environment: String(env.SENTRY_ENVIRONMENT || DEFAULT_ENVIRONMENT).trim(),
    windowMinutes: toPositiveNumber(env.SENTRY_WINDOW_MINUTES, DEFAULT_WINDOW_MINUTES),
    warningThreshold: toPositiveNumber(env.SENTRY_WARNING_THRESHOLD, DEFAULT_WARNING_THRESHOLD),
  };
}

function issueCount(issue) {
  const count = Number(issue?.count ?? issue?.userCount ?? 1);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function issueText(issue) {
  return [issue?.title, issue?.culprit, issue?.metadata?.value, issue?.metadata?.type]
    .filter(Boolean)
    .join(' ');
}

export function classifySentryIssue(issue, { warningThreshold = DEFAULT_WARNING_THRESHOLD } = {}) {
  const level = String(issue?.level || 'error').toLowerCase();
  const count = issueCount(issue);
  const text = issueText(issue);
  const isRuntimeCrash = /unhandled|typeerror|referenceerror|syntaxerror/i.test(text);
  const isServerFailure = /\b5\d\d\b|500|502|503|504/i.test(text);
  const isPremiumAction =
    /voice-profiles|from-speaker|media\/recordings|recording queue|transcribe|studio/i.test(text);
  const isHighLevel = level === 'fatal' || level === 'error';
  const isRepeatedPremiumWarning =
    level === 'warning' && isPremiumAction && count >= warningThreshold;
  const blocking = isHighLevel || isRuntimeCrash || isServerFailure || isRepeatedPremiumWarning;

  return {
    id: String(issue?.id || issue?.shortId || issue?.title || 'unknown'),
    title: String(issue?.title || 'Unknown Sentry issue'),
    level,
    count,
    url: issue?.permalink || issue?.url || '',
    severity: blocking ? (level === 'fatal' || isServerFailure ? 'P0' : 'P1') : 'P2',
    blocking,
  };
}

function buildSentryQuery({ release, environment, windowMinutes }) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  return [
    `is:unresolved`,
    `environment:${environment}`,
    `release:${release}`,
    `firstSeen:>${since}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildSentryIssuesPath(config, project) {
  const query = encodeURIComponent(buildSentryQuery(config));
  if (project) {
    return `/api/0/projects/${encodeURIComponent(config.org)}/${encodeURIComponent(
      project
    )}/issues/?query=${query}&limit=100`;
  }
  return `/api/0/organizations/${encodeURIComponent(config.org)}/issues/?query=${query}&limit=100`;
}

async function fetchSentryJson(path, config, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available for Sentry release health.');
  }

  const response = await fetchImpl(`https://sentry.io${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = typeof response.text === 'function' ? await response.text() : '';
    throw new Error(`Sentry release health API failed: ${response.status} ${body}`.trim());
  }

  return response.json();
}

async function fetchReleaseIssues(config, fetchImpl) {
  const projects = config.projects.length > 0 ? config.projects : [null];
  const issueSets = await Promise.all(
    projects.map((project) =>
      fetchSentryJson(buildSentryIssuesPath(config, project), config, fetchImpl)
    )
  );
  return issueSets.flatMap((issues, index) =>
    (Array.isArray(issues) ? issues : []).map((issue) => ({
      ...issue,
      project: projects[index] || issue.project?.slug || issue.project || 'organization',
    }))
  );
}

export async function runSentryReleaseHealth(options = {}) {
  const config = createSentryReleaseHealthConfig(options.env || process.env);
  const issues = await fetchReleaseIssues(config, options.fetchImpl);
  const classifiedIssues = issues.map((issue) =>
    classifySentryIssue(issue, { warningThreshold: config.warningThreshold })
  );
  const blockingIssues = classifiedIssues.filter((issue) => issue.blocking);
  const triageIssues = classifiedIssues.filter((issue) => !issue.blocking);
  const result = {
    release: config.release,
    environment: config.environment,
    windowMinutes: config.windowMinutes,
    issueCount: classifiedIssues.length,
    blockingIssues,
    triageIssues,
  };

  if (blockingIssues.length > 0) {
    const error = new Error(
      `Sentry release health failed with ${blockingIssues.length} blocking issue(s).`
    );
    error.result = result;
    throw error;
  }

  return result;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  runSentryReleaseHealth()
    .then((result) => {
      console.log('Sentry release health passed.');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      if (error.result) {
        console.error(JSON.stringify(error.result, null, 2));
      }
      process.exitCode = 1;
    });
}
