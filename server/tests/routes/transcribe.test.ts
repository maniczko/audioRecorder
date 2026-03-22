import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.ts";
import { __mockFs } from "../../tests/setup";

describe("Transcribe Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;

  beforeEach(() => {
    __mockFs.writeFileSync.mockClear();
    __mockFs.unlinkSync.mockClear();

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
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    expect(__mockFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockTranscriptionService.transcribeLiveChunk).toHaveBeenCalledTimes(1);
    expect(__mockFs.unlinkSync).toHaveBeenCalledTimes(1);
  });
});
