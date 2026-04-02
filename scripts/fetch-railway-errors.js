#!/usr/bin/env node

/**
 * Railway Error Log Fetcher
 *
 * Automatically fetches error logs from Railway deployments
 * and generates error reports.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  outputDir: process.env.OUTPUT_DIR || './railway-errors',
  lines: parseInt(process.env.RAILWAY_LOG_LINES || '100', 10),
  filter: process.env.RAILWAY_LOG_FILTER || '@level:error',
  verbose: process.argv.includes('--verbose'),
  json: process.argv.includes('--json'),
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`📁 Created output directory: ${config.outputDir}`);
}

// Helper to run railway CLI commands
function runRailwayCommand(args) {
  try {
    // RAILWAY_PROJECT_ID is picked up automatically by Railway CLI via env var
    // Do NOT append --project flag — it is not supported by all railway commands (e.g. logs)
    const cmd = `railway ${args}`.trim();

    if (config.verbose) {
      console.log(`Executing: ${cmd}`);
    }

    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.status === 1 && error.stdout) {
      return error.stdout;
    }
    throw new Error(`Railway command failed: ${error.message}`);
  }
}

// Check if Railway CLI is available and logged in
function checkRailwayCLI() {
  try {
    // Railway CLI auto-authenticates using RAILWAY_TOKEN env var — no need to check whoami
    if (process.env.RAILWAY_TOKEN) {
      console.log('✅ Railway CLI will authenticate via RAILWAY_TOKEN');
      return true;
    }
    const whoami = runRailwayCommand('whoami');
    if (whoami && whoami.length > 0) {
      console.log('✅ Railway CLI is available and logged in');
      return true;
    }
    console.error('❌ Not logged in to Railway. Set RAILWAY_TOKEN env var');
    return false;
  } catch (error) {
    console.error('❌ Railway CLI not available');
    console.error('   Install: npm i -g @railway/cli');
    return false;
  }
}

// Link to project
function linkToProject(projectName) {
  const finalProject = projectName || process.env.RAILWAY_PROJECT_ID || 'audioRecorder';
  try {
    console.log(`🔗 Linking to project: ${finalProject}`);
    // Use echo to pipe the project name to railway link
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
      cmd = `echo ${finalProject} | railway link`;
    } else {
      cmd = `echo "${finalProject}" | railway link`;
    }
    execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    console.log('✅ Linked to project');
    return true;
  } catch (error) {
    // Check if already linked
    if (error.stdout && error.stdout.includes('already linked')) {
      console.log('✅ Already linked to project');
      return true;
    }
    console.error('⚠️  Could not link to project automatically');
    console.error('   Run manually: railway link');
    return false;
  }
}

// Fetch error logs
function fetchErrorLogs() {
  console.log('🚂 Fetching error logs from Railway...\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(config.outputDir, `railway-errors-${timestamp}.md`);
  const jsonFile = path.join(config.outputDir, `railway-errors-${timestamp}.json`);

  let logs = '';
  let jsonLogs = [];
  let deploymentInfo = '';

  try {
    // Fetch all recent logs — railway CLI does not support --filter flag
    // Filter for errors in Node.js after fetching
    console.log(`📊 Fetching last ${config.lines} log lines...`);
    logs = runRailwayCommand(`logs --lines ${config.lines}`);

    // Parse logs if JSON requested
    if (config.json) {
      try {
        jsonLogs = logs
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return { message: line, timestamp: new Date().toISOString() };
            }
          });
      } catch (error) {
        console.error('⚠️  Could not parse logs as JSON');
      }
    }
  } catch (error) {
    if (error.message.includes('No logs found')) {
      console.log('ℹ️  No error logs found in the specified time range');
      logs = 'No error logs found in the specified time range';
    } else if (error.message.includes('No linked project')) {
      console.error('❌ Project not linked. Please run: railway link');
      logs = 'Error: Project not linked. Please run `railway link` first.';
    } else {
      console.error(`⚠️  Error fetching logs: ${error.message}`);
      logs = `Error fetching logs: ${error.message}`;
    }
  }

  // Also fetch recent deployment info
  try {
    console.log('📋 Fetching deployment info...');
    deploymentInfo = runRailwayCommand('deployment list --json');
  } catch (error) {
    deploymentInfo = 'Could not fetch deployment info - project not linked?';
  }

  // Generate markdown report
  let report = `# Railway Error Logs

**Generated:** ${new Date().toISOString()}
**Filter:** ${config.filter}
**Lines:** ${config.lines}

## Error Logs

\`\`\`
${logs}
\`\`\`

## Deployment Info

\`\`\`json
${deploymentInfo}
\`\`\`

## Health Check

`;

  // Add health check
  try {
    const healthUrl = 'https://audiorecorder-production.up.railway.app/health';
    const healthCmd = `curl -s ${healthUrl}`;
    const health = execSync(healthCmd, { encoding: 'utf-8' });
    report += `\`\`\`json\n${health}\n\`\`\`\n`;
  } catch (error) {
    report += `❌ Health check failed: ${error.message}\n`;
  }

  // Write markdown report
  fs.writeFileSync(outputFile, report);
  console.log(`📝 Written markdown report: ${outputFile}`);

  // Always write JSON report so the workflow Parse step can read it
  // Filter logs to only error-related lines (since we can't use --filter flag)
  const errorKeywords = [
    'error',
    'Error',
    'ERROR',
    'fatal',
    'FATAL',
    'warn',
    'WARN',
    'failed',
    'Failed',
  ];
  const isErrorLine = (line) => errorKeywords.some((k) => line.includes(k));
  const errorLines = logs
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#') && isErrorLine(line));

  const errorsToSave =
    jsonLogs.length > 0
      ? jsonLogs
      : errorLines.length > 0
        ? errorLines.map((line) => ({ message: line.trim(), timestamp: new Date().toISOString() }))
        : [];

  if (errorsToSave.length > 0) {
    fs.writeFileSync(jsonFile, JSON.stringify(errorsToSave, null, 2));
    console.log(`📊 Written JSON report: ${jsonFile} (${errorsToSave.length} error lines)`);
    console.log(`📊 Found ${errorsToSave.length} error/failure lines`);
  } else {
    console.log('ℹ️  No error lines found in Railway logs');
  }

  return { outputFile, jsonFile: config.json ? jsonFile : null, logs };
}

// Main function
async function main() {
  console.log('🚂 Railway Error Log Fetcher\n');

  // Check Railway CLI
  if (!checkRailwayCLI()) {
    process.exit(1);
  }

  // Link to project
  linkToProject();

  // Fetch logs
  const result = fetchErrorLogs();

  console.log('\n✅ Done!');
  console.log(`📁 Reports saved to: ${config.outputDir}`);

  // Print summary
  if (result.logs && result.logs.length > 0) {
    const errorCount = result.logs
      .split('\n')
      .filter(
        (line) =>
          line.toLowerCase().includes('error') ||
          line.toLowerCase().includes('fail') ||
          line.toLowerCase().includes('exception')
      ).length;
    console.log(`📊 Found ${errorCount} error/failure lines`);
  }
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export { fetchErrorLogs, checkRailwayCLI, linkToProject };
