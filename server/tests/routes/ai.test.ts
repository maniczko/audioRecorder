import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

describe("AI Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;

  beforeEach(async () => {
    vi.resetModules();

    mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ userId: "u1", workspaceId: "ws1" }),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ role: "owner" }),
    };
    mockTranscriptionService = {};

    const { createApp } = await import("../../app.ts");
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /ai/person-profile", () => {
    test("returns no-key mode when ANTHROPIC_API_KEY is not configured", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");

      const res = await app.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: "Anna",
          meetings: [{ id: "m1" }],
          allSegments: Array(10).fill({ text: "test", meetingTitle: "Meeting" }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("no-key");
    });

    test("returns no-key mode when personName is missing", async () => {
      const res = await app.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetings: [{ id: "m1" }],
          allSegments: Array(10).fill({ text: "test", meetingTitle: "Meeting" }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("no-key");
    });

    test("returns no-key mode when allSegments has less than 5 items", async () => {
      const res = await app.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: "Anna",
          meetings: [{ id: "m1" }],
          allSegments: [{ text: "test", meetingTitle: "Meeting" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("no-key");
    });

    test("calls Anthropic API and returns parsed profile when API key is configured", async () => {
      // stubEnv must happen before resetModules+import so config reads the key
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
      vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-4-6");
      vi.resetModules();
      const { createApp: createAppWithKey } = await import("../../app.ts");
      const appWithKey = createAppWithKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{
            text: JSON.stringify({
              disc: { D: 65, I: 45, S: 70, C: 55 },
              discStyle: "SC — stabilny",
              discDescription: "Opis stylu",
              values: [{ value: "bezpieczeństwo", icon: "🛡️", quote: "cytat" }],
              communicationStyle: "analytical",
              decisionStyle: "data-driven",
              conflictStyle: "collaborative",
              listeningStyle: "active",
              stressResponse: "Reaguje spokojnie",
              workingWithTips: ["Wskazówka 1"],
              communicationDos: ["Co robić"],
              communicationDonts: ["Czego unikać"],
              redFlags: ["Wzorzec"],
              coachingNote: "Obserwacja",
            }),
          }],
        }),
      });

      const res = await appWithKey.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: "Anna",
          meetings: [{ id: "m1", title: "Meeting" }],
          allSegments: Array(10).fill({ text: "test statement", meetingTitle: "Meeting" }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("anthropic");
      expect(json.meetingsAnalyzed).toBe(1);
      expect(json.disc).toBeDefined();
      expect(json.discStyle).toBe("SC — stabilny");
    });

    test("returns no-key mode when Anthropic API fails", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const res = await app.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: "Anna",
          meetings: [{ id: "m1" }],
          allSegments: Array(10).fill({ text: "test", meetingTitle: "Meeting" }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("no-key");
    });

    test("returns no-key mode when Anthropic returns non-JSON response", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: "This is not JSON" }],
        }),
      });

      const res = await app.request("/ai/person-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName: "Anna",
          meetings: [{ id: "m1" }],
          allSegments: Array(10).fill({ text: "test", meetingTitle: "Meeting" }),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mode).toBe("no-key");
    });
  });

  describe("POST /ai/suggest-tasks", () => {
    test("returns empty tasks when ANTHROPIC_API_KEY is not configured", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "");

      const res = await app.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ speakerName: "Anna", text: "We need to finish the report" }],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test("returns empty tasks when transcript is empty", async () => {
      const res = await app.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test("calls Anthropic API and returns extracted tasks when API key is configured", async () => {
      // stubEnv must happen before resetModules+import so config reads the key
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
      vi.resetModules();
      const { createApp: createAppWithKey } = await import("../../app.ts");
      const appWithKey = createAppWithKey({
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{
            type: "text",
            text: JSON.stringify({
              tasks: [
                {
                  title: "Finish report",
                  description: "Complete the quarterly report by Friday",
                  owner: "Anna",
                  dueDate: "2026-03-27",
                  priority: "high",
                  tags: ["urgent", "report"],
                },
              ],
            }),
          }],
        }),
      });

      const res = await appWithKey.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ speakerName: "Anna", text: "We need to finish the report by Friday" }],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toHaveLength(1);
      expect(json.tasks[0].title).toBe("Finish report");
      expect(json.tasks[0].owner).toBe("Anna");
      expect(json.tasks[0].priority).toBe("high");
    });

    test("returns empty tasks when Anthropic API fails", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const res = await app.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ speakerName: "Anna", text: "We need to finish the report" }],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test("returns empty tasks when Anthropic returns non-JSON response", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: "This is not JSON" }],
        }),
      });

      const res = await app.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ speakerName: "Anna", text: "We need to finish the report" }],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });

    test("returns empty tasks when response has no tasks array", async () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({ unexpected: true }) }],
        }),
      });

      const res = await app.request("/ai/suggest-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: [{ speakerName: "Anna", text: "We need to finish the report" }],
          people: [{ name: "Anna" }],
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.tasks).toEqual([]);
    });
  });
});

async function createApp(config: any) {
  const { createApp } = await import("../../app.ts");
  return createApp(config);
}
