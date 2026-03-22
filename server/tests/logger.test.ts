import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/node";

// Mock Sentry at the top level before any imports
vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

describe("logger", () => {
  const originalEnv = process.env;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Clear Sentry mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("logger.info", () => {
    it("logs info message without metadata", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.info("Test message");
      
      expect(consoleLogSpy).toHaveBeenCalledWith("[INFO] Test message", "");
    });

    it("logs info message with metadata", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.info("Test message", { key: "value" });
      
      expect(consoleLogSpy).toHaveBeenCalledWith("[INFO] Test message", { key: "value" });
    });

    it("logs info message with multiple metadata fields", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.info("Test message", { key1: "value1", key2: "value2" });
      
      expect(consoleLogSpy).toHaveBeenCalledWith("[INFO] Test message", { key1: "value1", key2: "value2" });
    });

    it("logs info message with empty metadata object", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.info("Test message", {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith("[INFO] Test message", "");
    });
  });

  describe("logger.warn", () => {
    it("logs warn message without metadata", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.warn("Test warning");
      
      expect(consoleWarnSpy).toHaveBeenCalledWith("[WARN] Test warning", "");
    });

    it("logs warn message with metadata", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.warn("Test warning", { key: "value" });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith("[WARN] Test warning", { key: "value" });
    });

    it("captures warning to Sentry when SENTRY_DSN is set", async () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";

      const { logger } = await import("../logger.ts");

      logger.warn("Test warning");

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Test warning", "warning");
    });

    it("does not capture warning to Sentry when SENTRY_DSN is not set", async () => {
      delete process.env.SENTRY_DSN;

      const { logger } = await import("../logger.ts");

      logger.warn("Test warning");

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe("logger.error", () => {
    it("logs error message without error object", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.error("Test error");
      
      expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] Test error", "");
    });

    it("logs error message with error object", async () => {
      const { logger } = await import("../logger.ts");
      const error = new Error("Test error");
      
      logger.error("Test error", error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] Test error", error);
    });

    it("logs error message with null error", async () => {
      const { logger } = await import("../logger.ts");
      
      logger.error("Test error", null);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] Test error", "");
    });

    it("captures Error to Sentry when SENTRY_DSN is set", async () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";

      const { logger } = await import("../logger.ts");
      const error = new Error("Test error");

      logger.error("Test error", error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it("captures message to Sentry when SENTRY_DSN is set and error is not Error instance", async () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";

      const { logger } = await import("../logger.ts");

      logger.error("Test error", "string error");

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Test error", "error");
    });

    it("does not capture error to Sentry when SENTRY_DSN is not set", async () => {
      delete process.env.SENTRY_DSN;

      const { logger } = await import("../logger.ts");
      const error = new Error("Test error");

      logger.error("Test error", error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe("logger exports", () => {
    it("exports logger object with info, warn, and error methods", async () => {
      const { logger } = await import("../logger.ts");
      
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });
  });

  describe("Sentry initialization", () => {
    it("initializes Sentry when SENTRY_DSN is configured", async () => {
      process.env.SENTRY_DSN = "https://test@sentry.io/123";
      process.env.NODE_ENV = "production";

      await import("../logger.ts");

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://test@sentry.io/123",
          environment: "production",
        })
      );
    });

    it("does not initialize Sentry when SENTRY_DSN is not configured", async () => {
      delete process.env.SENTRY_DSN;

      await import("../logger.ts");

      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });
});
