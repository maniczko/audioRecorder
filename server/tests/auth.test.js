const { initDatabase } = require("../database");
const AuthService = require("../services/AuthService");
const path = require("node:path");
const fs = require("node:fs");

describe("Database & AuthService (In-Memory)", () => {
  let db;
  let authService;
  const testUploadDir = path.resolve(__dirname, "test_uploads");

  beforeAll(async () => {
    // Initialize with :memory:
    db = initDatabase({ dbPath: ":memory:", uploadDir: testUploadDir });
    await db.init();
    authService = new AuthService(db);
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  test("should initialize an empty database in memory", async () => {
    const users = await db._get("SELECT count(*) as count FROM users");
    expect(users.count).toBe(0);
  });

  test("should register a new user successfully", async () => {
    const result = await authService.registerUser({
      email: "test@example.com",
      password: "password123",
      name: "Test User",
      workspaceName: "Test Workspace"
    });

    expect(result.user.email).toBe("test@example.com");
    expect(result.token).toBeDefined();
    expect(result.workspaceId).toBeDefined();
    expect(result.state.meetings).toEqual([]);
  });

  test("should login the registered user", async () => {
    const result = await authService.loginUser({
      email: "test@example.com",
      password: "password123"
    });

    expect(result.user.name).toBe("Test User");
    expect(result.token).toBeDefined();
  });

  test("should prevent duplicate registration", async () => {
    await expect(authService.registerUser({
      email: "test@example.com",
      password: "password456",
      name: "Another User"
    })).rejects.toThrow("Konto z takim adresem juz istnieje.");
  });

  test("should fail login with wrong password", async () => {
    await expect(authService.loginUser({
      email: "test@example.com",
      password: "wrong-password"
    })).rejects.toThrow("Niepoprawny email lub haslo.");
  });
});
