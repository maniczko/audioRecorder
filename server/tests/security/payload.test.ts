import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../app.ts";

describe("Security & Payload Limits", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const mockAuthService = {
      loginUser: vi.fn().mockResolvedValue({ id: "1", email: "test@example.com", token: "valid" }),
      getSession: vi.fn().mockResolvedValue({ user_id: "u1", workspace_id: "ws1" })
    };
    const mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: "admin" })
    };
    const mockTranscriptionService = {
      upsertMediaAsset: vi.fn().mockResolvedValue({ id: "rec1", workspace_id: "ws1", size_bytes: 100 }),
    };

    app = createApp({
      authService: mockAuthService as any,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" }
    });
  });

  // 1. Missing Authorization (401)
  it("GET /media/recordings/.../audio - 401 Unauthorized without token", async () => {
    const res = await app.request("/media/recordings/ignored/audio", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("GET /voice-profiles - 401 Unauthorized without token", async () => {
    const res = await app.request("/voice-profiles", { method: "GET" });
    expect(res.status).toBe(401);
  });

  // 2. Upload Limits (413)
  it("POST /voice-profiles - 413 Payload Too Large if > 1MB", async () => {
    const hugeBuffer = Buffer.alloc(1.5 * 1024 * 1024, "a"); // 1.5MB

    const res = await app.request("/voice-profiles", {
      method: "POST",
      headers: { "Authorization": "Bearer fake", "X-Speaker-Name": "Tester" },
      body: hugeBuffer
    });
    expect(res.status).toBe(413);
  });

  it("PUT /media/recordings/:id/audio - 413 Payload Too Large if > 100MB", async () => {
    const giantBuffer = Buffer.alloc(101 * 1024 * 1024, "x"); // 101MB

    const res = await app.request("/media/recordings/test_rec/audio", {
      method: "PUT",
      headers: { "Authorization": "Bearer fake", "X-Workspace-Id": "ws1" },
      body: giantBuffer
    });
    expect(res.status).toBe(413);
  });

  // 3. Bad Content-Type & JSON Validation
  it("POST /auth/login - 422 (or 400) when passing bad JSON/Content-Type", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "email=badformat" // Expected json
    });
    expect(res.status).toBe(400); // Hono zodValidator default is 400
  });

  it("POST /auth/login - 422 Unprocessable Entity passing missing required fields", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid-email" }) // missing password, invalid email string
    });
    // Expected to be picked up by zodValidator and thrown as 400 or 422
    expect([400, 422]).toContain(res.status);
  });

  // 4. Rate Limiting test
  it("POST /auth/login - 429 Too Many Requests after exceeding limit", async () => {
    // applyRateLimit("auth-login", 20) means 20 requests allowed per minute
    let any429 = false;
    for (let i = 0; i < 25; i++) {
        const res = await app.request("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com", password: "pwd" })
        });
        if (res.status === 429) {
            any429 = true;
            break;
        }
    }
    expect(any429).toBe(true);
  });
});
