/**
 * @vitest-environment jsdom
 * workspaceService service tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("workspaceService", () => {
  let workspaceService: any;
  let originalFetch: any;

  beforeEach(async () => {
    vi.resetModules();
    originalFetch = global.fetch;
    global.fetch = vi.fn();
    workspaceService = await import("./services/workspaceService");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("getWorkspaces", () => {
    it("fetches workspaces list", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ workspaces: [{ id: "ws1", name: "Test" }] }),
      });

      const result = await workspaceService.getWorkspaces();
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ workspaces: [{ id: "ws1", name: "Test" }] });
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaces()).rejects.toThrow();
    });
  });

  describe("getWorkspace", () => {
    it("fetches single workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ws1", name: "Test" }),
      });

      const result = await workspaceService.getWorkspace("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ id: "ws1", name: "Test" });
    });

    it("handles not found", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(workspaceService.getWorkspace("ws1")).rejects.toThrow();
    });
  });

  describe("createWorkspace", () => {
    it("creates new workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ws1", name: "New Workspace" }),
      });

      const result = await workspaceService.createWorkspace({
        name: "New Workspace",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ id: "ws1", name: "New Workspace" });
    });

    it("includes workspace data in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.createWorkspace({
        name: "Test",
        description: "Description",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "Test",
            description: "Description",
          }),
        })
      );
    });

    it("handles create error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(workspaceService.createWorkspace({ name: "Test" }))
        .rejects.toThrow();
    });
  });

  describe("updateWorkspace", () => {
    it("updates workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await workspaceService.updateWorkspace("ws1", {
        name: "Updated",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("includes update data in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.updateWorkspace("ws1", { name: "Updated" });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ name: "Updated" }),
        })
      );
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.updateWorkspace("ws1", {}))
        .rejects.toThrow();
    });
  });

  describe("deleteWorkspace", () => {
    it("deletes workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ deleted: true }),
      });

      const result = await workspaceService.deleteWorkspace("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it("handles delete error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.deleteWorkspace("ws1")).rejects.toThrow();
    });
  });

  describe("getWorkspaceMembers", () => {
    it("fetches workspace members", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ members: [{ userId: "u1", role: "admin" }] }),
      });

      const result = await workspaceService.getWorkspaceMembers("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ members: [{ userId: "u1", role: "admin" }] });
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaceMembers("ws1"))
        .rejects.toThrow();
    });
  });

  describe("addWorkspaceMember", () => {
    it("adds member to workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ added: true }),
      });

      const result = await workspaceService.addWorkspaceMember("ws1", {
        userId: "u1",
        role: "member",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ added: true });
    });

    it("includes member data in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.addWorkspaceMember("ws1", {
        userId: "u1",
        role: "member",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "u1", role: "member" }),
        })
      );
    });

    it("handles add error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(workspaceService.addWorkspaceMember("ws1", {
        userId: "u1",
        role: "member",
      })).rejects.toThrow();
    });
  });

  describe("removeWorkspaceMember", () => {
    it("removes member from workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ removed: true }),
      });

      const result = await workspaceService.removeWorkspaceMember("ws1", "u1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ removed: true });
    });

    it("handles remove error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.removeWorkspaceMember("ws1", "u1"))
        .rejects.toThrow();
    });
  });

  describe("updateMemberRole", () => {
    it("updates member role", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await workspaceService.updateMemberRole("ws1", "u1", "admin");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("includes role in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.updateMemberRole("ws1", "u1", "admin");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ role: "admin" }),
        })
      );
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.updateMemberRole("ws1", "u1", "admin"))
        .rejects.toThrow();
    });
  });

  describe("leaveWorkspace", () => {
    it("leaves workspace", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ left: true }),
      });

      const result = await workspaceService.leaveWorkspace("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ left: true });
    });

    it("handles leave error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.leaveWorkspace("ws1")).rejects.toThrow();
    });
  });

  describe("getWorkspaceSettings", () => {
    it("fetches workspace settings", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ settings: { theme: "dark" } }),
      });

      const result = await workspaceService.getWorkspaceSettings("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ settings: { theme: "dark" } });
    });

    it("handles fetch error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaceSettings("ws1"))
        .rejects.toThrow();
    });
  });

  describe("updateWorkspaceSettings", () => {
    it("updates workspace settings", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ updated: true }),
      });

      const result = await workspaceService.updateWorkspaceSettings("ws1", {
        theme: "light",
      });
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ updated: true });
    });

    it("includes settings in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.updateWorkspaceSettings("ws1", {
        theme: "light",
        language: "pl",
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            theme: "light",
            language: "pl",
          }),
        })
      );
    });

    it("handles update error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.updateWorkspaceSettings("ws1", {}))
        .rejects.toThrow();
    });
  });

  describe("getWorkspaceInviteCode", () => {
    it("generates invite code", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ code: "ABC123" }),
      });

      const result = await workspaceService.getWorkspaceInviteCode("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ code: "ABC123" });
    });

    it("handles generate error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaceInviteCode("ws1"))
        .rejects.toThrow();
    });
  });

  describe("joinWorkspaceByCode", () => {
    it("joins workspace with code", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ joined: true }),
      });

      const result = await workspaceService.joinWorkspaceByCode("ABC123");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ joined: true });
    });

    it("includes code in request", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await workspaceService.joinWorkspaceByCode("ABC123");
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ code: "ABC123" }),
        })
      );
    });

    it("handles join error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(workspaceService.joinWorkspaceByCode("ABC123"))
        .rejects.toThrow();
    });
  });

  describe("getWorkspaceStatistics", () => {
    it("fetches workspace statistics", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          memberCount: 5,
          meetingCount: 10,
          taskCount: 20,
        }),
      });

      const result = await workspaceService.getWorkspaceStatistics("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({
        memberCount: 5,
        meetingCount: 10,
        taskCount: 20,
      });
    });

    it("handles statistics error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaceStatistics("ws1"))
        .rejects.toThrow();
    });
  });

  describe("getWorkspaceActivity", () => {
    it("fetches workspace activity", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ activities: [{ type: "meeting_created" }] }),
      });

      const result = await workspaceService.getWorkspaceActivity("ws1");
      
      expect(global.fetch).toHaveBeenCalled();
      expect(result).toEqual({ activities: [{ type: "meeting_created" }] });
    });

    it("supports pagination", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ activities: [] }),
      });

      await workspaceService.getWorkspaceActivity("ws1", { page: 1, limit: 10 });
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("page=1"),
        expect.any(Object)
      );
    });

    it("handles activity error", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(workspaceService.getWorkspaceActivity("ws1"))
        .rejects.toThrow();
    });
  });

  describe("getCurrentWorkspace", () => {
    it("returns current workspace ID", () => {
      workspaceService.setCurrentWorkspace("ws1");
      expect(workspaceService.getCurrentWorkspace()).toBe("ws1");
    });

    it("returns null when no workspace is set", () => {
      workspaceService.setCurrentWorkspace(null);
      expect(workspaceService.getCurrentWorkspace()).toBeNull();
    });
  });

  describe("setCurrentWorkspace", () => {
    it("sets current workspace", () => {
      workspaceService.setCurrentWorkspace("ws1");
      expect(workspaceService.getCurrentWorkspace()).toBe("ws1");
    });

    it("clears current workspace when null", () => {
      workspaceService.setCurrentWorkspace("ws1");
      workspaceService.setCurrentWorkspace(null);
      expect(workspaceService.getCurrentWorkspace()).toBeNull();
    });
  });

  describe("clearCurrentWorkspace", () => {
    it("clears current workspace", () => {
      workspaceService.setCurrentWorkspace("ws1");
      workspaceService.clearCurrentWorkspace();
      expect(workspaceService.getCurrentWorkspace()).toBeNull();
    });
  });

  describe("isWorkspaceOwner", () => {
    it("returns true for workspace owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.isWorkspaceOwner(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns false for non-owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.isWorkspaceOwner(workspace as any, "u2"))
        .toBe(false);
    });
  });

  describe("isWorkspaceAdmin", () => {
    it("returns true for admin", () => {
      const member = { role: "admin" };
      expect(workspaceService.isWorkspaceAdmin(member as any)).toBe(true);
    });

    it("returns false for non-admin", () => {
      const member = { role: "member" };
      expect(workspaceService.isWorkspaceAdmin(member as any)).toBe(false);
    });
  });

  describe("isWorkspaceMember", () => {
    it("returns true for member", () => {
      const members = [{ userId: "u1" }];
      expect(workspaceService.isWorkspaceMember(members as any, "u1"))
        .toBe(true);
    });

    it("returns false for non-member", () => {
      const members = [{ userId: "u1" }];
      expect(workspaceService.isWorkspaceMember(members as any, "u2"))
        .toBe(false);
    });
  });

  describe("getMemberRole", () => {
    it("returns member role", () => {
      const members = [{ userId: "u1", role: "admin" }];
      expect(workspaceService.getMemberRole(members as any, "u1"))
        .toBe("admin");
    });

    it("returns null for non-member", () => {
      const members = [{ userId: "u1", role: "admin" }];
      expect(workspaceService.getMemberRole(members as any, "u2"))
        .toBeNull();
    });
  });

  describe("canUserAccessWorkspace", () => {
    it("returns true for owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.canUserAccessWorkspace(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns true for member", () => {
      const workspace = { members: [{ userId: "u1" }] };
      expect(workspaceService.canUserAccessWorkspace(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns false for non-member", () => {
      const workspace = { members: [] };
      expect(workspaceService.canUserAccessWorkspace(workspace as any, "u1"))
        .toBe(false);
    });
  });

  describe("canUserEditWorkspace", () => {
    it("returns true for owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.canUserEditWorkspace(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns true for admin", () => {
      const member = { role: "admin" };
      expect(workspaceService.canUserEditWorkspace(member as any, "u1"))
        .toBe(true);
    });

    it("returns false for member", () => {
      const member = { role: "member" };
      expect(workspaceService.canUserEditWorkspace(member as any, "u1"))
        .toBe(false);
    });
  });

  describe("canUserDeleteWorkspace", () => {
    it("returns true for owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.canUserDeleteWorkspace(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns false for admin", () => {
      const workspace = { ownerId: "u1", members: [{ userId: "u2", role: "admin" }] };
      expect(workspaceService.canUserDeleteWorkspace(workspace as any, "u2"))
        .toBe(false);
    });
  });

  describe("canUserInviteMembers", () => {
    it("returns true for owner", () => {
      const workspace = { ownerId: "u1" };
      expect(workspaceService.canUserInviteMembers(workspace as any, "u1"))
        .toBe(true);
    });

    it("returns true for admin", () => {
      const member = { role: "admin" };
      expect(workspaceService.canUserInviteMembers(member as any, "u1"))
        .toBe(true);
    });

    it("returns false for member", () => {
      const member = { role: "member" };
      expect(workspaceService.canUserInviteMembers(member as any, "u1"))
        .toBe(false);
    });
  });

  describe("validateWorkspaceName", () => {
    it("returns true for valid name", () => {
      expect(workspaceService.validateWorkspaceName("Test Workspace"))
        .toBe(true);
    });

    it("returns false for empty name", () => {
      expect(workspaceService.validateWorkspaceName("")).toBe(false);
    });

    it("returns false for too short name", () => {
      expect(workspaceService.validateWorkspaceName("AB")).toBe(false);
    });

    it("returns false for too long name", () => {
      expect(workspaceService.validateWorkspaceName("A".repeat(100)))
        .toBe(false);
    });
  });

  describe("validateWorkspaceDescription", () => {
    it("returns true for valid description", () => {
      expect(workspaceService.validateWorkspaceDescription("Test description"))
        .toBe(true);
    });

    it("returns true for empty description", () => {
      expect(workspaceService.validateWorkspaceDescription(""))
        .toBe(true);
    });

    it("returns false for too long description", () => {
      expect(workspaceService.validateWorkspaceDescription("A".repeat(1000)))
        .toBe(false);
    });
  });

  describe("formatWorkspaceDate", () => {
    it("formats workspace date", () => {
      const date = new Date("2026-03-23T10:00:00.000Z");
      const result = workspaceService.formatWorkspaceDate(date);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("handles invalid date", () => {
      const result = workspaceService.formatWorkspaceDate(null as any);
      expect(result).toBe("");
    });
  });

  describe("getWorkspaceColor", () => {
    it("returns workspace color", () => {
      const workspace = { color: "#FF0000" };
      expect(workspaceService.getWorkspaceColor(workspace as any))
        .toBe("#FF0000");
    });

    it("returns default color", () => {
      const workspace = {};
      expect(workspaceService.getWorkspaceColor(workspace as any))
        .toBeDefined();
    });
  });

  describe("getWorkspaceIcon", () => {
    it("returns workspace icon", () => {
      const workspace = { icon: "🏢" };
      expect(workspaceService.getWorkspaceIcon(workspace as any))
        .toBe("🏢");
    });

    it("returns default icon", () => {
      const workspace = {};
      expect(workspaceService.getWorkspaceIcon(workspace as any))
        .toBeDefined();
    });
  });

  describe("getWorkspaceInitials", () => {
    it("returns initials from name", () => {
      const workspace = { name: "Test Workspace" };
      expect(workspaceService.getWorkspaceInitials(workspace as any))
        .toBe("TW");
    });

    it("handles single word name", () => {
      const workspace = { name: "Test" };
      expect(workspaceService.getWorkspaceInitials(workspace as any))
        .toBe("T");
    });

    it("handles empty name", () => {
      const workspace = { name: "" };
      expect(workspaceService.getWorkspaceInitials(workspace as any))
        .toBe("W");
    });
  });

  describe("sortWorkspacesByName", () => {
    it("sorts workspaces alphabetically", () => {
      const workspaces = [
        { id: "ws1", name: "Zebra" },
        { id: "ws2", name: "Alpha" },
        { id: "ws3", name: "Beta" },
      ];
      
      const result = workspaceService.sortWorkspacesByName(workspaces as any);
      
      expect(result[0].name).toBe("Alpha");
      expect(result[1].name).toBe("Beta");
      expect(result[2].name).toBe("Zebra");
    });
  });

  describe("sortWorkspacesByDate", () => {
    it("sorts workspaces by creation date", () => {
      const workspaces = [
        { id: "ws1", createdAt: new Date(2026, 0, 3).toISOString() },
        { id: "ws2", createdAt: new Date(2026, 0, 1).toISOString() },
        { id: "ws3", createdAt: new Date(2026, 0, 2).toISOString() },
      ];
      
      const result = workspaceService.sortWorkspacesByDate(workspaces as any);
      
      expect(result[0].id).toBe("ws2");
      expect(result[1].id).toBe("ws3");
      expect(result[2].id).toBe("ws1");
    });
  });

  describe("searchWorkspaces", () => {
    it("searches by name", () => {
      const workspaces = [
        { id: "ws1", name: "Test Workspace" },
        { id: "ws2", name: "Other Workspace" },
      ];
      
      const result = workspaceService.searchWorkspaces(workspaces as any, "Test");
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ws1");
    });

    it("handles case-insensitive search", () => {
      const workspaces = [
        { id: "ws1", name: "Test Workspace" },
      ];
      
      const result = workspaceService.searchWorkspaces(workspaces as any, "test");
      
      expect(result).toHaveLength(1);
    });

    it("handles empty query", () => {
      const workspaces = [
        { id: "ws1", name: "Test" },
      ];
      
      const result = workspaceService.searchWorkspaces(workspaces as any, "");
      
      expect(result).toHaveLength(1);
    });
  });

  describe("filterWorkspacesByRole", () => {
    it("filters by owner role", () => {
      const workspaces = [
        { id: "ws1", role: "owner" },
        { id: "ws2", role: "member" },
      ];
      
      const result = workspaceService.filterWorkspacesByRole(workspaces as any, "owner");
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ws1");
    });

    it("filters by member role", () => {
      const workspaces = [
        { id: "ws1", role: "owner" },
        { id: "ws2", role: "member" },
      ];
      
      const result = workspaceService.filterWorkspacesByRole(workspaces as any, "member");
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ws2");
    });
  });

  describe("countWorkspaces", () => {
    it("counts workspaces", () => {
      const workspaces = [
        { id: "ws1" },
        { id: "ws2" },
        { id: "ws3" },
      ];
      
      expect(workspaceService.countWorkspaces(workspaces as any)).toBe(3);
    });

    it("handles empty array", () => {
      expect(workspaceService.countWorkspaces([])).toBe(0);
    });
  });

  describe("getActiveWorkspaces", () => {
    it("filters active workspaces", () => {
      const workspaces = [
        { id: "ws1", deleted: false },
        { id: "ws2", deleted: true },
        { id: "ws3", deleted: false },
      ];
      
      const result = workspaceService.getActiveWorkspaces(workspaces as any);
      
      expect(result).toHaveLength(2);
    });
  });

  describe("getDeletedWorkspaces", () => {
    it("filters deleted workspaces", () => {
      const workspaces = [
        { id: "ws1", deleted: false },
        { id: "ws2", deleted: true },
      ];
      
      const result = workspaceService.getDeletedWorkspaces(workspaces as any);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("ws2");
    });
  });

  describe("createWorkspaceClient", () => {
    it("creates new workspace client", () => {
      const client = workspaceService.createWorkspaceClient();
      expect(client).toBeDefined();
      expect(client.getWorkspaces).toBeDefined();
      expect(client.createWorkspace).toBeDefined();
    });

    it("creates client with custom config", () => {
      const client = workspaceService.createWorkspaceClient({
        baseUrl: "http://custom:3000",
      });
      
      expect(client).toBeDefined();
    });
  });

  describe("defaultWorkspace", () => {
    it("exports default workspace instance", () => {
      expect(workspaceService.default).toBeDefined();
      expect(workspaceService.default.getWorkspaces).toBeDefined();
    });
  });

  describe("useWorkspace", () => {
    it("exports useWorkspace hook", () => {
      expect(workspaceService.useWorkspace).toBeDefined();
      expect(typeof workspaceService.useWorkspace).toBe("function");
    });
  });

  describe("WorkspaceProvider", () => {
    it("exports WorkspaceProvider component", () => {
      expect(workspaceService.WorkspaceProvider).toBeDefined();
      expect(typeof workspaceService.WorkspaceProvider).toBe("function");
    });
  });

  describe("withWorkspace", () => {
    it("exports withWorkspace HOC", () => {
      expect(workspaceService.withWorkspace).toBeDefined();
      expect(typeof workspaceService.withWorkspace).toBe("function");
    });
  });

  describe("requireWorkspace", () => {
    it("exports requireWorkspace function", () => {
      expect(workspaceService.requireWorkspace).toBeDefined();
      expect(typeof workspaceService.requireWorkspace).toBe("function");
    });
  });

  describe("getWorkspaceState", () => {
    it("returns workspace state", () => {
      const state = workspaceService.getWorkspaceState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty("currentWorkspace");
      expect(state).toHaveProperty("workspaces");
    });
  });

  describe("setWorkspaceState", () => {
    it("sets workspace state", () => {
      workspaceService.setWorkspaceState({
        currentWorkspace: "ws1",
        workspaces: [],
      });
      
      const state = workspaceService.getWorkspaceState();
      expect(state.currentWorkspace).toBe("ws1");
    });
  });

  describe("clearWorkspaceState", () => {
    it("clears workspace state", () => {
      workspaceService.setWorkspaceState({
        currentWorkspace: "ws1",
        workspaces: [],
      });
      
      workspaceService.clearWorkspaceState();
      
      const state = workspaceService.getWorkspaceState();
      expect(state.currentWorkspace).toBeNull();
    });
  });

  describe("persistWorkspace", () => {
    it("persists workspace to storage", () => {
      workspaceService.persistWorkspace({
        id: "ws1",
        name: "Test",
      });
      
      // Should be stored in localStorage
      const stored = localStorage.getItem("workspace");
      expect(stored).toBeDefined();
    });

    it("loads persisted workspace", () => {
      localStorage.setItem("workspace", JSON.stringify({
        id: "ws1",
        name: "Test",
      }));
      
      const workspace = workspaceService.loadPersistedWorkspace();
      expect(workspace).toEqual({
        id: "ws1",
        name: "Test",
      });
    });

    it("handles invalid persisted workspace", () => {
      localStorage.setItem("workspace", "invalid");
      
      const workspace = workspaceService.loadPersistedWorkspace();
      expect(workspace).toBeNull();
    });
  });

  describe("loadPersistedWorkspace", () => {
    it("returns null when no persisted workspace", () => {
      localStorage.removeItem("workspace");
      
      const workspace = workspaceService.loadPersistedWorkspace();
      expect(workspace).toBeNull();
    });
  });

  describe("clearPersistedWorkspace", () => {
    it("clears persisted workspace", () => {
      localStorage.setItem("workspace", JSON.stringify({ id: "ws1" }));
      
      workspaceService.clearPersistedWorkspace();
      
      expect(localStorage.getItem("workspace")).toBeNull();
    });
  });
});
