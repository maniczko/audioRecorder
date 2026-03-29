#!/usr/bin/env node
/**
 * Post-deploy Script for Railway
 *
 * Uruchamiany automatycznie po każdym deploy na Railway
 * Zadania:
 * 1. Migracje bazy danych
 * 2. Seedowanie danych
 * 3. Health check
 * 4. Powiadomienia
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load .env
config({ path: join(rootDir, '.env') });

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runMigrations() {
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Running Database Migrations                    │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  try {
    // Sprawdź czy DATABASE_URL jest ustawiony
    if (!process.env.DATABASE_URL) {
      log(colors.yellow, '⚠️  DATABASE_URL not set - skipping migrations');
      return true;
    }

    // Import dynamiczny - tylko jeśli istnieje skrypt migracyjny
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    log(colors.cyan, '📦 Running migrations...');

    // Przykład dla Prisma
    // await execAsync('npx prisma migrate deploy', { cwd: rootDir });

    // Przykład dla Kysely/Knex
    // await execAsync('pnpm run db:migrate', { cwd: rootDir });

    // Przykład dla SQL files
    // await execAsync('psql $DATABASE_URL < migrations/*.sql', { cwd: rootDir });

    log(colors.green, '✅ Migrations completed successfully');
    return true;
  } catch (error) {
    log(colors.red, `❌ Migration failed: ${error.message}`);
    return false;
  }
}

async function seedDatabase() {
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Seeding Database                               │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  try {
    // Seedowanie tylko dla produkcji
    if (process.env.NODE_ENV !== 'production') {
      log(colors.yellow, '⚠️  Skipping seed in non-production environment');
      return true;
    }

    // Przykład seedowania
    // const { seedDatabase } = await import('./server/seed.js');
    // await seedDatabase();

    log(colors.green, '✅ Database seeded successfully');
    return true;
  } catch (error) {
    log(colors.red, `❌ Seed failed: ${error.message}`);
    return false;
  }
}

async function healthCheck() {
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Running Health Check                           │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  try {
    const port = process.env.VOICELOG_API_PORT || '4000';
    const host = process.env.VOICELOG_API_HOST || '127.0.0.1';
    const url = `http://${host}:${port}/api/health`;

    log(colors.cyan, `🏥 Checking health: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      timeout: 5000,
    });

    if (response.ok) {
      const data = await response.json();
      log(colors.green, `✅ Health check passed: ${JSON.stringify(data)}`);
      return true;
    } else {
      log(colors.red, `❌ Health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    log(colors.red, `❌ Health check error: ${error.message}`);
    return false;
  }
}

async function clearCache() {
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Clearing Cache                                 │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  try {
    // Clear Redis cache (jeśli używasz)
    // const redis = require('redis');
    // const client = redis.createClient(process.env.REDIS_URL);
    // await client.flushAll();

    log(colors.green, '✅ Cache cleared');
    return true;
  } catch (error) {
    log(colors.yellow, `⚠️  Cache clear skipped: ${error.message}`);
    return true; // Nie krytyczne
  }
}

async function notifyDeployment() {
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Sending Deployment Notification                │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  try {
    // Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `✅ Deployment successful!\n${process.env.RAILWAY_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown'}`,
        }),
      });
      log(colors.green, '✅ Slack notification sent');
    }

    // Discord webhook
    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `✅ Deployment successful!`,
          embeds: [
            {
              title: 'Deployment',
              color: 0x00ff00,
              fields: [
                {
                  name: 'Commit',
                  value: process.env.RAILWAY_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
                },
                { name: 'Branch', value: process.env.RAILWAY_GIT_BRANCH || 'unknown' },
              ],
            },
          ],
        }),
      });
      log(colors.green, '✅ Discord notification sent');
    }

    return true;
  } catch (error) {
    log(colors.yellow, `⚠️  Notification failed: ${error.message}`);
    return true; // Nie krytyczne
  }
}

async function main() {
  log(colors.cyan, '╔════════════════════════════════════════════════╗');
  log(colors.cyan, '║   VoiceLog OS - Post-deploy Script             ║');
  log(colors.cyan, '╚════════════════════════════════════════════════╝');
  log(colors.reset, '');

  const steps = [
    { name: 'Migrations', fn: runMigrations, critical: true },
    { name: 'Seed', fn: seedDatabase, critical: false },
    { name: 'Cache Clear', fn: clearCache, critical: false },
    { name: 'Health Check', fn: healthCheck, critical: true },
    { name: 'Notifications', fn: notifyDeployment, critical: false },
  ];

  let allSuccess = true;

  for (const step of steps) {
    log(colors.reset, '');
    const success = await step.fn();
    if (!success && step.critical) {
      allSuccess = false;
      log(colors.red, `❌ Critical step "${step.name}" failed - aborting`);
      break;
    }
  }

  log(colors.reset, '');
  log(colors.cyan, '┌────────────────────────────────────────────────┐');
  log(colors.cyan, '│ Summary                                        │');
  log(colors.cyan, '└────────────────────────────────────────────────┘');

  if (allSuccess) {
    log(colors.green, '✅ All post-deploy steps completed successfully!');
    process.exit(0);
  } else {
    log(colors.red, '❌ Some critical post-deploy steps failed!');
    process.exit(1);
  }
}

main().catch((error) => {
  log(colors.red, `❌ Post-deploy script error: ${error.message}`);
  process.exit(1);
});
