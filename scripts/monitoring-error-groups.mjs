import crypto from 'node:crypto';

const GROUP_HASH_LENGTH = 12;
const MAX_ISSUE_BODY_CHARS = 55_000;

const SOURCE_LABELS = {
  'github-actions': ['automated-error-report', 'ci/cd'],
  railway: ['railway-error'],
};

function toText(value, fallback = '') {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

export function normalizeErrorText(value) {
  const normalized = toText(value, 'unknown-error')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      '<uuid>'
    )
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/gi, '<timestamp>')
    .replace(/\b[0-9a-f]{40}\b/gi, '<sha>')
    .replace(/\bhttps?:\/\/\S+/gi, '<url>')
    .replace(/\b(run|job|attempt|build|deployment|request|trace|span|id)[-_ ]?#?\d+\b/gi, '$1 <id>')
    .replace(/\bline\s+\d+\b/gi, 'line <n>')
    .replace(/\b\d{10,}\b/g, '<number>')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s)\b/gi, '<duration>')
    .replace(/[A-Z]:\\[^\s]+/g, '<path>')
    .replace(/\/home\/runner\/work\/[^\s]+/g, '<path>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return normalized || 'unknown-error';
}

function normalizeFacet(value, fallback) {
  return normalizeErrorText(toText(value, fallback))
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashGroupBasis(parts) {
  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, GROUP_HASH_LENGTH);
}

export function buildMonitoringGroupKey(input) {
  const source = normalizeFacet(input.source, 'unknown-source');
  const area = normalizeFacet(input.area, 'unknown-area');
  const message = normalizeErrorText(input.message);
  const statusCode = normalizeFacet(input.statusCode, 'unknown-status');
  const runtimeMode = normalizeFacet(input.runtimeMode, 'unknown-runtime');
  const hash = hashGroupBasis([source, area, message, statusCode, runtimeMode]);

  return {
    id: hash,
    key: `${source}:${hash}`,
    label: `monitoring-group-${hash}`,
    source,
    area,
    message,
    statusCode,
    runtimeMode,
  };
}

function addGroup(groups, details, occurrence) {
  const groupKey = buildMonitoringGroupKey(details);
  const existing = groups.get(groupKey.key);

  if (existing) {
    existing.occurrences.push(occurrence);
    return existing;
  }

  const group = {
    ...groupKey,
    title: details.title,
    originalMessage: toText(details.message, 'unknown-error'),
    occurrences: [occurrence],
  };
  groups.set(group.key, group);
  return group;
}

function firstParsedError(jobFailure) {
  if (Array.isArray(jobFailure?.errors) && jobFailure.errors.length > 0) {
    return jobFailure.errors[0];
  }

  return null;
}

export function extractGithubFailureGroups(report) {
  const groups = new Map();
  const failures = Array.isArray(report?.failures) ? report.failures : [];

  for (const failure of failures) {
    const jobFailures = Array.isArray(failure?.errors) ? failure.errors : [];

    if (jobFailures.length === 0) {
      addGroup(
        groups,
        {
          source: 'github-actions',
          area: failure?.runName || 'workflow',
          message: `${failure?.runName || 'Workflow'} failed without parsed job logs`,
          statusCode: 'failure',
          runtimeMode: 'ci',
          title: `GitHub Actions: ${failure?.runName || 'Workflow failure'}`,
        },
        {
          runId: failure?.runId,
          runName: failure?.runName,
          branch: failure?.branch,
          commit: failure?.commit,
          url: failure?.htmlUrl,
        }
      );
      continue;
    }

    for (const jobFailure of jobFailures) {
      const parsedError = firstParsedError(jobFailure);
      const area = [
        failure?.runName || 'workflow',
        jobFailure?.jobName || 'job',
        jobFailure?.stepName || 'step',
      ].join(' > ');
      const message =
        parsedError?.line ||
        parsedError?.context ||
        `${failure?.runName || 'Workflow'} / ${jobFailure?.jobName || 'job'} failed`;

      addGroup(
        groups,
        {
          source: 'github-actions',
          area,
          message,
          statusCode: 'failure',
          runtimeMode: 'ci',
          title: `GitHub Actions: ${failure?.runName || 'Workflow'} / ${
            jobFailure?.jobName || 'job'
          }`,
        },
        {
          runId: failure?.runId,
          runName: failure?.runName,
          branch: failure?.branch,
          commit: failure?.commit,
          url: failure?.htmlUrl,
          jobName: jobFailure?.jobName,
          stepName: jobFailure?.stepName,
          lineNumber: parsedError?.lineNumber,
          line: parsedError?.line,
        }
      );
    }
  }

  return Array.from(groups.values());
}

function railwayMessage(entry) {
  if (typeof entry === 'string') {
    return entry;
  }

  return (
    entry?.message ||
    entry?.msg ||
    entry?.error ||
    entry?.level ||
    JSON.stringify(entry ?? { message: 'unknown railway error' })
  );
}

function railwayArea(entry) {
  if (!entry || typeof entry === 'string') {
    return 'railway-runtime';
  }

  return entry.service || entry.component || entry.scope || entry.source || 'railway-runtime';
}

function railwayStatus(entry) {
  if (!entry || typeof entry === 'string') {
    return 'error';
  }

  return entry.statusCode || entry.status || entry.level || 'error';
}

export function extractRailwayLogGroups(entries) {
  const groups = new Map();
  const logs = Array.isArray(entries) ? entries : [];

  for (const entry of logs) {
    const message = railwayMessage(entry);
    const area = railwayArea(entry);

    addGroup(
      groups,
      {
        source: 'railway',
        area,
        message,
        statusCode: railwayStatus(entry),
        runtimeMode: 'production',
        title: `Railway: ${area}`,
      },
      {
        timestamp: typeof entry === 'object' ? entry?.timestamp : undefined,
        message,
        area,
      }
    );
  }

  return Array.from(groups.values());
}

export function buildMonitoringLabels(group) {
  const sourceLabels = SOURCE_LABELS[group.source] || [];
  return [...new Set(['monitoring', ...sourceLabels, group.label])];
}

export function buildMonitoringIssueTitle(group) {
  const sourceTitle = group.source === 'github-actions' ? 'GitHub Actions' : 'Railway';
  const baseTitle = group.title || `${sourceTitle}: ${group.area}`;
  const title = `[monitor:${group.id}] ${baseTitle}`;

  return title.length <= 120 ? title : `${title.slice(0, 117)}...`;
}

function formatOccurrence(occurrence) {
  const parts = [];

  if (occurrence.runName) {
    parts.push(occurrence.runName);
  }
  if (occurrence.jobName) {
    parts.push(occurrence.jobName);
  }
  if (occurrence.stepName) {
    parts.push(occurrence.stepName);
  }
  if (occurrence.commit) {
    parts.push(occurrence.commit);
  }
  if (occurrence.timestamp) {
    parts.push(occurrence.timestamp);
  }

  const summary = parts.length > 0 ? parts.join(' / ') : toText(occurrence.message, 'occurrence');
  return occurrence.url ? `- [${summary}](${occurrence.url})` : `- ${summary}`;
}

export function buildMonitoringIssueBody(group, reportMarkdown, generatedAt = new Date()) {
  const generated = generatedAt instanceof Date ? generatedAt.toISOString() : toText(generatedAt);
  const report = toText(reportMarkdown, 'No markdown report was generated.');
  const trimmedReport =
    report.length > MAX_ISSUE_BODY_CHARS
      ? `${report.slice(0, MAX_ISSUE_BODY_CHARS)}\n\n[report truncated]`
      : report;

  return `<!-- monitoring-group:${group.key} -->
## Monitoring Error Group

- **Group:** \`${group.key}\`
- **Source:** \`${group.source}\`
- **Area:** \`${group.area}\`
- **Status:** active
- **Occurrences in latest report:** ${group.occurrences.length}
- **Last updated:** ${generated}

### Normalized Message

\`\`\`
${group.message}
\`\`\`

### Recent Occurrences

${group.occurrences.slice(0, 10).map(formatOccurrence).join('\n')}

---

${trimmedReport}`;
}
