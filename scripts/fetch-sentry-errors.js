#!/usr/bin/env node
/**
 * Fetch errors from Sentry and save as markdown/JSON reports
 *
 * Environment variables:
 * - SENTRY_AUTH_TOKEN: Personal auth token from https://sentry.io/settings/auth-tokens/
 * - SENTRY_ORG: Organization slug (e.g., 'vatlar')
 * - SENTRY_PROJECT: Project slug (e.g., 'backend') - optional, will fetch from all projects if not set
 * - SENTRY_HOURS_BACK: Hours to look back (default: 6)
 * - OUTPUT_DIR: Output directory for reports (default: './sentry-errors')
 * - VERBOSE: Enable verbose logging (default: false)
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG || 'vatlar';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || undefined;
const SENTRY_HOURS_BACK = parseInt(process.env.SENTRY_HOURS_BACK || '6');
const OUTPUT_DIR = process.env.OUTPUT_DIR || './sentry-errors';
const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === 'true';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Make HTTPS request to Sentry API
 */
function makeSentryRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'sentry.io',
      path,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Sentry API error: ${res.statusCode} - ${data}`));
        } else {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (err) {
            resolve(data);
          }
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Check if Sentry token is valid
 */
async function checkSentryToken() {
  if (!SENTRY_AUTH_TOKEN) {
    console.error('❌ SENTRY_AUTH_TOKEN not set');
    process.exit(1);
  }

  try {
    const result = await makeSentryRequest('/api/0/organizations/');
    if (result && Array.isArray(result)) {
      if (VERBOSE) console.log(`✅ Sentry token valid. Found ${result.length} organizations`);
      return true;
    }
  } catch (err) {
    console.error('❌ Invalid Sentry token:', err.message);
    process.exit(1);
  }
}

/**
 * Get projects from organization
 */
async function getProjects() {
  try {
    const response = await makeSentryRequest(`/api/0/organizations/${SENTRY_ORG}/projects/`);
    return response || [];
  } catch (err) {
    console.error(`❌ Failed to fetch projects: ${err.message}`);
    return [];
  }
}

/**
 * Get recent issues from a project
 */
async function getProjectIssues(projectSlug) {
  try {
    const since = new Date(Date.now() - SENTRY_HOURS_BACK * 3600000).toISOString();
    const query = encodeURIComponent(`is:unresolved firstSeen:>${since.split('T')[0]}`);
    const path = `/api/0/projects/${SENTRY_ORG}/${projectSlug}/issues/?query=${query}&limit=100`;

    if (VERBOSE) console.log(`📊 Fetching issues for ${projectSlug}...`);
    const response = await makeSentryRequest(path);
    return response || [];
  } catch (err) {
    console.error(`⚠️  Failed to fetch issues for ${projectSlug}: ${err.message}`);
    return [];
  }
}

/**
 * Get issue details including latest event
 */
async function getIssueDetails(projectSlug, issueId) {
  try {
    const path = `/api/0/projects/${SENTRY_ORG}/${projectSlug}/issues/${issueId}/events/latest/`;
    return await makeSentryRequest(path);
  } catch (err) {
    if (VERBOSE) console.log(`⚠️  Failed to fetch event for issue ${issueId}: ${err.message}`);
    return null;
  }
}

/**
 * Format errors to markdown
 */
function formatErrorsMarkdown(errors, timestamp) {
  const dateStr = new Date(timestamp).toISOString().split('T')[0];

  let md = `# Sentry Error Report\n\n`;
  md += `**Generated:** ${new Date(timestamp).toISOString()}\n`;
  md += `**Period:** Last ${SENTRY_HOURS_BACK} hours\n`;
  md += `**Organization:** ${SENTRY_ORG}\n\n`;

  if (errors.length === 0) {
    md += `✅ No errors found in the last ${SENTRY_HOURS_BACK} hours\n`;
    return md;
  }

  md += `## Summary\n\n`;
  md += `- **Total Errors:** ${errors.length}\n`;
  md += `- **Time Range:** ${SENTRY_HOURS_BACK} hours\n\n`;

  // Group by project
  const byProject = {};
  errors.forEach((err) => {
    if (!byProject[err.project]) {
      byProject[err.project] = [];
    }
    byProject[err.project].push(err);
  });

  for (const [project, projectErrors] of Object.entries(byProject)) {
    md += `### ${project} (${projectErrors.length} errors)\n\n`;

    projectErrors.forEach((error, idx) => {
      md += `#### ${idx + 1}. ${error.title}\n\n`;
      md += `**Type:** \`${error.type || 'unknown'}\`\n`;
      md += `**Level:** \`${error.level || 'error'}\`\n`;
      md += `**Count:** ${error.count || 1}\n`;
      md += `**First Seen:** ${new Date(error.firstSeen).toISOString()}\n`;
      md += `**Last Seen:** ${new Date(error.lastSeen).toISOString()}\n`;

      if (error.message) {
        md += `\n**Message:**\n\`\`\`\n${error.message.substring(0, 500)}\n\`\`\`\n`;
      }

      if (error.url) {
        md += `\n**Sentry Link:** ${error.url}\n`;
      }

      md += `\n---\n\n`;
    });
  }

  return md;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Fetching Sentry errors...');

    // Validate token
    await checkSentryToken();

    if (!SENTRY_ORG) {
      console.error('❌ SENTRY_ORG not provided');
      process.exit(1);
    }

    // Get projects
    let projects = [];
    if (SENTRY_PROJECT) {
      projects = [{ slug: SENTRY_PROJECT }];
    } else {
      const allProjects = await getProjects();
      projects = allProjects.filter((p) => p.status === 'active');
      if (VERBOSE) console.log(`📦 Found ${projects.length} active projects`);
    }

    if (projects.length === 0) {
      console.log('⚠️  No active projects found');
      process.exit(0);
    }

    // Fetch issues from all projects
    const allErrors = [];
    for (const project of projects) {
      const issues = await getProjectIssues(project.slug);

      for (const issue of issues) {
        const event = await getIssueDetails(project.slug, issue.id);

        allErrors.push({
          id: issue.id,
          project: project.slug,
          title: issue.title || 'Unknown Error',
          type: event?.exception?.[0]?.type || issue.type || 'error',
          level: issue.level || 'error',
          message: event?.message || issue.culprit || '',
          count: issue.count || 1,
          firstSeen: issue.firstSeen,
          lastSeen: issue.lastSeen,
          url: issue.permalink || `https://sentry.io/organizations/${SENTRY_ORG}/issues/${issue.id}/`,
        });
      }
    }

    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];
    const timeStr = timestamp.split('T')[1].split('.')[0].replace(/:/g, '-');

    // Save JSON
    const jsonFileName = `sentry-errors-${dateStr}-${timeStr}.json`;
    const jsonPath = path.join(OUTPUT_DIR, jsonFileName);
    fs.writeFileSync(jsonPath, JSON.stringify(allErrors, null, 2));
    console.log(`📄 Saved JSON: ${jsonFileName}`);

    // Save Markdown
    const mdFileName = `sentry-errors-${dateStr}-${timeStr}.md`;
    const mdPath = path.join(OUTPUT_DIR, mdFileName);
    const markdown = formatErrorsMarkdown(allErrors, timestamp);
    fs.writeFileSync(mdPath, markdown);
    console.log(`📝 Saved Markdown: ${mdFileName}`);

    console.log(`\n✅ Found ${allErrors.length} errors`);
    if (allErrors.length > 0) {
      console.log(`📊 Output: ${OUTPUT_DIR}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
