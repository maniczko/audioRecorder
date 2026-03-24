```typescript
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { logger } from "./logger.ts";
import { config } from "./config.ts";
import { resolveBuildMetadata } from "./runtime.ts";
import type { SessionPayload, WorkspaceStatePayload } from "../src/shared/contracts.ts";
import { 
  UserProfile, 
  UserDraft, 
  MeetingUpdates, 
  MediaAsset, 
  AudioQualityDiagnostics,
  TranscriptionResult, 
  WorkspaceState 
} from "./lib/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENOSPC_MESSAGE = "Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.";

function _resolveWritableUploadDir(preferredDir: string): string {
  const normalizedPreferred = path.resolve(preferredDir);
  const candidates = Array.from(new Set([
    normalizedPreferred,
    path.resolve(process.cwd(), "server", "data", "uploads"),
    path.resolve(process.cwd(), ".tmp", "uploads"),
    path.join(os.tmpdir(), "voicelog", "uploads"),
  ]));

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      const probePath = path.join(candidate, `.write-probe-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probePath, "");
      fs.unlinkSync(probePath);
      if (candidate !== normalizedPreferred) {
        logger.warn(`[database] Upload dir ${normalizedPreferred} is not writable, falling back to ${candidate}.`);
      }
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No writable upload directory available. Preferred: ${normalizedPreferred}`);
}

function _cleanupOldLocalFiles(uploadDir: string): void {
  try {
    const files = fs.readdirSync(uploadDir)
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(uploadDir, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);
    const toDelete = files.slice(0, Math.max(1, Math.floor(files.length * 0.2)));
    for (const file of toDelete) {
      try { fs.unlinkSync(path.join(uploadDir, file.name)); } catch (_) {}
    }
    logger.warn(`[database] Zwolniono miejsce: usunieto ${toDelete.length} starych plikow audio.`);
  } catch (_) {}
}

function _writeLocalAudioFile(uploadDir: string, filename: string, buffer: Buffer): string {
  fs.mkdirSync(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, filename);
  try {
    fs.writeFileSync(localPath, buffer);
    return localPath;
  } catch (err: any) {
    if (err.code === "ENOSPC") {
      logger.warn("[database] ENOSPC przy zapisie audio — probuje zwolnic miejsce i ponowic.");
      _cleanupOldLocalFiles(uploadDir);
      try {
        fs.writeFileSync(localPath, buffer);
        return localPath;
      } catch (retryErr: any) {
        throw retryErr;
      }
    }
    throw err;
  }
}
```
