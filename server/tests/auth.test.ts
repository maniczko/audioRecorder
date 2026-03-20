import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { initDatabase } from "../database.ts";
import AuthService from "../services/AuthService.ts";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Database & AuthService (In-Memory)", () => {
  let db: any;
  let authService: any;
  const testUploadDir = path.resolve(__dirname, "test_uploads");


  beforeAll(async () => {
    // Initialize with :memory:
    db = initDatabase({ dbPath: ":memory:", uploadDir: testUploadDir });
    await db.init();
    authService = new AuthService(db);
  });

  afterAll(() => {
    if (db && db.worker) {
      db.worker.terminate();
    }
    if (fs.existsSync(testUploadDir)) {
      try {
        fs.rmSync(testUploadDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore EPERM lock on Windows
      }
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

  test("should handle legacy or corrupted password hashes gracefully without crashing (500 Error prevention)", async () => {
    // Forcefully inject a corrupted hash with invalid byte length directly into DB
    const weirdHash = "somesalt123:c0rrupt3dh4shth4t1s2sh0rt"; // much shorter than 64 bytes
    const row = await db._get("SELECT id FROM users WHERE email = 'test@example.com'");
    
    // Mutate the row manually to simulate dirty DB state
    await db._execute("UPDATE users SET password_hash = ? WHERE id = ?", [weirdHash, row.id]);

    // Expected behavior: Login should securely reject the user with standard 401 error,
    // NOT throw a raw TypeError ("Input buffers must have the same byte length")
    await expect(authService.loginUser({
      email: "test@example.com",
      password: "password123"
    })).rejects.toThrow("Niepoprawny email lub haslo.");
  });

  test("should reject login to a workspace the user does not belong to", async () => {
    const outsider = await authService.registerUser({
      email: "outsider@example.com",
      password: "password123",
      name: "Outsider",
      workspaceName: "Outsider Workspace"
    });

    await expect(authService.loginUser({
      email: "test@example.com",
      password: "password123",
      workspaceId: outsider.workspaceId,
    })).rejects.toThrow("Nie masz dostepu do wybranego workspace.");
  });

  test("should show a dedicated error for Google-managed accounts", async () => {
    await authService.upsertGoogleUser({
      email: "google@example.com",
      sub: "google-sub-1",
      name: "Google User",
    });

    await expect(authService.loginUser({
      email: "google@example.com",
      password: "password123",
    })).rejects.toThrow("To konto korzysta z logowania Google. Uzyj przycisku Google.");
  });
});
