```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from 'sqlite'; // Changed import from 'bun:sqlite' to 'sqlite'
import { initDatabase } from './database';

describe('Database Integration Tests', () => {
  let db: Database;

  beforeAll(() => {
    // Używamy bazy w pamięci dla szybkości testów
    db = new Database(':memory:');
    initDatabase(db);
    // Create necessary tables for testing
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id)
      );
    `);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Czyszczenie bazy przed każdym testem
    db.run('DELETE FROM meetings');
    db.run('DELETE FROM users');
    db.run('DELETE FROM transcripts');
    // Reset auto-increment
    db.run("DELETE FROM sqlite_sequence WHERE name='users'");
    db.run("DELETE FROM sqlite_sequence WHERE name='meetings'");
  });

  describe('Users Table', () => {
    it('should create a new user successfully', () => {
      const email = 'test@example.com';
      const passwordHash = 'hash123';
      
      const result = db.run(
        'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
        email, passwordHash, new Date().toISOString()
      );

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBe(1);

      const user = db.get('SELECT * FROM users WHERE email = ?', email);
      expect(user).toBeDefined();
      expect((user as any).email).toBe(email);
    });

    it('should enforce unique email constraint', () => {
      const email = 'duplicate@example.com';
      const date = new Date().toISOString();

      db.run(
        'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
        email, 'hash1', date
      );

      expect(() => {
        db.run(
          'INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)',
          email, 'hash2', date
        );
      }).toThrow(); // UNIQUE constraint failed
    });

    it('should retrieve user by ID', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'find@example.com', 'hash', date);
      
      const user = db.get('SELECT * FROM users WHERE email = ?', 'find@example.com');
      expect(user).toBeDefined();
      
      const userId = (user as any).id;
      const foundById = db.get('SELECT * FROM users WHERE id = ?', userId);
      expect(foundById).toBeDefined();
      expect((foundById as any).id).toBe(userId);
    });

    it('should update user password hash', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'update@example.com', 'oldhash', date);
      
      const user = db.get('SELECT * FROM users WHERE email = ?', 'update@example.com') as any;
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', 'newhash', user.id);
      
      const updated = db.get('SELECT * FROM users WHERE id = ?', user.id) as any;
      expect(updated.password_hash).toBe('newhash');
    });

    it('should delete user', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'delete@example.com', 'hash', date);
      
      const user = db.get('SELECT * FROM users WHERE email = ?', 'delete@example.com') as any;
      db.run('DELETE FROM users WHERE id = ?', user.id);
      
      const deletedUser = db.get('SELECT * FROM users WHERE id = ?', user.id);
      expect(deletedUser).toBeUndefined();
    });
  });
});
```