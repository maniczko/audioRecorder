import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

describe("services/config", () => {
  const originalLocation = window.location;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    process.env = { ...originalEnv };
  });

  test("keeps explicit local api base url on localhost", async () => {
    process.env.VITE_API_BASE_URL = "http://localhost:4000";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "localhost" },
    });

    const config = await import("./config");

    expect(config.API_BASE_URL).toBe("http://localhost:4000");
  });

  test("keeps explicit absolute railway url on hosted vercel previews", async () => {
    process.env.VITE_API_BASE_URL = "https://audiorecorder-production.up.railway.app";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "audiorecorder-preview.vercel.app" },
    });

    const config = await import("./config");

    expect(config.API_BASE_URL).toBe("https://audiorecorder-production.up.railway.app");
  });

  test("keeps explicit absolute railway url on hosted production domains", async () => {
    process.env.VITE_API_BASE_URL = "https://audiorecorder-production.up.railway.app";
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "audiorecorder.example.com" },
    });

    const config = await import("./config");

    expect(config.API_BASE_URL).toBe("https://audiorecorder-production.up.railway.app");
  });
});
