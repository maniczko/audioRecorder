#!/usr/bin/env node

/**
 * GitHub Actions Error Fetcher
 *
 * Automatically fetches failed workflow runs from GitHub Actions
 * and generates error reports.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.local FIRST (takes precedence)
dotenv.config({ path: '.env.local' });
// Then load .env as fallback
dotenv.config();

// Configuration
const config = {
  owner: process.env.GITHUB_OWNER || 'maniczko',
  repo: process.env.GITHUB_REPO || 'audioRecorder',
  token: process.env.GITHUB_TOKEN,
  outputDir: process.env.OUTPUT_DIR || './github-errors',
  daysBack: parseInt(process.env.DAYS_BACK || '7', 10),
  verbose: process.argv.includes('--verbose'),
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`📁 Created output directory: ${config.outputDir}`);
}

// GitHub API helper
function githubRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${config.owner}/${config.repo}${endpoint}`,
      method: 'GET',
      headers: {
        'User-Agent': 'github-error-fetcher',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    if (config.token) {
      options.headers['Authorization'] = `token ${config.token}`;
    }

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
            headers: res.headers,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Fetch workflow runs
async function fetchWorkflowRuns() {
  console.log('🔍 Fetching workflow runs...');

  const since = new Date();
  since.setDate(since.getDate() - config.daysBack);

  const endpoint = `/actions/runs?per_page=100&created=>=${since.toISOString()}`;
  const response = await githubRequest(endpoint);

  if (response.status !== 200) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.data.workflow_runs;
}

// Fetch job logs
async function fetchJobLogs(jobId, jobName) {
  console.log(`  📄 Fetching logs for job: ${jobName}`);

  const endpoint = `/actions/jobs/${jobId}/logs`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${config.owner}/${config.repo}${endpoint}`,
      method: 'GET',
      headers: {
        'User-Agent': 'github-error-fetcher',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    if (config.token) {
      options.headers['Authorization'] = `token ${config.token}`;
    }

    const req = https.request(options, (res) => {
      // GitHub returns 302 redirect to S3 URL for logs
      if (res.statusCode === 302 && res.headers.location) {
        // Follow the redirect to S3
        const redirectUrl = new URL(res.headers.location);
        https.get(redirectUrl, (s3Res) => {
          let data = '';
          s3Res.on('data', (chunk) => data += chunk);
          s3Res.on('end', () => {
            if (s3Res.statusCode !== 200) {
              console.log(`  ⚠️  Failed to fetch logs: ${s3Res.statusCode}`);
              resolve(null);
            } else {
              resolve({ jobId, logs: data });
            }
          });
        }).on('error', (error) => {
          console.log(`  ⚠️  Redirect error: ${error.message}`);
          resolve(null);
        });
      } else if (res.statusCode !== 200) {
        console.log(`  ⚠️  Failed to fetch logs: ${res.statusCode}`);
        resolve(null);
      } else {
        // Logs are returned as raw text, not JSON
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          resolve({ jobId, logs: data });
        });
      }
    });

    req.on('error', (error) => {
      console.log(`  ⚠️  Request error: ${error.message}`);
      resolve(null);
    });

    req.end();
  });
}

// Parse error from logs
function parseErrors(logs) {
  const errors = [];
  const lines = logs.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for error patterns
    if (
      line.includes('Error:') ||
      line.includes('ERROR') ||
      line.includes('❌') ||
      line.includes('FAILED')
    ) {
      // Get context (5 lines before and after)
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 5);
      const context = lines.slice(start, end).join('\n');

      errors.push({
        line: line.trim(),
        context: context,
        lineNumber: i + 1,
      });
    }
  }

  return errors;
}

// Generate error report
function generateReport(runs, jobs, logs) {
  const report = {
    generated: new Date().toISOString(),
    repository: `${config.owner}/${config.repo}`,
    period: `${config.daysBack} days`,
    summary: {
      totalRuns: runs.length,
      failedRuns: runs.filter((r) => r.conclusion === 'failure').length,
      cancelledRuns: runs.filter((r) => r.conclusion === 'cancelled').length,
      successfulRuns: runs.filter((r) => r.conclusion === 'success').length,
    },
    failures: [],
  };

  // Process failed runs
  const failedRuns = runs.filter((r) => r.conclusion === 'failure');

  for (const run of failedRuns) {
    const runJobs = jobs.filter((j) => j.run_id === run.id);
    const runErrors = [];

    for (const job of runJobs) {
      if (job.conclusion === 'failure') {
        const jobLogs = logs.find((l) => l.jobId === job.id);

        if (jobLogs && typeof jobLogs.logs === 'string') {
          const errors = parseErrors(jobLogs.logs);

          runErrors.push({
            jobId: job.id,
            jobName: job.name,
            stepName: job.steps?.find((s) => s.conclusion === 'failure')?.name || 'Unknown',
            errors: errors,
          });
        }
      }
    }

    report.failures.push({
      runId: run.id,
      runName: run.name || run.workflow_id,
      branch: run.head_branch,
      commit: run.head_sha.substring(0, 7),
      createdAt: run.created_at,
      htmlUrl: run.html_url,
      errors: runErrors,
    });
  }

  return report;
}

// Save report to file
function saveReport(report) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `github-errors-${timestamp}.json`;
  const filepath = path.join(config.outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${filepath}`);

  // Also save markdown summary
  const mdFilename = `github-errors-${timestamp}.md`;
  const mdFilepath = path.join(config.outputDir, mdFilename);

  let markdown = `# GitHub Actions Error Report\n\n`;
  markdown += `**Repository:** ${config.owner}/${config.repo}\n`;
  markdown += `**Generated:** ${report.generated}\n`;
  markdown += `**Period:** Last ${config.daysBack} days\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `| Metric | Count |\n`;
  markdown += `|--------|-------|\n`;
  markdown += `| Total Runs | ${report.summary.totalRuns} |\n`;
  markdown += `| Failed Runs | ${report.summary.failedRuns} |\n`;
  markdown += `| Cancelled Runs | ${report.summary.cancelledRuns} |\n`;
  markdown += `| Successful Runs | ${report.summary.successfulRuns} |\n\n`;

  if (report.failures.length > 0) {
    markdown += `## Failures\n\n`;

    for (const failure of report.failures) {
      markdown += `### ${failure.runName}\n\n`;
      markdown += `- **Branch:** ${failure.branch}\n`;
      markdown += `- **Commit:** ${failure.commit}\n`;
      markdown += `- **Time:** ${failure.createdAt}\n`;
      markdown += `- **URL:** ${failure.htmlUrl}\n\n`;

      for (const error of failure.errors) {
        markdown += `#### Job: ${error.jobName}\n`;
        markdown += `**Step:** ${error.stepName}\n\n`;

        if (error.errors.length > 0) {
          markdown += `**Errors:**\n\n`;

          for (const err of error.errors) {
            markdown += `\`\`\`\n`;
            markdown += `Line ${err.lineNumber}: ${err.line}\n`;
            markdown += `\`\`\`\n\n`;
          }
        }
      }

      markdown += `---\n\n`;
    }
  } else {
    markdown += `## ✅ No Failures\n\n`;
    markdown += `All workflow runs succeeded in the last ${config.daysBack} days!\n\n`;
  }

  fs.writeFileSync(mdFilepath, markdown);
  console.log(`📝 Markdown report saved to: ${mdFilepath}`);

  return { json: filepath, markdown: mdFilepath };
}

// Create GitHub issue with error report
async function createIssue(report, files) {
  if (!config.token) {
    console.log('⚠️  No GitHub token provided, skipping issue creation');
    return;
  }

  console.log('\n📋 Creating GitHub issue...');

  const issueBody = `
## GitHub Actions Error Report

**Generated:** ${report.generated}
**Period:** Last ${config.daysBack} days

### Summary

| Metric | Count |
|--------|-------|
| Total Runs | ${report.summary.totalRuns} |
| Failed Runs | ${report.summary.failedRuns} |
| Cancelled Runs | ${report.summary.cancelledRuns} |
| Successful Runs | ${report.summary.successfulRuns} |

${report.failures.length > 0
      ? `
### Failed Workflows

${report.failures.map((f) => `- [${f.runName}](${f.htmlUrl}) - ${f.commit}`).join('\n')}
`
      : `
### ✅ All workflows passed!
`
    }

### Attachments

- JSON Report: \`${files.json}\`
- Markdown Report: \`${files.markdown}\`

---
*This issue was automatically generated by GitHub Error Fetcher*
`;

  const endpoint = `/repos/${config.owner}/${config.repo}/issues`;
  const response = await githubRequest(endpoint);

  // Note: This is a simplified version, full implementation would POST the issue
  console.log('ℹ️  Issue creation would be implemented here');
}

// Main function
async function main() {
  console.log('🚀 GitHub Actions Error Fetcher\n');
  console.log(`Repository: ${config.owner}/${config.repo}`);
  console.log(`Period: Last ${config.daysBack} days`);
  console.log(`Output: ${config.outputDir}\n`);

  if (!config.token) {
    console.log('⚠️  Warning: GITHUB_TOKEN not set. Some features may be limited.\n');
    console.log('To get a token:');
    console.log('1. Go to https://github.com/settings/tokens');
    console.log('2. Create a new token with "repo" scope');
    console.log('3. Set GITHUB_TOKEN environment variable\n');
  }

  try {
    // Fetch workflow runs
    const runs = await fetchWorkflowRuns();
    console.log(`✓ Found ${runs.length} workflow runs\n`);

    // Fetch jobs for failed runs
    const failedRuns = runs.filter((r) => r.conclusion === 'failure');
    const jobs = [];
    const logs = [];

    if (failedRuns.length > 0) {
      console.log(`🔍 Fetching jobs for ${failedRuns.length} failed runs...\n`);

      for (const run of failedRuns) {
        const jobsEndpoint = `/actions/runs/${run.id}/jobs`;
        const jobsResponse = await githubRequest(jobsEndpoint);

        if (jobsResponse.status === 200) {
          const runJobs = jobsResponse.data.jobs;
          jobs.push(...runJobs);

          // Fetch logs for failed jobs
          for (const job of runJobs.filter((j) => j.conclusion === 'failure')) {
            const jobLogs = await fetchJobLogs(job.id, job.name);
            if (jobLogs) {
              logs.push(jobLogs);
            }
          }
        }
      }
    }

    // Generate report
    console.log('\n📊 Generating report...');
    const report = generateReport(runs, jobs, logs);

    // Save report
    const files = saveReport(report);

    // Create issue (if token provided)
    await createIssue(report, files);

    console.log('\n✅ Done!\n');

    // Report results (always exit 0 — this script is a reporter, not a gate)
    if (report.summary.failedRuns > 0) {
      console.log(
        `⚠️  ${report.summary.failedRuns} workflow(s) failed in the last ${config.daysBack} days`
      );
    } else {
      console.log(`✅ All workflows passed in the last ${config.daysBack} days`);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
main();
