import { fileURLToPath } from "node:url";
import http from "node:http";
import { logger } from "./logger.ts";
import { getDatabase } from "./database.ts";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import AuthService from "./services/AuthService.ts";
import WorkspaceService from "./services/WorkspaceService.ts";
import TranscriptionService from "./services/TranscriptionService.ts";
import * as audioPipeline from "./audioPipeline.ts";
import * as speakerEmbedder from "./speakerEmbedder.ts";

const __filename = fileURLToPath(import.meta.url);
// __dirname is not used in this file but kept for reference if needed elsewhere

// Config is loaded and validated in config.ts


process.on("uncaughtException", (err) => {
  logger.error("FATAL UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("FATAL UNHANDLED REJECTION:", reason instanceof Error ? reason : new Error(String(reason)));
});

const PORT = Number(config.VOICELOG_API_PORT || config.PORT) || 4000;
const HOST = config.VOICELOG_API_HOST || "0.0.0.0";

export async function bootstrap() {
  const db = getDatabase();
  await db.init();

  const authService = new AuthService(db);
  const workspaceService = new WorkspaceService(db);
  
  logger.info(`[Bootstrap] Initializing TranscriptionService with audioPipeline (${typeof audioPipeline}, keys: ${Object.keys(audioPipeline).join(", ")})`);
  const transcriptionService = new TranscriptionService(db, workspaceService, audioPipeline, speakerEmbedder);

  const handler = createApp({
    authService,
    workspaceService,
    transcriptionService,
    config: {
      allowedOrigins: config.VOICELOG_ALLOWED_ORIGINS || "http://localhost:3000",
      trustProxy: config.VOICELOG_TRUST_PROXY === true,
      uploadDir: db.uploadDir,
    }
  });

  const server = http.createServer(handler);

  return { server, db, authService, workspaceService, transcriptionService };
}

// Since we are using tsx or bundling, we can check if this is the main module
if (process.argv[1] === __filename || process.argv[1]?.endsWith('index.ts')) {
  bootstrap().then(({ server }) => {
    logger.info(`Attempting to listen on ${HOST}:${PORT}...`);
    server.on("error", (err) => {
      logger.error("SERVER ERROR:", err);
    });
    server.listen(PORT, HOST, () => {
      logger.info(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
    });
  }).catch(err => {
    logger.error("FAILED TO START SERVER:", err);
    process.exit(1);
  });
}

export default bootstrap;

