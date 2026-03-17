const { initDatabase } = require("../database");
const AuthService = require("../services/AuthService");
const path = require("node:path");
const fs = require("node:fs");

describe("Database & AuthService (In-Memory)", () => {
  let db;
  let authService;
  const testUploadDir = path.resolve(__dirname, "test_uploads");

  beforeAll(() => {
    // Initialize with :memory:
    db = initDatabase(":memory:", testUploadDir);
    authService = new AuthService(db);
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  test("should initialize an empty database in memory", () => {
    const users = db.db.prepare("SELECT count(*) as count FROM users").get();
    expect(users.count).toBe(0);
  });

  test("should register a new user successfully", () => {
    const result = authService.registerUser({
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

  test("should login the registered user", () => {
    const result = authService.loginUser({
      email: "test@example.com",
      password: "password123"
    });

    expect(result.user.name).toBe("Test User");
    expect(result.token).toBeDefined();
  });

  test("should prevent duplicate registration", () => {
    expect(() => {
      authService.registerUser({
        email: "test@example.com",
        password: "password456",
        name: "Another User"
      });
    }).toThrow("Konto z takim adresem juz istnieje.");
  });

  test("should fail login with wrong password", () => {
    expect(() => {
      authService.loginUser({
        email: "test@example.com",
        password: "wrong-password"
      });
    }).toThrow("Niepoprawny email lub haslo.");
  });
});
