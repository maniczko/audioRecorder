function readMode(value, fallback = "local") {
  return value === "remote" ? "remote" : fallback;
}

export const APP_DATA_PROVIDER = readMode(import.meta.env.VITE_DATA_PROVIDER, "local");
export const MEDIA_PIPELINE_PROVIDER = readMode(import.meta.env.VITE_MEDIA_PROVIDER, "local");
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim();

export function remoteApiEnabled() {
  return Boolean(API_BASE_URL);
}
