import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { createApp } from "../../app.ts";

describe("Transcribe Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  const originalWriteFileSync = fs.writeFileSync;
  const originalUnlinkSync = fs.unlinkSync;

  beforeEach(() => {
    mockTranscriptionService = {
      transcribeLiveChunk: vi.fn().mockResolvedValue("hello live"),
    };

    const testAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: "u1", workspace_id: "ws1" }),
    };

    app = createApp({
      authService: testAuthService as any,
      workspaceService: { getMembership: vi.fn() } as any,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" },
    });

    fs.writeFileSync = vi.fn() as any;
    fs.unlinkSync = vi.fn() as any;
  });

  afterEach(() => {
    fs.writeFileSync = originalWriteFileSync;
    fs.unlinkSync = originalUnlinkSync;
  });

  it("returns empty text for too-small live chunks", async () => {
    const res = await app.request("/transcribe/live", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "audio/webm" },
      body: Buffer.alloc(100),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "" });
    expect(mockTranscriptionService.transcribeLiveChunk).not.toHaveBeenCalled();
  });

  it("rejects oversized live transcription payloads", async () => {
    const res = await app.request("/transcribe/live", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "audio/webm" },
      body: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
    });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: "Payload too large" });
  });

  it("writes temp file, transcribes, and cleans up successful live chunk", async () => {
    const res = await app.request("/transcribe/live", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "audio/wav" },
      body: Buffer.alloc(1000, 1),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "hello live" });
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionService.transcribeLiveChunk).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });
});
