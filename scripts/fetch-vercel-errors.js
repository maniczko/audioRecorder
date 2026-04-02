#!/usr/bin/env node

/**
 * Vercel Error Log Fetcher
 *
 * Automatically fetches deployment error logs from Vercel
 * and generates error reports.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  outputDir: process.env.OUTPUT_DIR || './vercel-errors',
  token: process.env.VERCEL_TOKEN,
  projectId: process.env.VERCEL_PROJECT_ID || 'audiorecorder',
  verbose: process.argv.includes('--verbose'),
  hoursBack: parseInt(process.env.VERCEL_HOURS_BACK || '24', 10),
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  if (config.verbose) console.log(`📁 Created output directory: ${config.outputDir}`);
}

// Helper to make HTTPS requests
function makeVercelRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'api.vercel.com',
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'User-Agent': 'audioRecorder-error-monitor/1.0',
        ...options.headers,
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Vercel API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Check if Vercel token is available
function checkVercelToken() {
  if (!config.token) {
    console.error('❌ VERCEL_TOKEN environment variable not set');
    console.error('   Add VERCEL_TOKEN to GitHub Secrets');
    return false;
  }
  if (config.verbose) console.log('✅ Vercel token is available');
  return true;
}

// Get project deployments
async function getDeployments() {
  try {
    if (config.verbose) console.log(`🔍 Fetching deployments from project: ${config.projectId}`);

    const response = await makeVercelRequest(`/v6/deployments?projectId=${config.projectId}&limit=50`);

    if (!response.deployments) {
      console.warn('⚠️  No deployments found');
      return [];
    }

    // Filter by time
    const cutoffTime = Date.now() - (config.hoursBack * 60 * 60 * 1000);
    return response.deployments.filter(d => new Date(d.created).getTime() > cutoffTime);
  } catch (error) {
    console.error('❌ Failed to fetch deployments:', error.message);
    return [];
  }
}

// Get deployment logs
async function getDeploymentLogs(deploymentId) {
  try {
    const response = await makeVercelRequest(`/v3/deployments/${deploymentId}/events`);

    if (!response) return [];

    // Extract error events
    return response
      .filter(event => event.type === 'error' || event.text?.includes('error'))
      .map(event => ({
        timestamp: event.timestamp || new Date().toISOString(),
        type: event.type,
        text: event.text,
        deploymentId,
      }));
  } catch (error) {
    if (config.verbose) console.warn(`⚠️  Could not fetch logs for ${deploymentId}:`, error.message);
    return [];
  }
}

// Format errors into markdown
function formatErrorsMarkdown(errors, deployments) {
  const now = new Date().toISOString();
  let markdown = `# Vercel Errors Report\n\n`;
  markdown += `**Generated:** ${now}\n`;
  markdown += `**Time Range:** Last ${config.hoursBack} hours\n`;
  markdown += `**Project:** ${config.projectId}\n\n`;

  if (errors.length === 0) {
    markdown += `✅ **No errors found in the last ${config.hoursBack} hours**\n`;
    return markdown;
  }

  markdown += `## Summary\n\n`;
  markdown += `- **Total Errors:** ${errors.length}\n`;
  markdown += `- **Deployments Checked:** ${deployments.length}\n\n`;

  // Group by deployment
  const grouped = {};
  errors.forEach(error => {
    if (!grouped[error.deploymentId]) grouped[error.deploymentId] = [];
    grouped[error.deploymentId].push(error);
  });

  markdown += `## Errors by Deployment\n\n`;

  for (const [depId, depErrors] of Object.entries(grouped)) {
    const deployment = deployments.find(d => d.id === depId);
    const branch = deployment?.meta?.githubBranch || 'unknown';
    const commit = deployment?.meta?.githubCommitSha?.substring(0, 7) || 'unknown';

    markdown += `### ${depId}\n`;
    markdown += `- **Branch:** ${branch}\n`;
    markdown += `- **Commit:** ${commit}\n`;
    markdown += `- **Errors:** ${depErrors.length}\n\n`;

    depErrors.forEach((error, i) => {
      markdown += `**Error ${i + 1}:**\n`;
      markdown += `\`\`\`\n${error.text}\n\`\`\`\n`;
      markdown += `_${new Date(error.timestamp).toISOString()}_\n\n`;
    });
  }

  return markdown;
}

// Main function
async function main() {
  console.log('🔍 Vercel Error Monitor\n');

  if (!checkVercelToken()) {
    process.exit(1);
  }

  const deployments = await getDeployments();
  if (deployments.length === 0) {
    console.log('ℹ️  No recent deployments found');
    return;
  }

  console.log(`✅ Found ${deployments.length} deployments from last ${config.hoursBack}h\n`);

  // Fetch logs for each deployment
  // Vercel API v6 returns uid (not id) as the deployment identifier
  let allErrors = [];
  for (const deployment of deployments) {
    const deploymentId = deployment.uid || deployment.id;
    if (config.verbose) console.log(`📋 Fetching logs for ${(deploymentId || '').substring(0, 8)}...`);
    const logs = await getDeploymentLogs(deploymentId);
    allErrors = allErrors.concat(logs);
  }

  if (allErrors.length === 0) {
    console.log('✅ No errors found!');
    return;
  }

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdFile = path.join(config.outputDir, `vercel-errors-${timestamp}.md`);
  const jsonFile = path.join(config.outputDir, `vercel-errors-${timestamp}.json`);

  const markdown = formatErrorsMarkdown(allErrors, deployments);
  fs.writeFileSync(mdFile, markdown);
  fs.writeFileSync(jsonFile, JSON.stringify(allErrors, null, 2));

  console.log(`\n✅ Vercel errors report generated:`);
  console.log(`   📄 Markdown: ${mdFile}`);
  console.log(`   📊 JSON: ${jsonFile}`);
  console.log(`   🔴 Total errors: ${allErrors.length}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
