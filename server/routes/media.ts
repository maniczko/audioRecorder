import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AppServices, AppMiddlewares } from "./middleware.ts";
import type { MeetingAsset, TranscriptionStatusPayload } from "../../src/shared/types.ts";

function normalizePipelineStatus(value: string): TranscriptionStatusPayload["pipelineStatus"] {
  if (value === "completed") return "done";
  if (value === "queued" || value === "processing" || value === "failed" || value === "done") return value;
  return "queued";
}

function buildTranscriptionStatusPayload(asset: MeetingAsset): TranscriptionStatusPayload {
  let diarization = {} as any;
  let segments = [];
  try { diarization = JSON.parse(asset?.diarization_json || "{}"); } catch (_) {}
  try { segments = JSON.parse(asset?.transcript_json || "[]"); } catch (_) {}

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

export function createMediaRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();
  const { transcriptionService } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;

  // --- Media & Processing ---
  router.use("/recordings/*", authMiddleware);
  router.put("/recordings/:recordingId/audio", async (c) => {
    const uploadStart = performance.now();
    const reqId = c.get("reqId");
    const session = c.get("session") as any;
    const recordingId = c.req.param("recordingId");
    const workspaceId = c.req.header("X-Workspace-Id") || "";
    const meetingId = c.req.header("X-Meeting-Id") || "";
    if (!workspaceId) return c.json({ message: "Brakuje X-Workspace-Id." }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 100 * 1024 * 1024) return c.json({ message: "Przesłany plik przekracza maksymalny rozmiar." }, 413);

    const asset = await transcriptionService.upsertMediaAsset({
        recordingId, workspaceId, meetingId,
        contentType: c.req.header("content-type") || "application/octet-stream",
        buffer: Buffer.from(buffer),
        createdByUserId: session.user_id,
    });
    
    // R04 Metrics
    const { logger } = await import("../logger.ts");
    logger.info(`[Metrics] Uploaded audio chunk`, {
       requestId: reqId,
       recordingId,
       sizeBytes: asset.size_bytes,
       durationMs: (performance.now() - uploadStart).toFixed(2)
    });

    return c.json({ id: asset.id, workspaceId: asset.workspace_id, sizeBytes: asset.size_bytes }, 200);
  });

  router.get("/recordings/:recordingId/audio", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    if (!fs.existsSync(asset.file_path)) return c.json({ message: "Plik audio nie istnieje na serwerze." }, 404);

    const ALLOWED = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac", "application/octet-stream"]);
    const safeType = ALLOWED.has(String(asset.content_type || "").toLowerCase()) ? asset.content_type : "application/octet-stream";

    const stream = fs.createReadStream(asset.file_path);
    c.header("Content-Type", safeType);
    c.header("Content-Length", String(fs.statSync(asset.file_path).size));
    c.header("Content-Disposition", "attachment");
    return c.body(stream as any, 200);
  });

  router.post("/recordings/:recordingId/transcribe", async (c) => {
    const recordingId = c.req.param("recordingId");
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, body.workspaceId || asset.workspace_id);

    await transcriptionService.queueTranscription(recordingId, body);
    
    // Przekazanie requestId do jobów asynchronicznych (metryki/observability)
    await transcriptionService.ensureTranscriptionJob(recordingId, asset, {
      ...body,
      requestId: c.get("reqId")
    });
    
    return c.json(buildTranscriptionStatusPayload(await transcriptionService.getMediaAsset(recordingId)), 202);
  });

  router.get("/recordings/:recordingId/transcribe", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    return c.json(buildTranscriptionStatusPayload(asset), 200);
  });

  router.get("/recordings/:recordingId/progress", async (c) => {
    const recordingId = c.req.param("recordingId");
    
    return streamSSE(c, async (stream) => {
      let active = true;

      const progressCallback = async (data: any) => {
        if (!active) return;
        await stream.writeSSE({
          data: JSON.stringify(data),
          event: "progress"
        });
      };

      transcriptionService.on(`progress-${recordingId}`, progressCallback);

      const pingId = setInterval(async () => {
        if (active) {
          await stream.writeSSE({ data: JSON.stringify({ ping: "stay-alive" }), event: "ping" }).catch(() => {});
        }
      }, 15000);

      c.req.raw.signal.addEventListener("abort", () => {
        active = false;
        clearInterval(pingId);
        transcriptionService.removeListener(`progress-${recordingId}`, progressCallback);
      });

      await new Promise(() => {});
    });
  });

  router.post("/recordings/:recordingId/normalize", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    await transcriptionService.normalizeRecording(asset.file_path, {});
    return c.json({ ok: true }, 200);
  });

  router.post("/recordings/:recordingId/voice-profiles/from-speaker", async (c) => {
    const session = c.get("session") as any;
    const recordingId = c.req.param("recordingId");
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    try {
      const profile = await transcriptionService.createVoiceProfileFromSpeaker(
        asset, body.speakerId, body.speakerName, session.user_id, {}
      );
      return c.json(profile, 201);
    } catch (err: any) {
      return c.json({ message: err.message }, 400);
    }
  });

  router.post("/recordings/:recordingId/voice-coaching", async (c) => {
    const recordingId = c.req.param("recordingId");
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    const coaching = await transcriptionService.generateVoiceCoaching(asset, String(body?.speakerId || ""), body?.segments || [], {});
    return c.json({ coaching }, 200);
  });

  router.post("/recordings/:recordingId/rediarize", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    let stored = [] as any[];
    try { stored = JSON.parse(asset.transcript_json || "[]"); } catch (_) {}
    if (!stored.length) return c.json({ message: "Brak transkrypcji." }, 400);

    const whisperLike = stored.map(s => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp })).filter(s => s.text);
    const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
    if (!diarization) return c.json({ message: "Diaryzacja nie powiodla sie." }, 422);

    const updated = diarization.segments.map((seg: any, idx: number) => ({ ...(stored[idx] || {}), id: stored[idx]?.id || seg.id, text: seg.text, timestamp: seg.timestamp, endTimestamp: seg.endTimestamp, speakerId: seg.speakerId, rawSpeakerLabel: seg.rawSpeakerLabel }));
    await transcriptionService.saveTranscriptionResult(recordingId, { segments: updated, diarization, pipelineStatus: "completed" });
    return c.json({ speakerCount: diarization.speakerCount, speakerNames: diarization.speakerNames, segments: updated }, 200);
  });

  router.post("/analyze", applyRateLimit("analyze"), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
    return c.json(result || { mode: "no-key" }, 200);
  });

  return router;
}

export function createTranscribeRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any } }>();
  const { transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit } = middlewares;

  router.post("/live", authMiddleware, applyRateLimit("live-transcribe", 60), async (c) => {
    const contentType = c.req.header("content-type") || "audio/webm";
    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 5 * 1024 * 1024) return c.json({ message: "Payload too large" }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 500) return c.json({ text: "" }, 200);

    const ext = contentType.includes("mp4") ? ".m4a" : contentType.includes("wav") ? ".wav" : ".webm";
    const tmpPath = path.join(config.uploadDir, `live_${crypto.randomUUID().replace(/-/g, "")}${ext}`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, {});
      return c.json({ text }, 200);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  });

  return router;
}
