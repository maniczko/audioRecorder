#!/usr/bin/env node

/**
 * External Services Status Monitor
 *
 * Collects LIVE status from:
 * - GitHub Actions (CI/CD workflow runs, issues, PRs)
 * - Sentry (error tracking, recent issues)
 * - Railway (backend deployment)
 * - Vercel (frontend deployment)
 *
 * Run: node scripts/monitor-external-services.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { parseRailwayDeploymentsPayload, RAILWAY_DEPLOYMENTS_QUERY } from './railway-status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env from project root
config({ path: path.join(rootDir, '.env') });

const OWNER = 'maniczko';
const REPO = 'audioRecorder';

/**
 * Get GitHub data: Actions, Issues, PRs, Repo info
 */
async function getGitHubData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('⚠️  GITHUB_TOKEN not set, using fallback');
    return getFallbackGitHubData();
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const api = async (endpoint) => {
    const res = await fetch(`https://api.github.com${endpoint}`, { headers });
    if (!res.ok) throw new Error(`GitHub ${endpoint}: ${res.status} ${res.statusText}`);
    return res.json();
  };

  try {
    // Parallel fetches
    const [runsData, issuesData, prsData, repoData] = await Promise.all([
      api(`/repos/${OWNER}/${REPO}/actions/runs?per_page=20&status=completed`),
      api(`/repos/${OWNER}/${REPO}/issues?state=open&per_page=30&sort=updated`),
      api(`/repos/${OWNER}/${REPO}/pulls?state=open&per_page=15&sort=updated`),
      api(`/repos/${OWNER}/${REPO}`),
    ]);

    // Workflow runs
    const runs = (runsData.workflow_runs || []).map((r) => ({
      name: r.name,
      status: r.conclusion || r.status,
      branch: r.head_branch,
      created_at: r.created_at,
      updated_at: r.updated_at,
      duration_ms: r.updated_at ? new Date(r.updated_at) - new Date(r.created_at) : 0,
      url: r.html_url,
    }));
    const successRate =
      runs.length > 0
        ? Math.round((runs.filter((r) => r.status === 'success').length / runs.length) * 100)
        : 0;

    // Deduplicate by workflow name (latest run per workflow)
    const latestByWorkflow = {};
    runs.forEach((r) => {
      if (!latestByWorkflow[r.name]) latestByWorkflow[r.name] = r;
    });

    // Issues (filter out PRs — GitHub mixes them)
    const issues = issuesData
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: i.labels.map((l) => l.name),
        created_at: i.created_at,
        updated_at: i.updated_at,
        url: i.html_url,
      }));

    // Pull Requests
    const prs = prsData.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      draft: p.draft,
      author: p.user?.login,
      created_at: p.created_at,
      updated_at: p.updated_at,
      url: p.html_url,
    }));

    // Local workflow files
    const localWorkflows = getLocalWorkflowFiles();

    return {
      status: 'connected',
      repo: {
        full_name: repoData.full_name,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        open_issues: repoData.open_issues_count,
        default_branch: repoData.default_branch,
        language: repoData.language,
        updated_at: repoData.updated_at,
      },
      actions: {
        recent_runs: runs,
        latest_by_workflow: Object.values(latestByWorkflow),
        total_runs: runsData.total_count || 0,
        success_rate: successRate,
        last_run: runs[0] ? runs[0].updated_at : null,
      },
      issues: {
        open: issues,
        total_open: issues.length,
      },
      pull_requests: {
        open: prs,
        total_open: prs.length,
        draft: prs.filter((p) => p.draft).length,
      },
      local_workflows: localWorkflows,
    };
  } catch (error) {
    console.error('⚠️  GitHub API error:', error.message);
    return getFallbackGitHubData();
  }
}

function getLocalWorkflowFiles() {
  try {
    const dir = path.join(rootDir, '.github', 'workflows');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f) => f.replace(/\.ya?ml$/, ''));
  } catch {
    return [];
  }
}

function getFallbackGitHubData() {
  return {
    status: 'local-only',
    local_workflows: getLocalWorkflowFiles(),
    actions: {
      recent_runs: [],
      latest_by_workflow: [],
      total_runs: 0,
      success_rate: 0,
      last_run: null,
    },
    issues: { open: [], total_open: 0 },
    pull_requests: { open: [], total_open: 0, draft: 0 },
    note: 'Set GITHUB_TOKEN to get live status',
  };
}

/**
 * Get Sentry status and recent issues
 */
async function getSentryStatus() {
  const dsn = process.env.SENTRY_DSN;
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  // Check if DSN exists in .env even if not loaded
  let hasDsn = !!dsn;
  if (!hasDsn) {
    try {
      const envPath = path.join(rootDir, '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const m = content.match(/^SENTRY_DSN=(.+)$/m);
        if (m && m[1] && !m[1].startsWith('#') && m[1].trim().length > 0) hasDsn = true;
      }
    } catch {}
  }

  if (!authToken || !org || !project) {
    return {
      status: hasDsn ? 'configured' : 'not-configured',
      configured: hasDsn,
      has_dsn: hasDsn,
      issues: [],
      stats: null,
      note: 'Set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in .env to get live error data',
    };
  }

  // Fetch real Sentry data
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    const api = async (endpoint) => {
      const res = await fetch(`https://sentry.io/api/0${endpoint}`, { headers });
      if (!res.ok) throw new Error(`Sentry ${endpoint}: ${res.status}`);
      return res.json();
    };

    const [issues, stats] = await Promise.all([
      api(`/projects/${org}/${project}/issues/?query=is:unresolved&sort=date&limit=20`),
      api(
        `/projects/${org}/${project}/stats/?stat=received&resolution=1d&since=${Math.floor(Date.now() / 1000) - 7 * 86400}`
      ),
    ]);

    return {
      status: 'connected',
      configured: true,
      has_dsn: true,
      issues: issues.map((i) => ({
        id: i.id,
        title: i.title,
        culprit: i.culprit,
        level: i.level,
        count: i.count,
        userCount: i.userCount,
        firstSeen: i.firstSeen,
        lastSeen: i.lastSeen,
        url: i.permalink,
      })),
      stats: {
        events_7d: stats.reduce((a, [, v]) => a + v, 0),
        daily: stats.map(([ts, v]) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          events: v,
        })),
      },
      total_unresolved: issues.length,
    };
  } catch (error) {
    console.error('⚠️  Sentry API error:', error.message);
    return {
      status: 'error',
      configured: true,
      has_dsn: true,
      error: error.message,
      issues: [],
      stats: null,
    };
  }
}

/**
 * Get Railway deployment status
 * Railway doesn't have a simple public API, so we check local config
 */
async function getRailwayStatus() {
  try {
    // Check for Railway config files
    const railwayJson = path.join(rootDir, 'railway.json');
    const railwayToml = path.join(rootDir, 'railway.toml');
    const hasConfig = fs.existsSync(railwayJson) || fs.existsSync(railwayToml);
    // Check for Railway environment variables
    const hasRailwayEnv = !!(process.env.RAILWAY_TOKEN && process.env.RAILWAY_PROJECT_ID);

    if (!hasConfig && !hasRailwayEnv) {
      return {
        status: 'not-configured',
        configured: false,
        deployments: [],
      };
    }

    if (!hasRailwayEnv) {
      return {
        status: hasConfig ? 'config-only' : 'not-configured',
        configured: true,
        has_token: false,
        deployments: [],
        last_deployment: null,
        note: 'Set RAILWAY_TOKEN and RAILWAY_PROJECT_ID to get deployment status',
      };
    }

    // Fetch deployments from Railway API
    const token = process.env.RAILWAY_TOKEN;
    const projectId = process.env.RAILWAY_PROJECT_ID;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const api = async (query, variables = {}) => {
      const res = await fetch(`https://backboard.railway.app/graphql/v2`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables })
      });
      if (!res.ok) throw new Error(`Railway API: ${res.status}`);
      return res.json();
    };

    let deployments = [];
    let lastDeployment = null;
    let note;
    let apiError = null;
    try {
      const data = await api(RAILWAY_DEPLOYMENTS_QUERY, { input: { projectId } });
      const parsed = parseRailwayDeploymentsPayload(data);
      deployments = parsed.deployments;
      lastDeployment = parsed.lastDeployment;
      note = parsed.note;
      apiError = parsed.apiError;
    } catch (e) {
      deployments = [];
      lastDeployment = null;
      note = `Railway API request failed: ${e.message}`;
      apiError = e.message;
    }

    return {
      status: deployments.length > 0 ? 'connected' : 'configured',
      configured: true,
      has_token: true,
      deployments,
      last_deployment: lastDeployment,
      note,
      api_error: apiError,
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

/**
 * Get Vercel deployment status
 * Checks vercel.json and deployment history
 */
async function getVercelStatus() {
  try {
    const vercelJson = path.join(rootDir, 'vercel.json');
    if (!fs.existsSync(vercelJson)) {
      return {
        status: 'not-configured',
        configured: false,
        deployments: [],
      };
    }
    const vercelConfig = JSON.parse(fs.readFileSync(vercelJson, 'utf-8'));
    const hasVercelEnv = !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
    if (!hasVercelEnv) {
      return {
        status: 'configured',
        configured: true,
        has_token: false,
        project_name: vercelConfig.name || 'audioRecorder',
        framework: vercelConfig.framework || 'vite',
        last_deployment: null,
        deployments: [],
        note: 'Set VERCEL_TOKEN to get deployment status',
      };
    }
    // Fetch deployments from Vercel API
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    const headers = { Authorization: `Bearer ${token}` };
    const api = async (endpoint) => {
      const res = await fetch(`https://api.vercel.com${endpoint}`, { headers });
      if (!res.ok) throw new Error(`Vercel ${endpoint}: ${res.status}`);
      return res.json();
    };
    let deployments = [];
    let lastDeployment = null;
    let stats = null;
    try {
      // Pobierz do 100 ostatnich deploymentów z 7 dni
      const since = Date.now() - 7 * 86400 * 1000;
      const data = await api(`/v6/deployments?projectId=${projectId}&limit=100`);
      deployments = (data.deployments || []).map((d) => ({
        uid: d.uid,
        name: d.name,
        url: d.url,
        state: d.state,
        meta: d.meta,
        created: d.created,
        createdAt: d.createdAt,
        ready: d.ready,
        buildingAt: d.buildingAt,
        error: d.error,
        creator: d.creator,
        inspectorUrl: d.inspectorUrl,
      }));
      lastDeployment = deployments[0] || null;
      // Statystyki deploymentów na dzień (ostatnie 7 dni)
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(Date.now() - (6 - i) * 86400 * 1000);
        return d.toISOString().split('T')[0];
      });
      const daily = days.map((date) => ({
        date,
        deployments: deployments.filter((dep) => {
          const depDate = new Date(dep.createdAt || dep.created).toISOString().split('T')[0];
          return depDate === date;
        }).length,
      }));
      stats = {
        deployments_7d: deployments.filter((dep) => (dep.createdAt || dep.created) >= since).length,
        daily,
      };
    } catch (e) {
      deployments = [];
      lastDeployment = null;
      stats = null;
    }
    return {
      status: deployments.length > 0 ? 'connected' : 'configured',
      configured: true,
      has_token: true,
      project_name: vercelConfig.name || 'audioRecorder',
      framework: vercelConfig.framework || 'vite',
      last_deployment: lastDeployment,
      deployments,
      stats,
      note: deployments.length > 0 ? undefined : 'No deployments found or API error',
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🌐 Monitoring External Services...\n');

  const services = {
    github: await getGitHubData(),
    sentry: await getSentryStatus(),
    railway: await getRailwayStatus(),
    vercel: await getVercelStatus(),
    timestamp: new Date().toISOString(),
  };

  // Write to file
  const outputPath = path.join(rootDir, 'scripts', 'external-services.json');
  fs.writeFileSync(outputPath, JSON.stringify(services, null, 2));

  console.log('✓ External services status saved to: scripts/external-services.json');
  console.log('\n📊 Summary:');
  console.log(`   GitHub Actions: ${services.github.status}`);
  console.log(`   Sentry: ${services.sentry.status}`);
  console.log(`   Railway: ${services.railway.status}`);
  console.log(`   Vercel: ${services.vercel.status}`);

  // Also append to test-results.json
  const testResultsPath = path.join(rootDir, 'scripts', 'test-results.json');
  if (fs.existsSync(testResultsPath)) {
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));
    testResults.external_services = services;
    fs.writeFileSync(testResultsPath, JSON.stringify(testResults, null, 2));
    console.log('\n✓ Merged with test-results.json');
  }

  // Also create embedded JS version
  const jsPath = path.join(rootDir, 'scripts', 'external-services.js');
  const jsContent = `// Auto-generated external services data - DO NOT EDIT\n// Generated by monitor-external-services.js at ${new Date().toISOString()}\nwindow.EXTERNAL_SERVICES_DATA = ${JSON.stringify(services, null, 2)};\n`;
  fs.writeFileSync(jsPath, jsContent);
  console.log('✓ Created embedded JS: scripts/external-services.js');
}

main().catch((error) => {
  console.error('❌ Error monitoring services:', error);
  process.exit(1);
});
