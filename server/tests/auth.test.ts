import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initDatabase } from '../database.ts';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Authentication Logic (Server Layer)', () => {
  let db: any;
  const testUploadDir = path.resolve(__dirname, 'test_auth_uploads');

  beforeAll(async () => {
    db = initDatabase({ dbPath: ':memory:', uploadDir: testUploadDir });
    await db.init();
  });

  afterAll(async () => {
    if (db) {
      await db.shutdown();
    }
    if (fs.existsSync(testUploadDir)) {
      try {
        fs.rmSync(testUploadDir, { recursive: true, force: true });
      } catch (err) {}
    }
  });

  beforeEach(async () => {
    // Clean up tables between tests to ensure isolation
    // Only clean if tables exist (skip if migrations haven't run yet)
    try {
      await db._execute('DELETE FROM sessions');
      await db._execute('DELETE FROM workspace_members');
      await db._execute('DELETE FROM workspaces');
      await db._execute('DELETE FROM users');
    } catch (err) {
      // Tables don't exist yet - skip cleanup
    }
  });

  test('should register a new user and create a workspace', async () => {
    const draft = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      workspaceName: 'My Workspace',
      workspaceMode: 'create',
    };

    const result = await db.registerUser(draft);

    expect(result.user.email).toBe('test@example.com');
    expect(result.user.name).toBe('Test User');
    expect(result.token).toBeDefined();
    expect(result.workspaceId).toBeDefined();
    expect(result.workspaces.length).toBe(1);
    expect(result.workspaces[0].name).toBe('My Workspace');
  });

  test('should throw error when registering with existing email', async () => {
    const draft = {
      email: 'duplicate@example.com',
      password: 'password123',
      name: 'User 1',
    };

    await db.registerUser(draft);

    await expect(db.registerUser(draft)).rejects.toThrow('Konto z takim adresem juz istnieje.');
  });

  test('should login successfully with correct credentials', async () => {
    const email = 'login@example.com';
    const password = 'securePassword!@#';

    await db.registerUser({
      email,
      password,
      name: 'Login User',
      workspaceName: 'Login WS',
    });

    const result = await db.loginUser({ email, password });

    expect(result.user.email).toBe(email);
    expect(result.token).toBeDefined();
    expect(result.workspaceId).toBeDefined();
  });

  test('should fail login with wrong password', async () => {
    const email = 'wrongpass@example.com';
    await db.registerUser({
      email,
      password: 'correct_password',
      name: 'User',
    });

    await expect(db.loginUser({ email, password: 'wrong_password' })).rejects.toThrow(
      'Niepoprawny email lub haslo.'
    );
  });

  test('should fail login with non-existent email', async () => {
    await expect(db.loginUser({ email: 'missing@example.com', password: 'any' })).rejects.toThrow(
      'Niepoprawny email lub haslo.'
    );
  });

  test('should handle case-insensitive email during login', async () => {
    const email = 'MixedCase@Example.Com';
    await db.registerUser({
      email,
      password: 'password123',
      name: 'User',
    });

    const result = await db.loginUser({
      email: 'mixedcase@example.com',
      password: 'password123',
    });

    expect(result.user.email).toBe(email.toLowerCase());
  });

  test('should handle Polish characters in passwords', async () => {
    const email = 'polski@przyklad.pl';
    const password = 'zażółć gęślą jaźń';

    await db.registerUser({
      email,
      password,
      name: 'Użytkownik',
    });

    const result = await db.loginUser({ email, password });
    expect(result.user.name).toBe('Użytkownik');
  });

  test('should trim leading/trailing spaces in email during login', async () => {
    const email = 'trim@example.com';
    await db.registerUser({
      email,
      password: 'password123',
      name: 'Trim User',
    });

    const result = await db.loginUser({
      email: '  trim@example.com  ',
      password: 'password123',
    });

    expect(result.user.email).toBe(email);
  });

  test('should validate session token', async () => {
    const result = await db.registerUser({
      email: 'session@example.com',
      password: 'password123',
      name: 'Session User',
    });

    const session = await db.getSession(result.token);
    expect(session).not.toBeNull();
    expect(session.user_id).toBe(result.user.id);
  });

  test('should reject expired session (simulated)', async () => {
    const result = await db.registerUser({
      email: 'expired@example.com',
      password: 'password123',
      name: 'Expired User',
    });

    // Manually expire the session in SQL
    const pastDate = new Date(Date.now() - 1000).toISOString();
    await db._execute('UPDATE sessions SET expires_at = ? WHERE token = ?', [
      pastDate,
      result.token,
    ]);

    const session = await db.getSession(result.token);
    expect(session).toBeNull();

    // Check if it was deleted
    const row = await db._get('SELECT * FROM sessions WHERE token = ?', [result.token]);
    expect(row).toBeNull();
  });

  test('should support multiple workspaces and selecting preferred one', async () => {
    const res = await db.registerUser({
      email: 'multi@example.com',
      password: 'password123',
      name: 'Multi User',
      workspaceName: 'WS 1',
    });

    const userId = res.user.id;

    // Create another workspace manually for this user
    const ws2Id = 'ws_2';
    await db._execute(
      'INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [ws2Id, 'WS 2', userId, 'INV2', db.nowIso(), db.nowIso()]
    );
    await db._execute(
      "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)",
      [ws2Id, userId, db.nowIso()]
    );
    await db.ensureWorkspaceState(ws2Id);

    // Login without preferred workspace
    const login1 = await db.loginUser({ email: 'multi@example.com', password: 'password123' });
    expect(login1.workspaces.length).toBe(2);

    // Login with preferred workspace
    const login2 = await db.loginUser({
      email: 'multi@example.com',
      password: 'password123',
      workspaceId: ws2Id,
    });
    expect(login2.workspaceId).toBe(ws2Id);
  });
  test('should reject login to a workspace the user does not belong to', async () => {
    const outsider = await db.registerUser({
      email: 'outsider@example.com',
      password: 'password123',
      name: 'Outsider',
      workspaceName: 'Outsider Workspace',
    });

    await db.registerUser({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      workspaceName: 'Test Workspace',
    });

    await expect(
      db.loginUser({
        email: 'test@example.com',
        password: 'password123',
        workspaceId: outsider.workspaceId,
      })
    ).rejects.toThrow('Nie masz dostepu do wybranego workspace.');
  });

  test('should show a dedicated error for Google-managed accounts', async () => {
    await db.upsertGoogleUser({
      email: 'google@example.com',
      sub: 'google-sub-1',
      name: 'Google User',
    });

    await expect(
      db.loginUser({
        email: 'google@example.com',
        password: 'password123',
      })
    ).rejects.toThrow('To konto korzysta z logowania Google. Uzyj przycisku Google.');
  });
});
