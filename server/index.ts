import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './app.ts';
import * as audioPipeline from './audioPipeline.ts';
import { config, validateRequiredApiKeys } from './config.ts';
import { getDatabase } from './database.ts';
import { logger } from './logger.ts';
import { resolveServerPort } from './runtime.ts';
import { initSentry } from './sentry.ts';
import * as speakerEmbedder from './speakerEmbedder.ts';
import {
  runDatabaseStartupChecks,
  runStartupMaintenance,
  warnIfUsingDefaultLocalDatabase,
} from './lib/startupMaintenance.ts';
import AuthService from './services/AuthService.ts';
import TranscriptionService from './services/TranscriptionService.ts';
import WorkspaceService from './services/WorkspaceService.ts';
import { startVoiceLogServer } from './serverRuntime.ts';

initSentry();

const __filename = fileURLToPath(import.meta.url);

const PORT = resolveServerPort(config);
const HOST = config.VOICELOG_API_HOST || '0.0.0.0';

export async function bootstrap() {
  validateRequiredApiKeys();
  warnIfUsingDefaultLocalDatabase(config, logger);

  const db = getDatabase();

  await runStartupMaintenance(db.uploadDir, logger);
  await runDatabaseStartupChecks(db, logger);

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
    .then(({ server, db }) => {
      startVoiceLogServer({
        server,
        db,
        host: HOST,
        port: PORT,
        uploadDir: config.VOICELOG_UPLOAD_DIR || db.uploadDir,
        logger,
      });
    })
    .catch((error) => {
      logger.error('FAILED TO START SERVER:', error);
      process.exit(1);
    });
}

export default bootstrap;
