// Load .env from project root before any other requires
try { require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") }); } catch (_) {}
process.on("uncaughtException", (err) => {
  console.error("FATAL UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("FATAL UNHANDLED REJECTION:", reason);
});

const http = require("node:http");
const { initDatabase } = require("./database");
const { createApp } = require("./app");

// Services
const AuthService = require("./services/AuthService");
const WorkspaceService = require("./services/WorkspaceService");
const TranscriptionService = require("./services/TranscriptionService");

// Assets & Pipeline
const audioPipeline = require("./audioPipeline");
const speakerEmbedder = require("./speakerEmbedder");

const PORT = Number(process.env.PORT || process.env.VOICELOG_API_PORT) || 4000;
const HOST = process.env.VOICELOG_API_HOST || "0.0.0.0";

console.log("1. Starting initialization...");
const db = initDatabase();
console.log("2. Database initialized at:", db.dbPath);

const authService = new AuthService(db);
const workspaceService = new WorkspaceService(db);
const transcriptionService = new TranscriptionService(db, audioPipeline, speakerEmbedder);
console.log("3. Services initialized.");

// 3. Create App Handler
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

// 4. Start Server
const server = http.createServer(handler);

if (require.main === module) {
  console.log(`4. Attempting to listen on ${HOST}:${PORT}...`);
  server.on("error", (err) => {
    console.error("SERVER ERROR:", err);
  });
  server.listen(PORT, HOST, () => {
    console.log(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
  });
}

module.exports = { server, db, authService, workspaceService, transcriptionService };
