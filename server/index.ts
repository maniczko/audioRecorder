// Load .env from project root before any other requires
try { require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") }); } catch (_) {}

const { logger } = require("./logger");

process.on("uncaughtException", (err) => {
  logger.error("FATAL UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("FATAL UNHANDLED REJECTION:", reason instanceof Error ? reason : new Error(String(reason)));
});

const http = require("node:http");
const { getDatabase } = require("./database");
const { createApp } = require("./app");

// Services
const AuthService = require("./services/AuthService");
const WorkspaceService = require("./services/WorkspaceService");
const TranscriptionService = require("./services/TranscriptionService");

// Assets & Pipeline (Lazily loaded internally to prevent 55KB synchronous block on startup)

const PORT = Number(process.env.PORT || process.env.VOICELOG_API_PORT) || 4000;
const HOST = process.env.VOICELOG_API_HOST || "0.0.0.0";

async function bootstrap() {
  const db = getDatabase();
  await db.init();

  const authService = new AuthService(db);
  const workspaceService = new WorkspaceService(db);
  const transcriptionService = new TranscriptionService(db, workspaceService, null, null);

  const handler = createApp({
    authService,
    workspaceService,
    transcriptionService,
    config: {
      allowedOrigins: process.env.VOICELOG_ALLOWED_ORIGINS || "http://localhost:3000",
      trustProxy: process.env.VOICELOG_TRUST_PROXY === "true",
      uploadDir: db.uploadDir,
    }
  });

  const server = http.createServer(handler);

  return { server, db, authService, workspaceService, transcriptionService };
}

if (require.main === module) {
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

module.exports = bootstrap;
