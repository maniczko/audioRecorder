/**
 * @vitest-environment jsdom
 * httpClient service tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("httpClient", () => {
  let httpClient: any;
  let originalFetch: any;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    httpClient = await import("./services/httpClient");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("apiRequest", () => {
    it("makes GET request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      const result = await httpClient.apiRequest("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/test"),
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ data: "test" });
    });

    it("makes POST request with body", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await httpClient.apiRequest("/test", {
        method: "POST",
        body: { key: "value" },
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ key: "value" }),
        })
      );
    });

    it("includes auth token in headers", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await httpClient.apiRequest("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });

    it("handles API errors", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Bad request" }),
      });

      await expect(httpClient.apiRequest("/test")).rejects.toThrow();
    });

    it("handles network errors", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      await expect(httpClient.apiRequest("/test")).rejects.toThrow("Network error");
    });

    it("handles 401 unauthorized", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });

      await expect(httpClient.apiRequest("/test")).rejects.toThrow();
    });

    it("handles 500 server error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: "Server error" }),
      });

      await expect(httpClient.apiRequest("/test")).rejects.toThrow();
    });

    it("supports custom headers", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await httpClient.apiRequest("/test", {
        headers: { "X-Custom-Header": "value" },
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom-Header": "value",
          }),
        })
      );
    });

    it("supports parseAs option", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: async () => "plain text",
      });

      const result = await httpClient.apiRequest("/test", { parseAs: "text" });
      
      expect(result).toBe("plain text");
    });

    it("handles empty response", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await httpClient.apiRequest("/test");
      
      expect(result).toEqual({});
    });
  });

  describe("apiBaseUrlConfigured", () => {
    it("returns true when API base URL is set", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000";
      
      expect(httpClient.apiBaseUrlConfigured()).toBe(true);
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });

    it("returns false when API base URL is not set", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "";
      
      expect(httpClient.apiBaseUrlConfigured()).toBe(false);
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });
  });

  describe("setAuthToken", () => {
    it("sets auth token", () => {
      httpClient.setAuthToken("test-token");
      // Token should be stored internally
      expect(httpClient.getAuthToken()).toBe("test-token");
    });

    it("clears auth token when null is passed", () => {
      httpClient.setAuthToken("test-token");
      httpClient.setAuthToken(null);
      expect(httpClient.getAuthToken()).toBeNull();
    });
  });

  describe("getAuthToken", () => {
    it("returns stored token", () => {
      httpClient.setAuthToken("test-token");
      expect(httpClient.getAuthToken()).toBe("test-token");
    });

    it("returns null when no token is set", () => {
      httpClient.setAuthToken(null);
      expect(httpClient.getAuthToken()).toBeNull();
    });
  });

  describe("clearAuthToken", () => {
    it("removes stored token", () => {
      httpClient.setAuthToken("test-token");
      httpClient.clearAuthToken();
      expect(httpClient.getAuthToken()).toBeNull();
    });
  });

  describe("buildUrl", () => {
    it("builds URL with base URL", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000";
      
      const url = httpClient.buildUrl("/test");
      
      expect(url).toBe("http://localhost:3000/test");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });

    it("handles relative paths", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000/api";
      
      const url = httpClient.buildUrl("/test");
      
      expect(url).toBe("http://localhost:3000/api/test");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });

    it("handles query parameters", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000";
      
      const url = httpClient.buildUrl("/test", { key: "value" });
      
      expect(url).toContain("key=value");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });

    it("handles multiple query parameters", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000";
      
      const url = httpClient.buildUrl("/test", { key1: "value1", key2: "value2" });
      
      expect(url).toContain("key1=value1");
      expect(url).toContain("key2=value2");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });

    it("handles empty query parameters", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://localhost:3000";
      
      const url = httpClient.buildUrl("/test", {});
      
      expect(url).toBe("http://localhost:3000/test");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });
  });

  describe("handleApiError", () => {
    it("throws error with message", () => {
      const error = { message: "Test error" };
      
      expect(() => httpClient.handleApiError(error)).toThrow("Test error");
    });

    it("handles error without message", () => {
      const error = {};
      
      expect(() => httpClient.handleApiError(error)).toThrow();
    });

    it("handles string error", () => {
      const error = "String error";
      
      expect(() => httpClient.handleApiError(error)).toThrow("String error");
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when token is set", () => {
      httpClient.setAuthToken("test-token");
      expect(httpClient.isAuthenticated()).toBe(true);
    });

    it("returns false when token is not set", () => {
      httpClient.setAuthToken(null);
      expect(httpClient.isAuthenticated()).toBe(false);
    });
  });

  describe("logout", () => {
    it("clears auth token", () => {
      httpClient.setAuthToken("test-token");
      httpClient.logout();
      expect(httpClient.getAuthToken()).toBeNull();
    });

    it("calls onLogout callback if provided", () => {
      const onLogout = vi.fn();
      httpClient.setAuthToken("test-token");
      httpClient.logout(onLogout);
      expect(onLogout).toHaveBeenCalled();
    });
  });

  describe("refreshToken", () => {
    it("refreshes token successfully", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "new-token" }),
      });

      const result = await httpClient.refreshToken();
      
      expect(result).toBe("new-token");
      expect(httpClient.getAuthToken()).toBe("new-token");
    });

    it("handles refresh failure", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(httpClient.refreshToken()).rejects.toThrow();
    });
  });

  describe("setApiBaseUrl", () => {
    it("sets API base URL", () => {
      httpClient.setApiBaseUrl("http://localhost:3000");
      expect(httpClient.buildUrl("/test")).toContain("http://localhost:3000");
    });

    it("clears API base URL when null is passed", () => {
      httpClient.setApiBaseUrl("http://localhost:3000");
      httpClient.setApiBaseUrl(null);
      expect(httpClient.buildUrl("/test")).not.toContain("http://localhost:3000");
    });
  });

  describe("getApiBaseUrl", () => {
    it("returns stored base URL", () => {
      httpClient.setApiBaseUrl("http://localhost:3000");
      expect(httpClient.getApiBaseUrl()).toBe("http://localhost:3000");
    });

    it("returns environment variable when no stored URL", () => {
      const originalEnv = process.env.VITE_API_BASE_URL;
      process.env.VITE_API_BASE_URL = "http://env:3000";
      
      expect(httpClient.getApiBaseUrl()).toBe("http://env:3000");
      
      process.env.VITE_API_BASE_URL = originalEnv;
    });
  });

  describe("setTimeout", () => {
    it("sets request timeout", () => {
      httpClient.setTimeout(5000);
      // Timeout should be stored internally
      expect(httpClient.getTimeout()).toBe(5000);
    });

    it("defaults to 30 seconds", () => {
      expect(httpClient.getTimeout()).toBe(30000);
    });
  });

  describe("getTimeout", () => {
    it("returns stored timeout", () => {
      httpClient.setTimeout(5000);
      expect(httpClient.getTimeout()).toBe(5000);
    });
  });

  describe("setRetryConfig", () => {
    it("sets retry configuration", () => {
      httpClient.setRetryConfig({ retries: 3, delay: 1000 });
      // Config should be stored internally
      expect(httpClient.getRetryConfig()).toEqual({ retries: 3, delay: 1000 });
    });

    it("defaults to no retries", () => {
      expect(httpClient.getRetryConfig()).toEqual({ retries: 0, delay: 0 });
    });
  });

  describe("getRetryConfig", () => {
    it("returns stored retry config", () => {
      httpClient.setRetryConfig({ retries: 3, delay: 1000 });
      expect(httpClient.getRetryConfig()).toEqual({ retries: 3, delay: 1000 });
    });
  });

  describe("interceptors", () => {
    it("adds request interceptor", () => {
      const interceptor = vi.fn((config) => config);
      httpClient.addRequestInterceptor(interceptor);
      // Interceptor should be stored
      expect(httpClient.getRequestInterceptors().length).toBe(1);
    });

    it("adds response interceptor", () => {
      const interceptor = vi.fn((response) => response);
      httpClient.addResponseInterceptor(interceptor);
      // Interceptor should be stored
      expect(httpClient.getResponseInterceptors().length).toBe(1);
    });

    it("removes request interceptor", () => {
      const interceptor = vi.fn((config) => config);
      const id = httpClient.addRequestInterceptor(interceptor);
      httpClient.removeRequestInterceptor(id);
      expect(httpClient.getRequestInterceptors().length).toBe(0);
    });

    it("removes response interceptor", () => {
      const interceptor = vi.fn((response) => response);
      const id = httpClient.addResponseInterceptor(interceptor);
      httpClient.removeResponseInterceptor(id);
      expect(httpClient.getResponseInterceptors().length).toBe(0);
    });

    it("executes request interceptors in order", async () => {
      const interceptor1 = vi.fn((config) => ({ ...config, header1: "value1" }));
      const interceptor2 = vi.fn((config) => ({ ...config, header2: "value2" }));
      
      httpClient.addRequestInterceptor(interceptor1);
      httpClient.addRequestInterceptor(interceptor2);
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await httpClient.apiRequest("/test");
      
      expect(interceptor1).toHaveBeenCalled();
      expect(interceptor2).toHaveBeenCalled();
    });

    it("executes response interceptors in order", async () => {
      const interceptor1 = vi.fn((response) => response);
      const interceptor2 = vi.fn((response) => response);
      
      httpClient.addResponseInterceptor(interceptor1);
      httpClient.addResponseInterceptor(interceptor2);
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await httpClient.apiRequest("/test");
      
      expect(interceptor1).toHaveBeenCalled();
      expect(interceptor2).toHaveBeenCalled();
    });
  });

  describe("createClient", () => {
    it("creates new client instance", () => {
      const client = httpClient.createClient();
      expect(client).toBeDefined();
      expect(client.apiRequest).toBeDefined();
      expect(client.setAuthToken).toBeDefined();
    });

    it("creates client with custom config", () => {
      const client = httpClient.createClient({
        baseUrl: "http://custom:3000",
        timeout: 5000,
      });
      
      expect(client).toBeDefined();
      expect(client.getApiBaseUrl()).toBe("http://custom:3000");
      expect(client.getTimeout()).toBe(5000);
    });
  });

  describe("defaultClient", () => {
    it("exports default client", () => {
      expect(httpClient.default).toBeDefined();
      expect(httpClient.default.apiRequest).toBeDefined();
    });
  });

  describe("get", () => {
    it("makes GET request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      const result = await httpClient.get("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual({ data: "test" });
    });
  });

  describe("post", () => {
    it("makes POST request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await httpClient.post("/test", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ key: "value" }),
        })
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe("put", () => {
    it("makes PUT request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await httpClient.put("/test", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ key: "value" }),
        })
      );
      expect(result).toEqual({ updated: true });
    });
  });

  describe("delete", () => {
    it("makes DELETE request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true }),
      });

      const result = await httpClient.delete("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" })
      );
      expect(result).toEqual({ deleted: true });
    });
  });

  describe("patch", () => {
    it("makes PATCH request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ patched: true }),
      });

      const result = await httpClient.patch("/test", { key: "value" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ key: "value" }),
        })
      );
      expect(result).toEqual({ patched: true });
    });
  });

  describe("head", () => {
    it("makes HEAD request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        headers: new Map([["content-length", "100"]]),
      });

      const result = await httpClient.head("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "HEAD" })
      );
      expect(result.headers.get("content-length")).toBe("100");
    });
  });

  describe("options", () => {
    it("makes OPTIONS request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ methods: ["GET", "POST"] }),
      });

      const result = await httpClient.options("/test");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "OPTIONS" })
      );
      expect(result).toEqual({ methods: ["GET", "POST"] });
    });
  });
});
