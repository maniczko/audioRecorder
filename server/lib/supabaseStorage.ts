import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { config } from "../config";

const SUPABASE_URL = config.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseUrlValid = SUPABASE_URL.startsWith("http");
export const supabase = (supabaseUrlValid && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const BUCKET_NAME = "recordings";
let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured || !supabase) return;
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: false });
  if (error && !error.message?.includes("already exists")) {
    console.warn(`[Supabase Storage] Bucket creation warning: ${error.message}`);
  }
  bucketEnsured = true;
}

/**
 * Uploads a buffer to Supabase Storage.
 * Returns null if Supabase is not configured (caller should fall back to local).
 */
export async function uploadAudioToStorage(recordingId: string, buffer: Buffer, contentType: string, extension: string): Promise<string | null> {
  if (!supabase) {
    return null; // Supabase not configured — caller falls back to local fs
  }
  
  await ensureBucket();
  
  const safeRecordingId = String(recordingId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeRecordingId}${extension}`;
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });
    
  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }
  
  return data.path;
}

export async function uploadAudioFileToStorage(recordingId: string, filePath: string, contentType: string, extension: string): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  await ensureBucket();

  const safeRecordingId = String(recordingId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeRecordingId}${extension}`;
  const body = fs.createReadStream(filePath);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, body as any, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return data.path;
}

/**
 * Downloads a file from Supabase Storage.
 * @param path The storage path of the file.
 * @returns The file content as an ArrayBuffer.
 */
export async function downloadAudioFromStorage(path: string): Promise<ArrayBuffer> {
  if (!supabase) {
    throw new Error("Supabase credentials not configured.");
  }
  
  const { data, error } = await supabase.storage
    .from("recordings")
    .download(path);
    
  if (error) {
    throw new Error(`Failed to download from Supabase Storage: ${error.message}`);
  }
  
  return await data.arrayBuffer();
}

/**
 * Deletes a file from Supabase Storage.
 * @param path The storage path of the file.
 */
export async function deleteAudioFromStorage(path: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase credentials not configured.");
  }
  
  const { error } = await supabase.storage
    .from("recordings")
    .remove([path]);
    
  if (error) {
    // We log but don't throw to prevent blocking the DB deletion if the file is already gone
    console.warn(`[Supabase Storage] Failed to delete file ${path}:`, error.message);
  }
}
