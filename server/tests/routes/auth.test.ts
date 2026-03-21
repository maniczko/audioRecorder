import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../app.ts";

describe("Auth Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockAuthService = {
      registerUser: vi.fn(),
      loginUser: vi.fn(),
      getSession: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn(),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: {},
      config: { allowedOrigins: "http://localhost:3000", trustProxy: false, uploadDir: "/tmp" }
    });
  });

  it("POST /auth/register - happy path", async () => {
    mockAuthService.registerUser.mockResolvedValue({ id: "123", email: "test@example.com", token: "abc" });

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
        name: "Test User"
      })
    });

    if (res.status !== 201) console.log("REGISTER ERROR:", await res.clone().json());
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.token).toBe("abc");
    expect(mockAuthService.registerUser).toHaveBeenCalledWith(expect.objectContaining({ email: "test@example.com" }));
  });

  it("POST /auth/login - missing password", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" })
    });

    if (res.status !== 400) console.log("LOGIN ERROR:", await res.clone().json());
    // Zod validation should fail
    expect(res.status).toBe(400);
  });
});
