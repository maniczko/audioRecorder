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

  it("POST /auth/login - happy path", async () => {
    mockAuthService.loginUser.mockResolvedValue({ id: "123", email: "test@example.com", token: "valid_login_token" });

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "password123" })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBe("valid_login_token");
    expect(mockAuthService.loginUser).toHaveBeenCalledWith(expect.objectContaining({ email: "test@example.com" }));
  });

  it("OPTIONS /auth/login - returns CORS headers for vercel preview origins", async () => {
    const previewOrigin = "https://audiorecorder-rggk30uoj-iwoczajka-2703s-projects.vercel.app";
    const res = await app.request("/auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: previewOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type,Authorization",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("GET /auth/session - returns 401 on missing token", async () => {
    const res = await app.request("/auth/session", { method: "GET" });
    expect(res.status).toBe(401);
  });
});
