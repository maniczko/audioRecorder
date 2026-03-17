// Load .env from project root before any other requires
try { require("dotenv").config({ path: require("node:path").resolve(__dirname, "../.env") }); } catch (_) {}

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
const HOST = process.env.VOICELOG_API_HOST || "127.0.0.1";

// 1. Initialize Database
const db = initDatabase();

// 2. Initialize Services
const authService = new AuthService(db);
const workspaceService = new WorkspaceService(db);
const transcriptionService = new TranscriptionService(db, audioPipeline, speakerEmbedder);

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
  server.listen(PORT, HOST, () => {
    console.log(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
  });
}

module.exports = { server, db, authService, workspaceService, transcriptionService };
