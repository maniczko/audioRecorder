import { existsSync, createReadStream, createWriteStream, statSync, mkdirSync } from 'node:fs';
import { unlink, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { finished } from 'node:stream/promises';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { AppServices, AppMiddlewares } from './middleware.ts';
import { normalizeTranscriptionStatusPayload } from '../../src/shared/contracts.ts';
import type { MediaAsset } from '../lib/types.ts';

/**
 * Checks available disk space and returns true if there's enough space.
 * Returns false if disk space is critically low (<100MB free).
 */
function checkDiskSpace(
  uploadDir: string,
  minBytes: number = 100 * 1024 * 1024
): { ok: boolean; freeBytes?: number } {
  try {
    const fs = require('node:fs');
    const stats = fs.statfsSync ? fs.statfsSync(uploadDir) : null;

    if (stats) {
      const freeBytes = stats.bavail * stats.bsize;
      return { ok: freeBytes >= minBytes, freeBytes };
    }

    // Fallback: assume OK if we can't check
    return { ok: true };
  } catch (error) {
    console.warn('[checkDiskSpace] Unable to check disk space:', error);
    return { ok: true };
  }
}

/**
 * Cleans up old chunk files older than maxAgeHours.
 * Returns number of files deleted and bytes freed.
 */
async function cleanupOldChunks(
  uploadDir: string,
  maxAgeHours: number = 24
): Promise<{ deleted: number; bytesFreed: number }> {
  const chunksDir = path.join(uploadDir, 'chunks');

  if (!existsSync(chunksDir)) {
    return { deleted: 0, bytesFreed: 0 };
  }

  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let deleted = 0;
  let bytesFreed = 0;

  try {
    const files = require('node:fs').readdirSync(chunksDir);
    for (const file of files) {
      if (!file.endsWith('.chunk')) continue;

      const filePath = path.join(chunksDir, file);
      const stats = statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        bytesFreed += stats.size;
        await unlink(filePath);
        deleted++;
      }
    }

    if (deleted > 0) {
      const { logger } = await import('../logger.ts');
      logger.info(`[Cleanup] Deleted ${deleted} old chunk files, freed ${bytesFreed} bytes`);
    }
  } catch (error) {
    console.warn('[cleanupOldChunks] Error:', error);
  }

  return { deleted, bytesFreed };
}

export function createMediaRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();
  const { transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  const startTranscriptionPipeline =
    typeof transcriptionService.startTranscriptionPipeline === 'function'
      ? transcriptionService.startTranscriptionPipeline.bind(transcriptionService)
      : async (recordingId: string, asset: any, options: any) => {
          await transcriptionService.queueTranscription(recordingId, options);
          await transcriptionService.ensureTranscriptionJob(recordingId, asset, options);
          return transcriptionService.getMediaAsset(recordingId);
        };
  const uploadDir = config.uploadDir || process.env.VOICELOG_UPLOAD_DIR || './server/data/uploads';

  function resolveProcessingMode(input: any) {
    return input === 'full' || input === 'fast'
      ? input
      : config.VOICELOG_PROCESSING_MODE_DEFAULT || 'fast';
  }

  function scheduleAudioQuality(recordingId: string, asset: MediaAsset) {
    Promise.resolve()
      .then(async () => {
        const audioQuality = await transcriptionService.analyzeAudioQuality(asset.file_path, {
          contentType: asset.content_type,
        });
        await transcriptionService.saveAudioQualityDiagnostics(recordingId, audioQuality);
      })
      .catch((error: any) => {
        console.warn(
          `[mediaRoutes] Audio quality analysis failed for ${recordingId}:`,
          error?.message || error
        );
      });
  }

  async function assembleChunksToTempFile(chunksDir: string, safeId: string, total: number) {
    const tempPath = path.join(chunksDir, `${safeId}_assembled_${crypto.randomUUID()}.bin`);
    mkdirSync(path.dirname(tempPath), { recursive: true });
    const output = createWriteStream(tempPath);

    try {
      for (let i = 0; i < total; i += 1) {
        const chunkPath = path.join(chunksDir, `${safeId}_${i}.chunk`);
        if (!existsSync(chunkPath)) {
          throw new Error(`Brakuje chunka ${i} z ${total}.`);
        }

        await new Promise<void>((resolve, reject) => {
          const input = createReadStream(chunkPath);
          input.on('error', reject);
          output.on('error', reject);
          input.on('end', resolve);
          input.pipe(output, { end: false });
        });
      }

      output.end();
      await finished(output);
      return tempPath;
    } catch (error) {
      output.destroy();
      try {
        await unlink(tempPath);
      } catch (_) {}
      throw error;
    }
  }

  // --- Media & Processing ---
  router.use('/recordings', authMiddleware);
  router.use('/recordings/*', authMiddleware);
  router.put('/recordings/:recordingId/audio', async (c) => {
    const uploadStart = performance.now();
    const reqId = c.get('reqId');
    const session = c.get('session') as any;
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    const meetingId = c.req.header('X-Meeting-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 100 * 1024 * 1024)
      return c.json({ message: 'Przesłany plik przekracza maksymalny rozmiar.' }, 413);

    let asset: MediaAsset;
    try {
      asset = await transcriptionService.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: c.req.header('content-type') || 'application/octet-stream',
        buffer: Buffer.from(buffer),
        createdByUserId: session.user_id,
      });
    } catch (uploadErr: any) {
      if (
        (uploadErr as any).code === 'ENOSPC' ||
        String(uploadErr.message).includes('Brak miejsca na dysku')
      ) {
        return c.json(
          { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
          507
        );
      }
      throw uploadErr;
    }
    scheduleAudioQuality(recordingId, asset);

    // R04 Metrics
    const { logger } = await import('../logger.ts');
    logger.info(`[Metrics] Uploaded audio chunk`, {
      requestId: reqId,
      recordingId,
      sizeBytes: asset.size_bytes,
      durationMs: (performance.now() - uploadStart).toFixed(2),
    });

    return c.json(
      {
        id: asset.id,
        workspaceId: asset.workspace_id,
        sizeBytes: asset.size_bytes,
        audioQuality: null,
      },
      200
    );
  });

  router.get('/recordings/:recordingId/audio', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) {
        console.warn('[media] Audio 404 — no media_assets row', { recordingId });
        return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      }
      await ensureWorkspaceAccess(c, asset.workspace_id);

      const ALLOWED = new Set([
        'audio/webm',
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/ogg',
        'audio/flac',
        'application/octet-stream',
      ]);
      const safeType = ALLOWED.has(String(asset.content_type || '').toLowerCase())
        ? asset.content_type
        : 'application/octet-stream';

      // Supabase remote path — no OS path separator means it's a short Supabase key
      if (asset.file_path && !asset.file_path.includes('/') && !asset.file_path.includes('\\')) {
        try {
          const { downloadAudioFromStorage } = await import('../lib/supabaseStorage.js');
          const arrayBuffer = await downloadAudioFromStorage(asset.file_path);

          c.header('Content-Type', safeType);
          c.header('Content-Length', String(arrayBuffer.byteLength));
          c.header('Content-Disposition', 'attachment');
          return c.body(arrayBuffer as any, 200);
        } catch (err: any) {
          console.error('[media] Supabase download failed', {
            recordingId,
            filePath: asset.file_path,
            error: err.message,
          });
          return c.json(
            { message: 'Błąd podczas pobierania nagrania z remote storage.', error: err.message },
            500
          );
        }
      } else {
        // Local file path — try local first, then fall back to Supabase with basename
        if (existsSync(asset.file_path)) {
          const stream = createReadStream(asset.file_path);
          c.header('Content-Type', safeType);
          c.header('Content-Length', String(statSync(asset.file_path).size));
          c.header('Content-Disposition', 'attachment');
          return c.body(stream as any, 200);
        }

        // Local file missing (e.g. after redeploy) — try Supabase with just the filename
        try {
          const basename = path.basename(asset.file_path);
          const { downloadAudioFromStorage } = await import('../lib/supabaseStorage.js');
          const arrayBuffer = await downloadAudioFromStorage(basename);
          console.info('[media] Local file missing, served from Supabase fallback', {
            recordingId,
            localPath: asset.file_path,
            supabasePath: basename,
          });

          c.header('Content-Type', safeType);
          c.header('Content-Length', String(arrayBuffer.byteLength));
          c.header('Content-Disposition', 'attachment');
          return c.body(arrayBuffer as any, 200);
        } catch {
          console.warn('[media] Audio 404 — local file missing, Supabase fallback failed', {
            recordingId,
            filePath: asset.file_path,
          });
          return c.json({ message: 'Plik audio nie istnieje.' }, 404);
        }
      }
    } catch (err: any) {
      console.error(`[audio] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad pobierania audio.' }, status);
    }
  });

  router.get('/recordings', async (c) => {
    const workspaceId = c.req.query('workspaceId');
    if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const recordings = await transcriptionService.getMediaRecordings(workspaceId);
    return c.json({ recordings: recordings || [] }, 200);
  });

  router.delete('/recordings/:recordingId', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);

    // Ensure the user has rights to delete from this workspace
    await ensureWorkspaceAccess(c, asset.workspace_id);

    try {
      // Note: transcriptionService is Database instance here
      await transcriptionService.deleteMediaAsset(recordingId, asset.workspace_id);
      return c.body(null, 204);
    } catch (err: any) {
      return c.json({ message: 'Błąd podczas usuwania nagrania.', error: err.message }, 500);
    }
  });

  router.post('/recordings/:recordingId/transcribe', async (c) => {
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, body.workspaceId || asset.workspace_id);

    try {
      const result = await startTranscriptionPipeline(recordingId, asset, {
        ...body,
        processingMode: resolveProcessingMode(body.processingMode),
        requestId: c.get('reqId'),
      });

      return c.json(normalizeTranscriptionStatusPayload(result), 202);
    } catch (err: any) {
      console.error(`[transcribe] Pipeline error for ${recordingId}:`, err?.message);
      const status = err?.statusCode || err?.status || 502;
      return c.json(
        { message: err?.message || 'Błąd przetwarzania transkrypcji.', recordingId },
        status
      );
    }
  });

  router.post('/recordings/:recordingId/retry-transcribe', async (c) => {
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    if (!asset.file_path) {
      return c.json({ message: 'Brak ścieżki pliku do ponownego przetworzenia.' }, 409);
    }

    if (
      (asset.file_path.includes('/') || asset.file_path.includes('\\')) &&
      !existsSync(asset.file_path)
    ) {
      return c.json({ message: 'Lokalny plik audio nie istnieje.' }, 409);
    }

    try {
      const result = await startTranscriptionPipeline(recordingId, asset, {
        workspaceId: asset.workspace_id,
        meetingId: asset.meeting_id,
        contentType: asset.content_type,
        processingMode: resolveProcessingMode(body.processingMode),
        requestId: c.get('reqId'),
      });

      return c.json(normalizeTranscriptionStatusPayload(result), 202);
    } catch (err: any) {
      console.error(`[retry-transcribe] Pipeline error for ${recordingId}:`, err?.message);
      const status = err?.statusCode || err?.status || 502;
      return c.json(
        { message: err?.message || 'Błąd przetwarzania transkrypcji.', recordingId },
        status
      );
    }
  });

  router.get('/recordings/:recordingId/transcribe', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      return c.json(normalizeTranscriptionStatusPayload(asset), 200);
    } catch (err: any) {
      console.error(`[transcribe-status] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Błąd pobierania statusu transkrypcji.' }, status);
    }
  });

  router.get('/recordings/:recordingId/progress', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');

      return streamSSE(c, async (stream) => {
        let active = true;

        const progressCallback = async (data: any) => {
          if (!active) return;
          await stream.writeSSE({
            data: JSON.stringify(data),
            event: 'progress',
          });
        };

        transcriptionService.on(`progress-${recordingId}`, progressCallback);

        const pingId = setInterval(async () => {
          if (active) {
            await stream
              .writeSSE({ data: JSON.stringify({ ping: 'stay-alive' }), event: 'ping' })
              .catch(() => {});
          }
        }, 15000);

        c.req.raw.signal.addEventListener('abort', () => {
          active = false;
          clearInterval(pingId);
          transcriptionService.removeListener(`progress-${recordingId}`, progressCallback);
        });

        await new Promise(() => {});
      });
    } catch (err: any) {
      console.error(`[progress] SSE error:`, err?.message);
      return c.json({ message: err?.message || 'Błąd strumienia postępu.' }, 500);
    }
  });

  router.post('/recordings/:recordingId/normalize', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      await transcriptionService.normalizeRecording(asset.file_path, { signal: c.req.raw.signal });
      return c.json({ ok: true }, 200);
    } catch (err: any) {
      console.error(`[normalize] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad normalizacji.' }, status);
    }
  });

  router.post('/recordings/:recordingId/voice-profiles/from-speaker', async (c) => {
    const session = c.get('session') as any;
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    try {
      const profile = await transcriptionService.createVoiceProfileFromSpeaker(
        asset,
        body.speakerId,
        body.speakerName,
        session.user_id,
        {}
      );
      return c.json(profile, 201);
    } catch (err: any) {
      return c.json({ message: err.message }, 400);
    }
  });

  router.post('/recordings/:recordingId/voice-coaching', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const body = await c.req.json().catch(() => ({}));
      if (body.speakerId === undefined || body.speakerId === null)
        return c.json({ message: 'Brakuje speakerId.' }, 400);
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      const coaching = await transcriptionService.generateVoiceCoaching(
        asset,
        String(body.speakerId),
        body?.segments || [],
        {}
      );
      return c.json({ coaching }, 200);
    } catch (err: any) {
      console.error(`[voice-coaching] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad generowania voice coaching.' }, status);
    }
  });

  router.post('/recordings/:recordingId/acoustic-features', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);
      const payload = await transcriptionService.getSpeakerAcousticFeatures(asset, {
        signal: c.req.raw.signal,
      });
      return c.json(payload, 200);
    } catch (err: any) {
      console.error(`[acoustic-features] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad analizy akustycznej.' }, status);
    }
  });

  router.post('/recordings/:recordingId/rediarize', async (c) => {
    try {
      const recordingId = c.req.param('recordingId');
      const asset = await transcriptionService.getMediaAsset(recordingId);
      if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
      await ensureWorkspaceAccess(c, asset.workspace_id);

      let stored = [] as any[];
      try {
        stored = JSON.parse(asset.transcript_json || '[]');
      } catch (_) {}
      if (!stored.length) return c.json({ message: 'Brak transkrypcji.' }, 400);

      const whisperLike = stored
        .map((s) => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp }))
        .filter((s) => s.text);
      const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
      if (!diarization) return c.json({ message: 'Diaryzacja nie powiodla sie.' }, 422);

      const updated = diarization.segments.map((seg: any, idx: number) => ({
        ...(stored[idx] || {}),
        id: stored[idx]?.id || seg.id,
        text: seg.text,
        timestamp: seg.timestamp,
        endTimestamp: seg.endTimestamp,
        speakerId: seg.speakerId,
        rawSpeakerLabel: seg.rawSpeakerLabel,
      }));
      await transcriptionService.saveTranscriptionResult(recordingId, {
        segments: updated,
        diarization,
        pipelineStatus: 'completed',
      });
      return c.json(
        {
          speakerCount: diarization.speakerCount,
          speakerNames: diarization.speakerNames,
          segments: updated,
        },
        200
      );
    } catch (err: any) {
      console.error(`[rediarize] Error:`, err?.message);
      const status = err?.statusCode || err?.status || 500;
      return c.json({ message: err?.message || 'Blad rediaryzacji.' }, status);
    }
  });

  router.post('/recordings/:recordingId/sketchnote', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);

    let diarization: any = {};
    try {
      diarization = JSON.parse(asset.diarization_json || '{}');
    } catch (_) {}

    // Accept analysis data from request body (frontend state) or fall back to stored diarization_json
    const body: any = await c.req.json().catch(() => ({}));

    const summaryText =
      body?.summary || diarization?.reviewSummary?.summary || diarization?.summary;
    if (!summaryText)
      return c.json({ message: 'Brak podsumowania do wygenerowania sketchnotki.' }, 400);

    const asList = (value: any) =>
      (Array.isArray(value) ? value : [])
        .map((item) =>
          String(
            typeof item === 'object'
              ? item?.title || item?.text || item?.value || item?.label || ''
              : item || ''
          ).trim()
        )
        .filter(Boolean);
    const decisions = asList(body?.decisions || diarization?.decisions);
    const actionItems = asList(body?.actionItems || diarization?.actionItems || diarization?.tasks);
    const followUps = asList(body?.followUps || diarization?.followUps);
    const risks = asList(body?.risks || diarization?.risks);
    const blockers = asList(body?.blockers || diarization?.blockers);
    const quotes = asList(body?.keyQuotes || diarization?.keyQuotes).slice(0, 2);

    if (!process.env.GEMINI_API_KEY) {
      return c.json({ message: 'Brak klucza GEMINI_API_KEY w konfiguracji środowiska.' }, 400);
    }

    try {
      const { logger } = await import('../logger.ts');
      logger.info(`Generating Gemini 3 Pro Image sketchnote for recording ${recordingId}...`);

      const prompt = `Create a polished hand-drawn sketchnote poster in Polish that summarizes this meeting.
Style requirements:
- white or warm paper background
- bold black hand-lettered headings
- thick marker outlines
- soft yellow highlights
- a few doodles, arrows, speech bubbles, sticky-note callouts
- clear hierarchy with 4-6 large visual zones
- generous spacing and strong visual rhythm
- readable Polish text with large headings
- thick black contours and marker shading
- feel like a real workshop whiteboard/sketchnote, not a generic infographic
- use a friendly, handcrafted, imperfect look
- balance text blocks, icons, and bubbles like a social-media sketchnote
- do not make it look corporate or sterile

Layout suggestion:
- top left: bold title block
- top right: small icon cluster or quick theme callout
- middle: 2 or 3 boxed sections for key content
- lower area: action plan / next steps / risks
- add doodle arrows connecting the sections

Content to include:
Meeting summary:
${summaryText.substring(0, 1200)}

Decisions:
${decisions.length ? decisions.map((item) => `- ${item}`).join('\n') : '- none'}

Action items:
${actionItems.length ? actionItems.map((item) => `- ${item}`).join('\n') : '- none'}

Next steps:
${followUps.length ? followUps.map((item) => `- ${item}`).join('\n') : '- none'}

Risks / blockers:
${[...risks, ...blockers].length ? [...risks, ...blockers].map((item) => `- ${item}`).join('\n') : '- none'}

Key quotes:
${quotes.length ? quotes.map((item) => `- ${item}`).join('\n') : '- none'}

Important:
- make it look like a handcrafted visual note
- do not use photorealism
- do not include tiny unreadable text
- use a 4:3 composition
- prioritize visual clarity over dense text`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: {
                aspectRatio: '4:3',
                imageSize: '4K',
              },
              thinkingConfig: {
                thinkingLevel: 'medium',
              },
            },
          }),
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        logger.error('Gemini image gen error:', errBody);
        const detail = errBody.slice(0, 300);
        return c.json(
          { message: 'Blad generowania obrazu Gemini.', status: res.status, detail },
          500
        );
      }

      const data = await res.json();
      const inlineImage = data.candidates?.[0]?.content?.parts?.find(
        (part: any) => part?.inlineData?.data
      )?.inlineData;
      if (!inlineImage?.data) {
        return c.json({ message: 'Model Gemini nie wygenerował obrazu.' }, 500);
      }

      const mimeType = String(inlineImage.mimeType || 'image/png').trim() || 'image/png';
      const imageUrl = `data:${mimeType};base64,${inlineImage.data}`;

      if (imageUrl) {
        diarization.sketchnoteUrl = imageUrl;
        if (typeof transcriptionService._execute === 'function') {
          await transcriptionService._execute(
            'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(diarization), new Date().toISOString(), recordingId]
          );
        }
      }

      return c.json({ sketchnoteUrl: imageUrl }, 200);
    } catch (e: any) {
      console.error('Sketchnote generation exception:', e);
      return c.json({ message: 'Blad wywolywania API Gemini.' }, 500);
    }
  });

  router.post('/analyze', applyRateLimit('analyze'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
    return c.json(result || { mode: 'no-key' }, 200);
  });

  // Chunked upload: PUT /recordings/:id/audio/chunk?index=N&total=M
  router.get('/recordings/:recordingId/audio/chunk-status', async (c) => {
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const total = parseInt(c.req.query('total') || '', 10);
    if (isNaN(total) || total <= 0) {
      return c.json({ message: 'Brakuje poprawnego parametru total.' }, 400);
    }

    const chunksDir = path.join(config.uploadDir, 'chunks');
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!existsSync(chunksDir)) {
      return c.json({ nextIndex: 0, uploaded: 0, total, resumable: false }, 200);
    }

    let nextIndex = 0;
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(chunksDir, `${safeId}_${i}.chunk`);
      if (!existsSync(chunkPath)) {
        break;
      }
      nextIndex = i + 1;
    }

    return c.json(
      {
        nextIndex,
        uploaded: nextIndex,
        total,
        resumable: nextIndex > 0 && nextIndex < total,
      },
      200
    );
  });

  router.put('/recordings/:recordingId/audio/chunk', async (c) => {
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const index = parseInt(c.req.query('index') || '', 10);
    const total = parseInt(c.req.query('total') || '', 10);
    if (isNaN(index) || isNaN(total) || index < 0 || total <= 0 || index >= total) {
      return c.json({ message: 'Nieprawidłowe parametry chunka (index/total).' }, 400);
    }
    if (total > 600) return c.json({ message: 'Za dużo chunków (max 600, ~1.2GB).' }, 400);

    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 3 * 1024 * 1024)
      return c.json({ message: 'Chunk jest zbyt duży (max 3MB).' }, 413);

    // Check disk space before writing
    const diskSpace = checkDiskSpace(uploadDir, 50 * 1024 * 1024); // 50MB minimum
    if (!diskSpace.ok) {
      const { logger } = await import('../logger.ts');
      logger.error(`[ENOSPC] Disk space critically low: ${diskSpace.freeBytes} bytes free`);
      return c.json(
        {
          message:
            'Brak miejsca na dysku serwera. Zwolnij miejsce lub skontaktuj z administratorem.',
          freeBytes: diskSpace.freeBytes,
        },
        507
      );
    }

    const chunksDir = path.join(config.uploadDir, 'chunks');
    mkdirSync(chunksDir, { recursive: true });

    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const chunkPath = path.join(chunksDir, `${safeId}_${index}.chunk`);

    try {
      await writeFile(chunkPath, Buffer.from(buffer));
    } catch (writeErr: any) {
      if (writeErr.code === 'ENOSPC') {
        const { logger } = await import('../logger.ts');
        logger.error(
          `[ENOSPC] Failed to write chunk ${index}/${total} for recording ${recordingId}`
        );
        // Cleanup partial write
        try {
          await unlink(chunkPath);
        } catch (_) {}
        return c.json({ message: 'Brak miejsca na dysku podczas zapisu chunka.' }, 507);
      }
      throw writeErr;
    }

    return c.json({ index, total }, 200);
  });

  // Chunked upload finalize: POST /recordings/:id/audio/finalize
  router.post('/recordings/:recordingId/audio/finalize', async (c) => {
    const recordingId = c.req.param('recordingId');
    const session = c.get('session') as any;
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || c.req.header('X-Workspace-Id') || '';
    const meetingId = body.meetingId || c.req.header('X-Meeting-Id') || '';
    const contentType = body.contentType || 'application/octet-stream';
    const total = parseInt(body.total || '0', 10);

    if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
    if (!total || total <= 0) return c.json({ message: 'Brakuje total w ciele żądania.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);

    const chunksDir = path.join(config.uploadDir, 'chunks');
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');

    let assembledPath = '';
    try {
      assembledPath = await assembleChunksToTempFile(chunksDir, safeId, total);
    } catch (error: any) {
      return c.json({ message: error?.message || 'Nie udalo sie zlozyc chunkow.' }, 400);
    }

    const fullStats = await stat(assembledPath);
    if (fullStats.size > 500 * 1024 * 1024) {
      try {
        await unlink(assembledPath);
      } catch (_) {}
      return c.json(
        {
          message:
            'Złożony plik przekracza maksymalny rozmiar 500MB. Skompresuj nagranie do formatu WebM lub MP3.',
        },
        413
      );
    }

    let asset: MediaAsset;
    try {
      asset = await transcriptionService.upsertMediaAssetFromPath({
        recordingId,
        workspaceId,
        meetingId,
        contentType,
        filePath: assembledPath,
        createdByUserId: session.user_id,
      });
    } catch (err: any) {
      try {
        await unlink(assembledPath);
      } catch (_) {}
      if ((err as any).code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        return c.json(
          { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
          507
        );
      }
      throw err;
    }

    // Cleanup chunks after successful assembly
    for (let i = 0; i < total; i++) {
      try {
        await unlink(path.join(chunksDir, `${safeId}_${i}.chunk`));
      } catch (_) {}
    }
    try {
      await unlink(assembledPath);
    } catch (_) {}

    scheduleAudioQuality(recordingId, asset);

    return c.json(
      {
        id: asset.id,
        workspaceId: asset.workspace_id,
        sizeBytes: asset.size_bytes,
        audioQuality: null,
      },
      200
    );
  });

  // Disk space management endpoints
  router.get('/disk-space/status', async (c) => {
    const diskSpace = checkDiskSpace(uploadDir, 0); // Check without minimum
    return c.json({
      ok: diskSpace.ok,
      freeBytes: diskSpace.freeBytes || null,
      freeMB: diskSpace.freeBytes ? Math.round(diskSpace.freeBytes / 1024 / 1024) : null,
      timestamp: new Date().toISOString(),
    });
  });

  router.post('/disk-space/cleanup', async (c) => {
    const session = c.get('session') as any;
    // Only allow admin users
    if (!session || session.role !== 'admin') {
      return c.json({ message: 'Wymagane uprawnienia administratora.' }, 403);
    }

    const maxAgeHours = parseInt(c.req.query('maxAge') || '24', 10);
    const result = await cleanupOldChunks(uploadDir, Math.min(maxAgeHours, 168)); // Max 1 week

    return c.json({
      success: true,
      deleted: result.deleted,
      bytesFreed: result.bytesFreed,
      mbFreed: Math.round(result.bytesFreed / 1024 / 1024),
    });
  });

  return router;
}

export function createTranscribeRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any } }>();
  const { transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit } = middlewares;

  router.post('/live', authMiddleware, applyRateLimit('live-transcribe', 60), async (c) => {
    const contentType = c.req.header('content-type') || 'audio/webm';
    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 5 * 1024 * 1024)
      return c.json({ message: 'Payload too large' }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 500) return c.json({ text: '' }, 200);

    const ext = contentType.includes('mp4')
      ? '.m4a'
      : contentType.includes('wav')
        ? '.wav'
        : '.webm';
    const tmpPath = path.join(
      config.uploadDir,
      `live_${crypto.randomUUID().replace(/-/g, '')}${ext}`
    );
    try {
      await writeFile(tmpPath, buffer);
      const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, {});
      return c.json({ text }, 200);
    } finally {
      try {
        await unlink(tmpPath);
      } catch (_) {}
    }
  });

  return router;
}
