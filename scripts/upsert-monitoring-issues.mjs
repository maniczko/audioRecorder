#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildMonitoringIssueBody,
  buildMonitoringIssueTitle,
  buildMonitoringLabels,
  extractGithubFailureGroups,
  extractRailwayLogGroups,
} from './monitoring-error-groups.mjs';

function readArgs(argv) {
  const args = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    const value = argv[index + 1]?.startsWith('--') ? 'true' : argv[index + 1] || 'true';
    args.set(key, value);

    if (value !== 'true') {
      index += 1;
    }
  }

  return args;
}

function latestFile(dir, extension) {
  if (!fs.existsSync(dir)) {
    return null;
  }

  const files = fs
    .readdirSync(dir)
    .filter((entry) => entry.endsWith(extension))
    .sort()
    .reverse();

  return files[0] ? path.join(dir, files[0]) : null;
}

function readJsonFile(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTextFile(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) {
    return fallback;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function getRepositoryConfig() {
  const [ownerFromRepo, repoFromRepo] = (process.env.GITHUB_REPOSITORY || '').split('/');

  return {
    owner: process.env.GITHUB_OWNER || ownerFromRepo || 'maniczko',
    repo: process.env.GITHUB_REPO || repoFromRepo || 'audioRecorder',
    token: process.env.GITHUB_TOKEN,
  };
}

function githubApiUrl(owner, repo, endpoint) {
  return `https://api.github.com/repos/${owner}/${repo}${endpoint}`;
}

async function githubRequest(config, endpoint, options = {}) {
  const response = await fetch(githubApiUrl(config.owner, config.repo, endpoint), {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'User-Agent': 'voicelog-monitoring-upsert',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || response.statusText;
    throw new Error(`GitHub API ${response.status} for ${endpoint}: ${message}`);
  }

  return payload;
}

async function ensureLabel(config, name) {
  try {
    await githubRequest(config, `/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    if (!String(error.message).includes('GitHub API 404')) {
      throw error;
    }

    await githubRequest(config, '/labels', {
      method: 'POST',
      body: JSON.stringify({
        name,
        color: name.startsWith('monitoring-group-') ? '5319e7' : '0e8a16',
        description: name.startsWith('monitoring-group-')
          ? 'Stable monitoring error group'
          : 'Monitoring automation',
      }),
    });
  }
}

async function findExistingIssue(config, groupLabel) {
  const query = new URLSearchParams({
    state: 'open',
    labels: groupLabel,
    per_page: '10',
  });
  const issues = await githubRequest(config, `/issues?${query.toString()}`);

  return Array.isArray(issues) ? issues.find((issue) => !issue.pull_request) : null;
}

async function upsertIssue(config, group, markdownReport) {
  const labels = buildMonitoringLabels(group);

  for (const label of labels) {
    await ensureLabel(config, label);
  }

  const title = buildMonitoringIssueTitle(group);
  const body = buildMonitoringIssueBody(group, markdownReport);
  const existingIssue = await findExistingIssue(config, group.label);

  if (existingIssue) {
    await githubRequest(config, `/issues/${existingIssue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, body, labels }),
    });
    console.log(`Updated monitoring issue #${existingIssue.number} for ${group.key}`);
    return;
  }

  const created = await githubRequest(config, '/issues', {
    method: 'POST',
    body: JSON.stringify({ title, body, labels }),
  });
  console.log(`Created monitoring issue #${created.number} for ${group.key}`);
}

function extractGroups(provider, jsonReport) {
  if (provider === 'github-actions') {
    return extractGithubFailureGroups(jsonReport);
  }

  if (provider === 'railway') {
    return extractRailwayLogGroups(jsonReport);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function runUpsertMonitoringIssues({
  provider,
  reportsDir,
  repositoryConfig = getRepositoryConfig(),
}) {
  if (!repositoryConfig.token) {
    console.log('No GITHUB_TOKEN provided, skipping monitoring issue upsert.');
    return { skipped: true, groups: [] };
  }

  const jsonPath = latestFile(reportsDir, '.json');
  const markdownPath = latestFile(reportsDir, '.md');
  const jsonReport = readJsonFile(jsonPath, provider === 'railway' ? [] : {});
  const markdownReport = readTextFile(markdownPath, 'No markdown report was generated.');
  const groups = extractGroups(provider, jsonReport);

  if (groups.length === 0) {
    console.log(`No active ${provider} monitoring groups found.`);
    return { skipped: false, groups };
  }

  for (const group of groups) {
    await upsertIssue(repositoryConfig, group, markdownReport);
  }

  return { skipped: false, groups };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const provider = args.get('provider') || 'github-actions';
  const reportsDir =
    args.get('reports-dir') || (provider === 'railway' ? 'railway-errors' : 'github-errors');

  await runUpsertMonitoringIssues({ provider, reportsDir });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
