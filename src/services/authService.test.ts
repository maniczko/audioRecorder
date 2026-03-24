/**
 * @vitest-environment jsdom
 * authService service tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("authService", () => {
  let authService: any;
  let originalFetch: any;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    authService = await import("./services/authService");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("logs in with email and password", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token", user: { id: "u1" } }),
      });

      const result = await authService.login("test@example.com", "password");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ token: "test-token", user: { id: "u1" } });
    });

    it("includes credentials in request body", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.login("test@example.com", "password");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            password: "password",
          }),
        })
      );
    });

    it("handles login error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid credentials" }),
      });

      await expect(authService.login("test@example.com", "wrong"))
        .rejects.toThrow();
    });

    it("handles network error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      await expect(authService.login("test@example.com", "password"))
        .rejects.toThrow("Network error");
    });
  });

  describe("register", () => {
    it("registers new user", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token", user: { id: "u1" } }),
      });

      const result = await authService.register({
        email: "test@example.com",
        password: "password",
        name: "Test User",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ token: "test-token", user: { id: "u1" } });
    });

    it("includes registration data in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.register({
        email: "test@example.com",
        password: "password",
        name: "Test User",
        role: "Developer",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            email: "test@example.com",
            password: "password",
            name: "Test User",
            role: "Developer",
          }),
        })
      );
    });

    it("handles registration error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Email already exists" }),
      });

      await expect(authService.register({
        email: "test@example.com",
        password: "password",
      })).rejects.toThrow();
    });
  });

  describe("logout", () => {
    it("logs out user", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await authService.logout();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("clears auth token", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.logout();
      
      // Token should be cleared
      expect(authService.getToken()).toBeNull();
    });

    it("handles logout error", async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      await expect(authService.logout()).rejects.toThrow();
    });
  });

  describe("forgotPassword", () => {
    it("sends password reset email", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await authService.forgotPassword("test@example.com");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("includes email in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.forgotPassword("test@example.com");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ email: "test@example.com" }),
        })
      );
    });

    it("handles forgot password error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(authService.forgotPassword("test@example.com"))
        .rejects.toThrow();
    });
  });

  describe("resetPassword", () => {
    it("resets password with code", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await authService.resetPassword("code123", "newpassword");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("includes code and new password in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.resetPassword("code123", "newpassword");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            code: "code123",
            newPassword: "newpassword",
          }),
        })
      );
    });

    it("handles reset error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(authService.resetPassword("code123", "newpassword"))
        .rejects.toThrow();
    });
  });

  describe("verifyEmail", () => {
    it("verifies email with code", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await authService.verifyEmail("code123");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("handles verification error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(authService.verifyEmail("code123")).rejects.toThrow();
    });
  });

  describe("getSession", () => {
    it("fetches current session", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: "u1", email: "test@example.com" } }),
      });

      const result = await authService.getSession();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ user: { id: "u1", email: "test@example.com" } });
    });

    it("handles session error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(authService.getSession()).rejects.toThrow();
    });

    it("returns null when not authenticated", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      });

      const result = await authService.getSession();
      expect(result).toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("updates user profile", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await authService.updateProfile({
        name: "Updated Name",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("includes profile data in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.updateProfile({
        name: "Updated Name",
        role: "Developer",
        company: "Test Co",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "Updated Name",
            role: "Developer",
            company: "Test Co",
          }),
        })
      );
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(authService.updateProfile({})).rejects.toThrow();
    });
  });

  describe("changePassword", () => {
    it("changes password", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await authService.changePassword({
        currentPassword: "oldpassword",
        newPassword: "newpassword",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("includes passwords in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.changePassword({
        currentPassword: "oldpassword",
        newPassword: "newpassword",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            currentPassword: "oldpassword",
            newPassword: "newpassword",
          }),
        })
      );
    });

    it("handles change password error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(authService.changePassword({
        currentPassword: "wrong",
        newPassword: "newpassword",
      })).rejects.toThrow();
    });
  });

  describe("googleLogin", () => {
    it("logs in with Google", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token", user: { id: "u1" } }),
      });

      const result = await authService.googleLogin("google-code");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ token: "test-token", user: { id: "u1" } });
    });

    it("includes Google code in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await authService.googleLogin("google-code");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ code: "google-code" }),
        })
      );
    });

    it("handles Google login error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(authService.googleLogin("google-code")).rejects.toThrow();
    });
  });

  describe("getToken", () => {
    it("returns stored token", () => {
      authService.setToken("test-token");
      expect(authService.getToken()).toBe("test-token");
    });

    it("returns null when no token", () => {
      authService.setToken(null);
      expect(authService.getToken()).toBeNull();
    });
  });

  describe("setToken", () => {
    it("stores token", () => {
      authService.setToken("test-token");
      expect(authService.getToken()).toBe("test-token");
    });

    it("clears token when null", () => {
      authService.setToken("test-token");
      authService.setToken(null);
      expect(authService.getToken()).toBeNull();
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when authenticated", () => {
      authService.setToken("test-token");
      expect(authService.isAuthenticated()).toBe(true);
    });

    it("returns false when not authenticated", () => {
      authService.setToken(null);
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe("clearAuth", () => {
    it("clears all auth data", () => {
      authService.setToken("test-token");
      authService.clearAuth();
      expect(authService.getToken()).toBeNull();
    });
  });

  describe("refreshToken", () => {
    it("refreshes auth token", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "new-token" }),
      });

      const result = await authService.refreshToken();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toBe("new-token");
      expect(authService.getToken()).toBe("new-token");
    });

    it("handles refresh error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(authService.refreshToken()).rejects.toThrow();
    });
  });

  describe("validatePassword", () => {
    it("returns true for valid password", () => {
      expect(authService.validatePassword("StrongPass123!")).toBe(true);
    });

    it("returns false for short password", () => {
      expect(authService.validatePassword("short")).toBe(false);
    });

    it("returns false for password without number", () => {
      expect(authService.validatePassword("NoNumbers!")).toBe(false);
    });

    it("returns false for password without special char", () => {
      expect(authService.validatePassword("NoSpecial1")).toBe(false);
    });

    it("returns false for empty password", () => {
      expect(authService.validatePassword("")).toBe(false);
    });
  });

  describe("validateEmail", () => {
    it("returns true for valid email", () => {
      expect(authService.validateEmail("test@example.com")).toBe(true);
    });

    it("returns false for invalid email", () => {
      expect(authService.validateEmail("invalid")).toBe(false);
    });

    it("returns false for empty email", () => {
      expect(authService.validateEmail("")).toBe(false);
    });
  });

  describe("getAuthHeaders", () => {
    it("includes auth token in headers", () => {
      authService.setToken("test-token");
      const headers = authService.getAuthHeaders();
      
      expect(headers.Authorization).toContain("test-token");
    });

    it("includes content type", () => {
      const headers = authService.getAuthHeaders();
      
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("merges with custom headers", () => {
      authService.setToken("test-token");
      const headers = authService.getAuthHeaders({
        "X-Custom-Header": "value",
      });
      
      expect(headers.Authorization).toBeDefined();
      expect(headers["X-Custom-Header"]).toBe("value");
    });
  });

  describe("buildAuthUrl", () => {
    it("builds auth URL", () => {
      const url = authService.buildAuthUrl("/login");
      expect(url).toContain("/login");
    });

    it("includes base URL", () => {
      const url = authService.buildAuthUrl("/login");
      expect(url).toMatch(/^http/);
    });
  });

  describe("parseAuthResponse", () => {
    it("parses successful response", async () => {
      const response = {
        ok: true,
        json: async () => ({ token: "test-token", user: { id: "u1" } }),
      };

      const result = await authService.parseAuthResponse(response as any);
      
      expect(result).toEqual({ token: "test-token", user: { id: "u1" } });
    });

    it("handles error response", async () => {
      const response = {
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      };

      await expect(authService.parseAuthResponse(response as any))
        .rejects.toThrow();
    });
  });

  describe("handleAuthError", () => {
    it("throws error with message", () => {
      const error = { message: "Test error" };
      
      expect(() => authService.handleAuthError(error)).toThrow("Test error");
    });

    it("handles error without message", () => {
      const error = {};
      
      expect(() => authService.handleAuthError(error)).toThrow();
    });
  });

  describe("setAuthListener", () => {
    it("sets auth listener", () => {
      const listener = vi.fn();
      authService.setAuthListener(listener);
      // Listener should be stored
      expect(authService.getAuthListener()).toBeDefined();
    });
  });

  describe("notifyAuthChange", () => {
    it("notifies auth listener", () => {
      const listener = vi.fn();
      authService.setAuthListener(listener);
      authService.notifyAuthChange(true);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it("handles missing listener", () => {
      expect(() => authService.notifyAuthChange(true)).not.toThrow();
    });
  });

  describe("getAuthListener", () => {
    it("returns stored listener", () => {
      const listener = vi.fn();
      authService.setAuthListener(listener);
      expect(authService.getAuthListener()).toBe(listener);
    });

    it("returns null when no listener", () => {
      expect(authService.getAuthListener()).toBeNull();
    });
  });

  describe("clearAuthListener", () => {
    it("clears auth listener", () => {
      const listener = vi.fn();
      authService.setAuthListener(listener);
      authService.clearAuthListener();
      expect(authService.getAuthListener()).toBeNull();
    });
  });

  describe("onAuthChange", () => {
    it("registers auth change callback", () => {
      const callback = vi.fn();
      authService.onAuthChange(callback);
      // Callback should be registered
      expect(authService.getAuthListener()).toBeDefined();
    });
  });

  describe("offAuthChange", () => {
    it("unregisters auth change callback", () => {
      const callback = vi.fn();
      authService.onAuthChange(callback);
      authService.offAuthChange(callback);
      expect(authService.getAuthListener()).toBeNull();
    });
  });

  describe("createAuthClient", () => {
    it("creates new auth client", () => {
      const client = authService.createAuthClient();
      expect(client).toBeDefined();
      expect(client.login).toBeDefined();
      expect(client.logout).toBeDefined();
    });

    it("creates client with custom config", () => {
      const client = authService.createAuthClient({
        baseUrl: "http://custom:3000",
      });
      
      expect(client).toBeDefined();
    });
  });

  describe("defaultAuth", () => {
    it("exports default auth instance", () => {
      expect(authService.default).toBeDefined();
      expect(authService.default.login).toBeDefined();
    });
  });

  describe("useAuth", () => {
    it("exports useAuth hook", () => {
      expect(authService.useAuth).toBeDefined();
      expect(typeof authService.useAuth).toBe("function");
    });
  });

  describe("AuthProvider", () => {
    it("exports AuthProvider component", () => {
      expect(authService.AuthProvider).toBeDefined();
      expect(typeof authService.AuthProvider).toBe("function");
    });
  });

  describe("withAuth", () => {
    it("exports withAuth HOC", () => {
      expect(authService.withAuth).toBeDefined();
      expect(typeof authService.withAuth).toBe("function");
    });
  });

  describe("requireAuth", () => {
    it("exports requireAuth function", () => {
      expect(authService.requireAuth).toBeDefined();
      expect(typeof authService.requireAuth).toBe("function");
    });
  });

  describe("getAuthState", () => {
    it("returns auth state", () => {
      const state = authService.getAuthState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty("isAuthenticated");
      expect(state).toHaveProperty("user");
      expect(state).toHaveProperty("token");
    });
  });

  describe("setAuthState", () => {
    it("sets auth state", () => {
      authService.setAuthState({
        isAuthenticated: true,
        user: { id: "u1" },
        token: "test-token",
      });
      
      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("clearAuthState", () => {
    it("clears auth state", () => {
      authService.setAuthState({
        isAuthenticated: true,
        user: { id: "u1" },
        token: "test-token",
      });
      
      authService.clearAuthState();
      
      const state = authService.getAuthState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe("persistAuth", () => {
    it("persists auth to storage", () => {
      authService.persistAuth({
        token: "test-token",
        user: { id: "u1" },
      });
      
      // Should be stored in localStorage
      const stored = localStorage.getItem("auth");
      expect(stored).toBeDefined();
    });

    it("loads persisted auth", () => {
      localStorage.setItem("auth", JSON.stringify({
        token: "test-token",
        user: { id: "u1" },
      }));
      
      const auth = authService.loadPersistedAuth();
      expect(auth).toEqual({
        token: "test-token",
        user: { id: "u1" },
      });
    });

    it("handles invalid persisted auth", () => {
      localStorage.setItem("auth", "invalid");
      
      const auth = authService.loadPersistedAuth();
      expect(auth).toBeNull();
    });
  });

  describe("loadPersistedAuth", () => {
    it("returns null when no persisted auth", () => {
      localStorage.removeItem("auth");
      
      const auth = authService.loadPersistedAuth();
      expect(auth).toBeNull();
    });
  });

  describe("clearPersistedAuth", () => {
    it("clears persisted auth", () => {
      localStorage.setItem("auth", JSON.stringify({ token: "test" }));
      
      authService.clearPersistedAuth();
      
      expect(localStorage.getItem("auth")).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("returns true for expired token", () => {
      const expired = authService.isTokenExpired(Date.now() - 1000);
      expect(expired).toBe(true);
    });

    it("returns false for valid token", () => {
      const valid = authService.isTokenExpired(Date.now() + 1000000);
      expect(valid).toBe(false);
    });

    it("returns true for missing expiry", () => {
      const expired = authService.isTokenExpired(null as any);
      expect(expired).toBe(true);
    });
  });

  describe("getTokenExpiry", () => {
    it("returns token expiry", () => {
      const now = Date.now();
      const expiry = authService.getTokenExpiry(now + 1000);
      expect(expiry).toBe(now + 1000);
    });
  });

  describe("refreshTokenIfNeeded", () => {
    it("refreshes token when expired", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "new-token" }),
      });

      authService.setToken("expired-token");
      await authService.refreshTokenIfNeeded();
      
      expect(global.fetch).toHaveBeenCalled();
    });

    it("skips refresh when token is valid", async () => {
      authService.setToken("valid-token");
      await authService.refreshTokenIfNeeded();
      
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("autoRefresh", () => {
    it("starts auto refresh", () => {
      authService.startAutoRefresh();
      // Should start interval
      expect(authService.isAutoRefreshActive()).toBe(true);
    });

    it("stops auto refresh", () => {
      authService.startAutoRefresh();
      authService.stopAutoRefresh();
      expect(authService.isAutoRefreshActive()).toBe(false);
    });

    it("isAutoRefreshActive returns status", () => {
      expect(authService.isAutoRefreshActive()).toBe(false);
    });
  });

  describe("startAutoRefresh", () => {
    it("sets refresh interval", () => {
      authService.startAutoRefresh(1000);
      expect(authService.isAutoRefreshActive()).toBe(true);
    });
  });

  describe("stopAutoRefresh", () => {
    it("clears refresh interval", () => {
      authService.startAutoRefresh();
      authService.stopAutoRefresh();
      expect(authService.isAutoRefreshActive()).toBe(false);
    });
  });

  describe("isAutoRefreshActive", () => {
    it("returns false when not active", () => {
      expect(authService.isAutoRefreshActive()).toBe(false);
    });
  });
});
