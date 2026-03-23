import { existsSync, createReadStream, statSync, writeFileSync, unlinkSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AppServices, AppMiddlewares } from "./middleware.ts";
import { normalizeTranscriptionStatusPayload } from "../../src/shared/contracts.ts";
import type { MediaAsset } from "../lib/types.ts";

export function createMediaRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();
  const { transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  const startTranscriptionPipeline =
    typeof transcriptionService.startTranscriptionPipeline === "function"
      ? transcriptionService.startTranscriptionPipeline.bind(transcriptionService)
      : async (recordingId: string, asset: any, options: any) => {
          await transcriptionService.queueTranscription(recordingId, options);
          await transcriptionService.ensureTranscriptionJob(recordingId, asset, options);
          return transcriptionService.getMediaAsset(recordingId);
        };

  // --- Media & Processing ---
  router.use("/recordings", authMiddleware);
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

    let asset: MediaAsset;
    try {
      asset = await transcriptionService.upsertMediaAsset({
        recordingId, workspaceId, meetingId,
        contentType: c.req.header("content-type") || "application/octet-stream",
        buffer: Buffer.from(buffer),
        createdByUserId: session.user_id,
      });
    } catch (uploadErr: any) {
      if ((uploadErr as any).code === "ENOSPC" || String(uploadErr.message).includes("Brak miejsca na dysku")) {
        return c.json({ message: "Brak miejsca na dysku serwera. Skontaktuj sie z administratorem." }, 507);
      }
      throw uploadErr;
    }
    let audioQuality = null;
    try {
      audioQuality = await transcriptionService.analyzeAudioQuality(asset.file_path, {
        contentType: asset.content_type,
        signal: c.req.raw.signal,
      });
      await transcriptionService.saveAudioQualityDiagnostics(recordingId, audioQuality);
    } catch (error: any) {
      console.warn(`[mediaRoutes] Audio quality analysis failed for ${recordingId}:`, error?.message || error);
    }
    
    // R04 Metrics
    const { logger } = await import("../logger.ts");
    logger.info(`[Metrics] Uploaded audio chunk`, {
       requestId: reqId,
       recordingId,
       sizeBytes: asset.size_bytes,
       durationMs: (performance.now() - uploadStart).toFixed(2)
    });

    return c.json({ id: asset.id, workspaceId: asset.workspace_id, sizeBytes: asset.size_bytes, audioQuality }, 200);
  });

  router.get("/recordings/:recordingId/audio", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    const ALLOWED = new Set(["audio/webm", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/flac", "application/octet-stream"]);
    const safeType = ALLOWED.has(String(asset.content_type || "").toLowerCase()) ? asset.content_type : "application/octet-stream";

    // Depending on file_path format (legacy local vs remote Supabase)
    if (asset.file_path && !asset.file_path.includes(path.sep)) {
      try {
        const { downloadAudioFromStorage } = await import("../lib/supabaseStorage.ts");
        const arrayBuffer = await downloadAudioFromStorage(asset.file_path);
        
        c.header("Content-Type", safeType);
        c.header("Content-Length", String(arrayBuffer.byteLength));
        c.header("Content-Disposition", "attachment");
        return c.body(arrayBuffer as any, 200);
      } catch (err: any) {
        return c.json({ message: "Błąd podczas pobierania nagrania z remote storage.", error: err.message }, 500);
      }
    } else {
      // Legacy local file stream
      if (!existsSync(asset.file_path)) return c.json({ message: "Plik audio nie istnieje." }, 404);
      const stream = createReadStream(asset.file_path);
      c.header("Content-Type", safeType);
      c.header("Content-Length", String(statSync(asset.file_path).size));
      c.header("Content-Disposition", "attachment");
      return c.body(stream as any, 200);
    }
  });

  router.get("/recordings", async (c) => {
    const workspaceId = c.req.query("workspaceId");
    if (!workspaceId) return c.json({ message: "Brakuje workspaceId." }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const recordings = await transcriptionService.getMediaRecordings(workspaceId);
    return c.json({ recordings: recordings || [] }, 200);
  });

  router.delete("/recordings/:recordingId", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);

    // Ensure the user has rights to delete from this workspace
    await ensureWorkspaceAccess(c, asset.workspace_id);

    try {
      // Note: transcriptionService is Database instance here
      await transcriptionService.deleteMediaAsset(recordingId, asset.workspace_id);
      return c.body(null, 204);
    } catch (err: any) {
      return c.json({ message: "Błąd podczas usuwania nagrania.", error: err.message }, 500);
    }
  });

  router.post("/recordings/:recordingId/transcribe", async (c) => {
    const recordingId = c.req.param("recordingId");
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, body.workspaceId || asset.workspace_id);

    const result = await startTranscriptionPipeline(recordingId, asset, {
      ...body,
      requestId: c.get("reqId"),
    });

    return c.json(normalizeTranscriptionStatusPayload(result), 202);
  });

  router.post("/recordings/:recordingId/retry-transcribe", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    if (!asset.file_path) {
      return c.json({ message: "Brak ścieżki pliku do ponownego przetworzenia." }, 409);
    }

    if (asset.file_path.includes(path.sep) && !existsSync(asset.file_path)) {
      return c.json({ message: "Lokalny plik audio nie istnieje." }, 409);
    }

    const result = await startTranscriptionPipeline(recordingId, asset, {
      workspaceId: asset.workspace_id,
      meetingId: asset.meeting_id,
      contentType: asset.content_type,
      requestId: c.get("reqId"),
    });

    return c.json(normalizeTranscriptionStatusPayload(result), 202);
  });

  router.get("/recordings/:recordingId/transcribe", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    return c.json(normalizeTranscriptionStatusPayload(asset), 200);
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
    await transcriptionService.normalizeRecording(asset.file_path, { signal: c.req.raw.signal });
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
    if (body.speakerId === undefined || body.speakerId === null) return c.json({ message: "Brakuje speakerId." }, 400);
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    const coaching = await transcriptionService.generateVoiceCoaching(asset, String(body.speakerId), body?.segments || [], {});
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

  router.post("/recordings/:recordingId/sketchnote", async (c) => {
    const recordingId = c.req.param("recordingId");
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: "Nie znaleziono nagrania." }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    let diarization: any = {};
    try { diarization = JSON.parse(asset.diarization_json || "{}"); } catch (_) {}

    const summaryText = diarization?.reviewSummary?.summary || diarization?.summary;
    if (!summaryText) return c.json({ message: "Brak podsumowania do wygenerowania sketchnotki." }, 400);

    const prompt = `Create a visually stunning and professional SVG sketchnote summarizing this text: "${summaryText.substring(0, 500)}".
Return ONLY valid SVG code. Do not include markdown formatting like \`\`\`svg or backticks around the output. Just raw <svg>...</svg>.
The SVG should look like a hand-drawn visual note with doodle character icons, speech bubbles, arrows, and boxed sections. Use a warm color palette with pastel yellow accents. The text inside the SVG should be in Polish. Avoid excessively complex paths but arrange the layout clearly in a 800x600 viewBox.`;

    if (!process.env.GEMINI_API_KEY) {
      return c.json({ message: "Brak klucza GEMINI_API_KEY w konfiguracji środowiska." }, 400);
    }

    try {
      const { logger } = await import("../logger.ts");
      logger.info(`Generating Gemini SVG sketchnote for recording ${recordingId}...`);
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        })
      });

      if (!res.ok) {
        const err = await res.text();
        logger.error("Gemini SVG gen error:", err);
        return c.json({ message: "Blad generowania obrazu Gemini." }, 500);
      }

      const data = await res.json();
      let svgText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (svgText.startsWith("```xml")) svgText = svgText.replace(/```xml\n?/g, "").replace(/```/g, "").trim();
      if (svgText.startsWith("```svg")) svgText = svgText.replace(/```svg\n?/g, "").replace(/```/g, "").trim();
      if (svgText.startsWith("```")) svgText = svgText.replace(/```\n?/g, "").replace(/```/g, "").trim();
      
      if (!svgText.includes("<svg")) {
        return c.json({ message: "Model Gemini nie wygenerował poprawnego formatu SVG." }, 500);
      }

      const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svgText).toString("base64")}`;

      if (imageUrl) {
        diarization.sketchnoteUrl = imageUrl;
        if (typeof transcriptionService._execute === "function") {
          await transcriptionService._execute(
            "UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?",
            [JSON.stringify(diarization), new Date().toISOString(), recordingId]
          );
        }
      }

      return c.json({ sketchnoteUrl: imageUrl }, 200);
    } catch (e: any) {
      console.error("Sketchnote generation exception:", e);
      return c.json({ message: "Blad wywolywania API OpenAI." }, 500);
    }
  });

  router.post("/analyze", applyRateLimit("analyze"), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
    return c.json(result || { mode: "no-key" }, 200);
  });

  // Chunked upload: PUT /recordings/:id/audio/chunk?index=N&total=M
  router.put("/recordings/:recordingId/audio/chunk", async (c) => {
    const recordingId = c.req.param("recordingId");
    const workspaceId = c.req.header("X-Workspace-Id") || "";
    if (!workspaceId) return c.json({ message: "Brakuje X-Workspace-Id." }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const index = parseInt(c.req.query("index") || "", 10);
    const total = parseInt(c.req.query("total") || "", 10);
    if (isNaN(index) || isNaN(total) || index < 0 || total <= 0 || index >= total) {
      return c.json({ message: "Nieprawidłowe parametry chunka (index/total)." }, 400);
    }
    if (total > 600) return c.json({ message: "Za dużo chunków (max 600, ~1.2GB)." }, 400);

    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 3 * 1024 * 1024) return c.json({ message: "Chunk jest zbyt duży (max 3MB)." }, 413);

    const chunksDir = path.join(config.uploadDir, "chunks");
    mkdirSync(chunksDir, { recursive: true });

    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const chunkPath = path.join(chunksDir, `${safeId}_${index}.chunk`);
    writeFileSync(chunkPath, Buffer.from(buffer));

    return c.json({ index, total }, 200);
  });

  // Chunked upload finalize: POST /recordings/:id/audio/finalize
  router.post("/recordings/:recordingId/audio/finalize", async (c) => {
    const recordingId = c.req.param("recordingId");
    const session = c.get("session") as any;
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || c.req.header("X-Workspace-Id") || "";
    const meetingId = body.meetingId || c.req.header("X-Meeting-Id") || "";
    const contentType = body.contentType || "application/octet-stream";
    const total = parseInt(body.total || "0", 10);

    if (!workspaceId) return c.json({ message: "Brakuje workspaceId." }, 400);
    if (!total || total <= 0) return c.json({ message: "Brakuje total w ciele żądania." }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const chunksDir = path.join(config.uploadDir, "chunks");
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, "_");

    const parts: Buffer[] = [];
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(chunksDir, `${safeId}_${i}.chunk`);
      if (!existsSync(chunkPath)) return c.json({ message: `Brakuje chunka ${i} z ${total}.` }, 400);
      parts.push(readFileSync(chunkPath));
    }

    const fullBuffer = Buffer.concat(parts);
    if (fullBuffer.byteLength > 100 * 1024 * 1024) {
      return c.json({ message: "Złożony plik przekracza maksymalny rozmiar 100MB." }, 413);
    }

    let asset: MediaAsset;
    try {
      asset = await transcriptionService.upsertMediaAsset({
        recordingId, workspaceId, meetingId,
        contentType,
        buffer: fullBuffer,
        createdByUserId: session.user_id,
      });
    } catch (err: any) {
      if ((err as any).code === "ENOSPC" || String(err.message).includes("Brak miejsca na dysku")) {
        return c.json({ message: "Brak miejsca na dysku serwera. Skontaktuj sie z administratorem." }, 507);
      }
      throw err;
    }

    // Cleanup chunks after successful assembly
    for (let i = 0; i < total; i++) {
      try { unlinkSync(path.join(chunksDir, `${safeId}_${i}.chunk`)); } catch (_) {}
    }

    let audioQuality = null;
    try {
      audioQuality = await transcriptionService.analyzeAudioQuality(asset.file_path, {
        contentType: asset.content_type,
        signal: c.req.raw.signal,
      });
      await transcriptionService.saveAudioQualityDiagnostics(recordingId, audioQuality);
    } catch (error: any) {
      console.warn(`[mediaRoutes] Audio quality analysis failed for ${recordingId}:`, error?.message || error);
    }

    return c.json({ id: asset.id, workspaceId: asset.workspace_id, sizeBytes: asset.size_bytes, audioQuality }, 200);
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
      writeFileSync(tmpPath, buffer);
      const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, {});
      return c.json({ text }, 200);
    } finally {
      try { unlinkSync(tmpPath); } catch (_) {}
    }
  });

  return router;
}
