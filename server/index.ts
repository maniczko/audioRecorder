import { fileURLToPath } from "node:url";
import http from "node:http";
import { getRequestListener } from "@hono/node-server";
import { logger } from "./logger.ts";
import { getDatabase } from "./database.ts";
import { createApp } from "./app.ts";
import { config } from "./config.ts";
import AuthService from "./services/AuthService.ts";
import WorkspaceService from "./services/WorkspaceService.ts";
import TranscriptionService from "./services/TranscriptionService.ts";
import * as audioPipeline from "./audioPipeline.ts";
import * as speakerEmbedder from "./speakerEmbedder.ts";
import { resolveServerPort } from "./runtime.ts";

const __filename = fileURLToPath(import.meta.url);

process.on("uncaughtException", (error) => {
  logger.error("FATAL UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("FATAL UNHANDLED REJECTION:", reason instanceof Error ? reason : new Error(String(reason)));
});

const PORT = resolveServerPort(config);
const HOST = config.VOICELOG_API_HOST || "0.0.0.0";

export async function bootstrap() {
  const hasExternalDatabase = Boolean(config.VOICELOG_DATABASE_URL || config.DATABASE_URL);
  const hasLocalDatabasePath = Boolean(config.VOICELOG_DB_PATH);
  if (!hasExternalDatabase && !hasLocalDatabasePath) {
    logger.warn("[Bootstrap] DATABASE_URL nie jest ustawione. Serwer uruchomi sie na lokalnym SQLite z domyslna sciezka.");
  }

  const db = getDatabase();
  await db.init();

  const authService = new AuthService(db);
  const workspaceService = new WorkspaceService(db);

  logger.info(`[Bootstrap] Initializing TranscriptionService with audioPipeline (${typeof audioPipeline}, keys: ${Object.keys(audioPipeline).join(", ")})`);
  const transcriptionService = new TranscriptionService(db, workspaceService, audioPipeline, speakerEmbedder);

  const app = createApp({
    authService,
    workspaceService,
    transcriptionService,
    config: {
      allowedOrigins: config.VOICELOG_ALLOWED_ORIGINS || "http://localhost:3000",
      trustProxy: config.VOICELOG_TRUST_PROXY === true,
      uploadDir: db.uploadDir,
    },
  });

  const handler = getRequestListener(app.fetch);
  const server = http.createServer(handler);

  return { server, db, authService, workspaceService, transcriptionService };
}

if (process.argv[1] === __filename || process.argv[1]?.endsWith("index.ts")) {
  bootstrap().then(({ server }) => {
    logger.info(`Attempting to listen on ${HOST}:${PORT}...`);
    server.on("error", (error) => {
      logger.error("SERVER ERROR:", error);
    });
    server.listen(PORT, HOST, () => {
      logger.info(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
    });
  }).catch((error) => {
    logger.error("FAILED TO START SERVER:", error);
    process.exit(1);
  });
}

export default bootstrap;
