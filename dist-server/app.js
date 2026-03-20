const { URL } = require("node:url");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { Hono } = require("hono");
const { cors } = require("hono/cors");
const { logger } = require("hono/logger");
const { z } = require("zod");
const { zValidator } = require("@hono/zod-validator");
const { getConnInfo } = require("@hono/node-server/conninfo");
const { getRequestListener } = require("@hono/node-server");
const { checkRateLimit } = require("./lib/serverUtils.ts");
function createApp({ authService, workspaceService, transcriptionService, config }) {
    const app = new Hono();
    const ALLOWED_ORIGINS = (config.allowedOrigins || "http://localhost:3000").split(",").map(s => s.trim());
    const allowAny = ALLOWED_ORIGINS.includes("*");
    app.use("*", cors({
        origin: (origin) => {
            if (!origin)
                return "*";
            if (allowAny)
                return origin;
            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
                return origin;
            if (/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin))
                return origin;
            if (ALLOWED_ORIGINS.includes(origin))
                return origin;
            return ALLOWED_ORIGINS[0];
        },
        allowHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Meeting-Id", "X-Speaker-Name"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
    }));
    app.use("*", async (c, next) => {
        c.header("Content-Security-Policy", "default-src 'none'");
        c.header("X-Content-Type-Options", "nosniff");
        c.header("X-Frame-Options", "DENY");
        await next();
    });
    // Global Error Handler
    app.onError((err, c) => {
        if (err.name === "ContextError" || err instanceof z.ZodError || err.statusCode === 422) {
            return c.json({ message: "Invalid payload.", errors: err.errors || err.message }, 422);
        }
        const statusCode = err.statusCode || err.status || 500;
        if (statusCode === 429 && err.retryAfter) {
            c.header("Retry-After", String(err.retryAfter));
        }
        return c.json({ message: err.message || "Unexpected server error." }, statusCode);
    });
    // Helper for Rate limiting
    const applyRateLimit = (route, max = 10) => async (c, next) => {
        const conn = getConnInfo(c);
        const socketIp = conn?.remote?.address || "unknown";
        const clientIp = config.trustProxy ? (c.req.header("x-forwarded-for")?.split(",")[0].trim() || socketIp) : socketIp;
        checkRateLimit(clientIp, route, max);
        await next();
    };
    // Helper auth mechanism
    const authMiddleware = async (c, next) => {
        const authHeader = c.req.header("Authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
            return c.json({ message: "Brak tokenu autoryzacyjnego." }, 401);
        }
        const token = authHeader.slice(7).trim();
        const session = await authService.getSession(token);
        if (!session) {
            return c.json({ message: "Sesja wygasla lub jest nieprawidlowa." }, 401);
        }
        c.set("session", session);
        await next();
    };
    const ensureWorkspaceAccess = async (c, workspaceId) => {
        const session = c.get("session");
        const membership = await workspaceService.getMembership(workspaceId, session.user_id);
        if (!membership) {
            const err = new Error("Nie masz dostepu do tego workspace.");
            err.statusCode = 403;
            throw err;
        }
        return membership;
    };
    function normalizePipelineStatus(value) {
        if (value === "completed")
            return "done";
        if (["queued", "processing", "failed", "done"].includes(String(value || "")))
            return value;
        return "queued";
    }
    function buildTranscriptionStatusPayload(asset) {
        let diarization = {};
        let segments = [];
        try {
            diarization = JSON.parse(asset?.diarization_json || "{}");
        }
        catch (_) { }
        try {
            segments = JSON.parse(asset?.transcript_json || "[]");
        }
        catch (_) { }
        return {
            recordingId: asset?.id || "",
            pipelineStatus: normalizePipelineStatus(asset?.transcription_status),
            segments: Array.isArray(segments) ? segments : [],
            diarization: diarization && typeof diarization === "object" ? diarization : {},
            speakerNames: diarization?.speakerNames || {},
            speakerCount: diarization?.speakerCount || 0,
            confidence: diarization?.confidence || 0,
            reviewSummary: diarization?.reviewSummary || null,
            errorMessage: diarization?.errorMessage || "",
            updatedAt: asset?.updated_at || "",
        };
    }
    app.get("/health", (c) => c.json({ ok: true, status: "ok", uptime: process.uptime() }));
    const registerSchema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        workspaceName: z.string().optional(),
        workspaceMode: z.string().optional(),
        workspaceCode: z.string().optional()
    });
    app.post("/auth/register", applyRateLimit("auth"), zValidator("json", registerSchema), async (c) => {
        const data = c.req.valid("json");
        const result = await authService.registerUser(data);
        return c.json(result, 201);
    });
    const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(1),
        workspaceId: z.string().optional()
    });
    app.post("/auth/login", applyRateLimit("auth"), zValidator("json", loginSchema), async (c) => {
        const data = c.req.valid("json");
        const result = await authService.loginUser(data);
        return c.json(result, 200);
    });
    const resetReqSchema = z.object({ email: z.string().email() });
    app.post("/auth/password/reset/request", applyRateLimit("auth"), zValidator("json", resetReqSchema), async (c) => {
        const data = c.req.valid("json");
        const result = await authService.requestPasswordReset(data);
        return c.json(result, 200);
    });
    const resetConfirmSchema = z.object({
        email: z.string().email(),
        code: z.string().min(1),
        newPassword: z.string().min(6),
        confirmPassword: z.string().min(6)
    });
    app.post("/auth/password/reset/confirm", applyRateLimit("auth"), zValidator("json", resetConfirmSchema), async (c) => {
        const data = c.req.valid("json");
        const result = await authService.resetPasswordWithCode(data);
        return c.json(result, 200);
    });
    const googleSchema = z.object({
        email: z.string().email(),
        sub: z.string(),
        name: z.string().optional(),
        given_name: z.string().optional(),
        picture: z.string().optional()
    });
    app.post("/auth/google", applyRateLimit("auth"), zValidator("json", googleSchema), async (c) => {
        const data = c.req.valid("json");
        const result = await authService.upsertGoogleUser(data);
        return c.json(result, 200);
    });
    // ==== PRIVATE ROUTES ====
    app.use("/auth/session", authMiddleware);
    app.get("/auth/session", async (c) => {
        const session = c.get("session");
        const workspaceId = c.req.query("workspaceId") || session.workspace_id;
        await ensureWorkspaceAccess(c, workspaceId);
        return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
    });
    app.use("/users/*", authMiddleware);
    app.put("/users/:userId/profile", async (c) => {
        const session = c.get("session");
        const userId = c.req.param("userId");
        if (session.user_id !== userId)
            return c.json({ message: "Mozesz edytowac tylko swoj profil." }, 403);
        const workspaceId = c.req.query("workspaceId") || session.workspace_id;
        const body = await c.req.json().catch(() => ({}));
        const user = await authService.updateUserProfile(userId, body);
        const payload = await authService.buildSessionPayload(session.user_id, workspaceId);
        return c.json({ user, users: payload.users }, 200);
    });
    app.post("/users/:userId/password", async (c) => {
        const session = c.get("session");
        const userId = c.req.param("userId");
        if (session.user_id !== userId)
            return c.json({ message: "Mozesz zmienic tylko swoje haslo." }, 403);
        const body = await c.req.json().catch(() => ({}));
        return c.json(await authService.changeUserPassword(userId, body), 200);
    });
    app.use("/state/*", authMiddleware);
    app.get("/state/bootstrap", async (c) => {
        const session = c.get("session");
        const workspaceId = c.req.query("workspaceId") || session.workspace_id;
        await ensureWorkspaceAccess(c, workspaceId);
        return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
    });
    app.put("/state/workspaces/:workspaceId", async (c) => {
        const workspaceId = c.req.param("workspaceId");
        await ensureWorkspaceAccess(c, workspaceId);
        const body = await c.req.json().catch(() => ({}));
        return c.json({
            workspaceId,
            state: await workspaceService.saveWorkspaceState(workspaceId, body),
        }, 200);
    });
    app.use("/workspaces/*", authMiddleware);
    app.put("/workspaces/:workspaceId/members/:targetUserId/role", async (c) => {
        const workspaceId = c.req.param("workspaceId");
        const targetUserId = c.req.param("targetUserId");
        const membership = await ensureWorkspaceAccess(c, workspaceId);
        if (!["owner", "admin"].includes(membership.member_role)) {
            return c.json({ message: "Tylko owner lub admin moze zmieniac role." }, 403);
        }
        const body = await c.req.json().catch(() => ({}));
        return c.json(await workspaceService.updateWorkspaceMemberRole(workspaceId, targetUserId, body.memberRole), 200);
    });
    // --- Media & Processing ---
    app.use("/media/*", authMiddleware);
    app.put("/media/recordings/:recordingId/audio", async (c) => {
        const session = c.get("session");
        const recordingId = c.req.param("recordingId");
        const workspaceId = c.req.header("X-Workspace-Id") || "";
        const meetingId = c.req.header("X-Meeting-Id") || "";
        if (!workspaceId)
            return c.json({ message: "Brakuje X-Workspace-Id." }, 400);
        await ensureWorkspaceAccess(c, workspaceId);
        const buffer = await c.req.arrayBuffer();
        if (buffer.byteLength > 100 * 1024 * 1024)
            return c.json({ message: "Przesłany plik przekracza maksymalny rozmiar." }, 413);
        const asset = await transcriptionService.upsertMediaAsset({
            recordingId, workspaceId, meetingId,
            contentType: c.req.header("content-type") || "application/octet-stream",
            buffer: Buffer.from(buffer),
            createdByUserId: session.user_id,
        });
        return c.json({ id: asset.id, workspaceId: asset.workspace_id, sizeBytes: asset.size_bytes }, 200);
    });
    app.get("/media/recordings/:recordingId/audio", async (c) => {
        const recordingId = c.req.param("recordingId");
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        if (!fs.existsSync(asset.file_path))
            return c.json({ message: "Plik audio nie istnieje na serwerze." }, 404);
        const ALLOWED = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac", "application/octet-stream"]);
        const safeType = ALLOWED.has(String(asset.content_type || "").toLowerCase()) ? asset.content_type : "application/octet-stream";
        // Streaming response
        const stream = fs.createReadStream(asset.file_path);
        c.header("Content-Type", safeType);
        c.header("Content-Length", String(fs.statSync(asset.file_path).size));
        c.header("Content-Disposition", "attachment");
        return c.body(stream, 200);
    });
    app.post("/media/recordings/:recordingId/transcribe", async (c) => {
        const recordingId = c.req.param("recordingId");
        const body = await c.req.json().catch(() => ({}));
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, body.workspaceId || asset.workspace_id);
        await transcriptionService.queueTranscription(recordingId, body);
        await transcriptionService.ensureTranscriptionJob(recordingId, asset, body);
        return c.json(buildTranscriptionStatusPayload(await transcriptionService.getMediaAsset(recordingId)), 202);
    });
    app.get("/media/recordings/:recordingId/transcribe", async (c) => {
        const recordingId = c.req.param("recordingId");
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        return c.json(buildTranscriptionStatusPayload(asset), 200);
    });
    app.post("/media/recordings/:recordingId/normalize", async (c) => {
        const recordingId = c.req.param("recordingId");
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        await transcriptionService.normalizeRecording(asset.file_path, {});
        return c.json({ ok: true }, 200);
    });
    app.post("/media/recordings/:recordingId/voice-coaching", async (c) => {
        const recordingId = c.req.param("recordingId");
        const body = await c.req.json().catch(() => ({}));
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        const coaching = await transcriptionService.generateVoiceCoaching(asset, String(body?.speakerId || ""), body?.segments || [], {});
        return c.json({ coaching }, 200);
    });
    app.post("/media/recordings/:recordingId/rediarize", async (c) => {
        const recordingId = c.req.param("recordingId");
        const asset = await transcriptionService.getMediaAsset(recordingId);
        if (!asset)
            return c.json({ message: "Nie znaleziono nagrania." }, 404);
        await ensureWorkspaceAccess(c, asset.workspace_id);
        let stored = [];
        try {
            stored = JSON.parse(asset.transcript_json || "[]");
        }
        catch (_) { }
        if (!stored.length)
            return c.json({ message: "Brak transkrypcji." }, 400);
        const whisperLike = stored.map(s => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp })).filter(s => s.text);
        const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
        if (!diarization)
            return c.json({ message: "Diaryzacja nie powiodla sie." }, 422);
        const updated = diarization.segments.map((seg, idx) => ({ ...(stored[idx] || {}), id: stored[idx]?.id || seg.id, text: seg.text, timestamp: seg.timestamp, endTimestamp: seg.endTimestamp, speakerId: seg.speakerId, rawSpeakerLabel: seg.rawSpeakerLabel }));
        await transcriptionService.saveTranscriptionResult(recordingId, { segments: updated, diarization, pipelineStatus: "completed" });
        return c.json({ speakerCount: diarization.speakerCount, speakerNames: diarization.speakerNames, segments: updated }, 200);
    });
    app.post("/media/analyze", applyRateLimit("analyze"), async (c) => {
        const body = await c.req.json().catch(() => ({}));
        const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
        return c.json(result || { mode: "no-key" }, 200);
    });
    app.use("/voice-profiles*", authMiddleware);
    app.get("/voice-profiles", async (c) => {
        const session = c.get("session");
        const profiles = (await workspaceService.getWorkspaceVoiceProfiles(session.workspace_id)).map((p) => ({
            id: p.id, speakerName: p.speaker_name, userId: p.user_id, createdAt: p.created_at,
        }));
        return c.json({ profiles }, 200);
    });
    app.post("/voice-profiles", applyRateLimit("voice-profiles"), async (c) => {
        const session = c.get("session");
        const speakerName = String(c.req.header("X-Speaker-Name") || "").slice(0, 120);
        if (!speakerName.trim())
            return c.json({ message: "Brakuje naglowka X-Speaker-Name." }, 400);
        const bufferArray = await c.req.arrayBuffer();
        if (bufferArray.byteLength > 1 * 1024 * 1024)
            return c.json({ message: "Plik audio przekracza maksymalny rozmiar limitu 1MB." }, 413);
        const buffer = Buffer.from(bufferArray);
        if (!buffer || buffer.byteLength < 1000)
            return c.json({ message: "Plik audio jest za krotki." }, 400);
        const contentType = c.req.header("content-type") || "audio/webm";
        const profileId = `vp_${crypto.randomUUID().replace(/-/g, "")}`;
        const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
        const audioPath = path.join(config.uploadDir, `${profileId}${ext}`);
        fs.writeFileSync(audioPath, buffer);
        const embedding = await transcriptionService.computeEmbedding(audioPath);
        const profile = await workspaceService.saveVoiceProfile({
            id: profileId, userId: session.user_id, workspaceId: session.workspace_id,
            speakerName: speakerName.trim(), audioPath, embedding: embedding || [],
        });
        return c.json({ id: profile.id, speakerName: profile.speaker_name, hasEmbedding: (embedding || []).length > 0, createdAt: profile.created_at }, 201);
    });
    app.delete("/voice-profiles/:id", async (c) => {
        const session = c.get("session");
        await workspaceService.deleteVoiceProfile(c.req.param("id"), session.workspace_id);
        return new Response(null, { status: 204 });
    });
    app.post("/transcribe/live", authMiddleware, applyRateLimit("live-transcribe", 60), async (c) => {
        const contentType = c.req.header("content-type") || "audio/webm";
        const bufferArray = await c.req.arrayBuffer();
        if (bufferArray.byteLength > 5 * 1024 * 1024)
            return c.json({ message: "Payload too large" }, 413);
        const buffer = Buffer.from(bufferArray);
        if (!buffer || buffer.byteLength < 500)
            return c.json({ text: "" }, 200);
        const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
        const tmpPath = path.join(config.uploadDir, `live_${crypto.randomUUID().replace(/-/g, "")}${ext}`);
        try {
            fs.writeFileSync(tmpPath, buffer);
            const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, {});
            return c.json({ text }, 200);
        }
        finally {
            try {
                fs.unlinkSync(tmpPath);
            }
            catch (_) { }
        }
    });
    return getRequestListener(app.fetch);
}
module.exports = { createApp };
