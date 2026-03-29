import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { logger } from './logger.ts';
import { getDatabase } from './database.ts';
import { createApp } from './app.ts';
import { config, validateRequiredApiKeys } from './config.ts';
import AuthService from './services/AuthService.ts';
import WorkspaceService from './services/WorkspaceService.ts';
import TranscriptionService from './services/TranscriptionService.ts';
import * as audioPipeline from './audioPipeline.ts';
import * as speakerEmbedder from './speakerEmbedder.ts';
import { resolveServerPort } from './runtime.ts';

const __filename = fileURLToPath(import.meta.url);

let uncaughtCount = 0;
process.on('uncaughtException', (error) => {
  uncaughtCount += 1;
  logger.error(`UNCAUGHT EXCEPTION (${uncaughtCount}):`, error);
  // Only exit on repeated rapid crashes (3+ within first 30s means startup failure)
  if (uncaughtCount >= 3 && process.uptime() < 30) {
    logger.error('Multiple uncaught exceptions during startup — exiting.');
    process.exit(1);
  }
  // Otherwise keep the server alive; the request will fail but other endpoints stay operational
});

process.on('unhandledRejection', (reason) => {
  logger.error(
    'UNHANDLED REJECTION:',
    reason instanceof Error ? reason : new Error(String(reason))
  );
});

const PORT = resolveServerPort(config);
const HOST = config.VOICELOG_API_HOST || '0.0.0.0';

export async function bootstrap() {
  // [104] Validate required API keys on startup
  validateRequiredApiKeys();

  const hasExternalDatabase = Boolean(config.VOICELOG_DATABASE_URL || config.DATABASE_URL);
  const hasLocalDatabasePath = Boolean(config.VOICELOG_DB_PATH);
  if (!hasExternalDatabase && !hasLocalDatabasePath) {
    logger.warn(
      '[Bootstrap] DATABASE_URL nie jest ustawione. Serwer uruchomi sie na lokalnym SQLite z domyslna sciezka.'
    );
  }

  // Cleanup temp files and check disk space on startup
  try {
    const uploadDir = config.VOICELOG_UPLOAD_DIR || './server/data/uploads';
    const fs = await import('node:fs');
    const path = await import('node:path');

    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      let deletedCount = 0;
      for (const file of files) {
        if (
          file.startsWith('temp_') ||
          file.startsWith('chunk_') ||
          file.startsWith('preprocess_')
        ) {
          try {
            fs.unlinkSync(path.join(uploadDir, file));
            deletedCount++;
          } catch (err) {
            // Ignore unlink errors
          }
        }
      }
      if (deletedCount > 0) {
        logger.info(
          `[Bootstrap] Cleared ${deletedCount} temporary audio files from ${uploadDir} to free up disk space.`
        );
      }
    }

    if (fs.statfsSync) {
      const stats = fs.statfsSync(uploadDir);
      const freeBytes = stats.bavail * stats.bsize;
      const freeGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);

      if (freeBytes < 100 * 1024 * 1024) {
        // Less than 100MB - CRITICAL
        logger.error(`[Bootstrap] CRITICAL: Disk space critically low! Only ${freeGB}GB free.`);
        logger.error(
          '[Bootstrap] Please clean up disk space or the server will fail to accept recordings.'
        );
        logger.info('[Bootstrap] Attempting automatic disk cleanup...');

        // Auto cleanup on critical disk space
        try {
          const { cleanupDisk } = await import('./scripts/cleanup-disk.js');
          const result = cleanupDisk();
          logger.info(
            `[Bootstrap] Cleanup result: ${result.deletedCount} files deleted, ${(result.freedBytes / 1024 / 1024).toFixed(2)} MB freed`
          );
        } catch (cleanupError) {
          logger.error('[Bootstrap] Automatic cleanup failed:', cleanupError);
        }
      } else if (freeBytes < 500 * 1024 * 1024) {
        // Less than 500MB
        logger.warn(`[Bootstrap] WARNING: Disk space low. ${freeGB}GB free.`);
      } else {
        logger.info(`[Bootstrap] Disk space OK: ${freeGB}GB free.`);
      }
    }
  } catch (error) {
    logger.warn('[Bootstrap] Unable to check disk space:', error);
  }

  const db = getDatabase();
  await db.init();

  const authService = new AuthService(db);
  const workspaceService = new WorkspaceService(db);

  logger.info(
    `[Bootstrap] Initializing TranscriptionService with audioPipeline (${typeof audioPipeline}, keys: ${Object.keys(audioPipeline).join(', ')})`
  );
  const transcriptionService = new TranscriptionService(
    db,
    workspaceService,
    audioPipeline,
    speakerEmbedder
  );

  const app = createApp({
    authService,
    workspaceService,
    transcriptionService,
    db,
    config: {
      allowedOrigins: config.VOICELOG_ALLOWED_ORIGINS || 'http://localhost:3000',
      trustProxy: config.VOICELOG_TRUST_PROXY === true,
      uploadDir: db.uploadDir,
    },
  });

  const handler = getRequestListener(app.fetch);
  const server = http.createServer(handler);

  return { server, db, authService, workspaceService, transcriptionService };
}

if (process.argv[1] === __filename || process.argv[1]?.endsWith('index.ts')) {
  bootstrap()
    .then(({ server }) => {
      logger.info(`Attempting to listen on ${HOST}:${PORT}...`);
      server.on('error', (error) => {
        logger.error('SERVER ERROR:', error);
      });
      server.listen(PORT, HOST, () => {
        logger.info(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
      });
    })
    .catch((error) => {
      logger.error('FAILED TO START SERVER:', error);
      process.exit(1);
    });
}

export default bootstrap;
