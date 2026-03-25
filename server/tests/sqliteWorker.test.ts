/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { handleMessage } from '../sqliteWorker';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('sqliteWorker - handleMessage function', () => {
  let tempDbPath: string;
  let db: DatabaseSync;
  let initializedDb: DatabaseSync | null = null;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `test_sqlite_worker_${Date.now()}.db`);
    db = new DatabaseSync(tempDbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initializedDb = null;
  });

  afterEach(() => {
    try {
      if (initializedDb && initializedDb !== db) {
        initializedDb.close();
      }
    } catch (_) {}

    try {
      db.close();
    } catch (_) {}

    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
    const walPath = tempDbPath + '-wal';
    const shmPath = tempDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('init', () => {
    it('initializes database with WAL mode and foreign keys', () => {
      const initPath = path.join(os.tmpdir(), `test_init_${Date.now()}.db`);

      try {
        const response = handleMessage({ id: 1, type: 'init', dbPath: initPath }, null);

        expect(response.result).toBe('ok');
        expect(response.db).toBeDefined();
        expect(response.db).toBeInstanceOf(DatabaseSync);

        // Store for cleanup
        initializedDb = response.db;

        // Verify WAL mode
        const result = response.db.prepare('PRAGMA journal_mode').get();
        expect(result.journal_mode).toBe('wal');

        // Verify foreign keys
        const fkResult = response.db.prepare('PRAGMA foreign_keys').get();
        expect(fkResult.foreign_keys).toBe(1);
      } finally {
        if (fs.existsSync(initPath)) fs.unlinkSync(initPath);
        if (fs.existsSync(initPath + '-wal')) fs.unlinkSync(initPath + '-wal');
        if (fs.existsSync(initPath + '-shm')) fs.unlinkSync(initPath + '-shm');
      }
    });
  });

  describe('query', () => {
    beforeEach(() => {
      db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)');
    });

    it('returns all rows matching the query', () => {
      db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com');
      db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Bob', 'bob@example.com');

      const response = handleMessage(
        { id: 1, type: 'query', sql: 'SELECT * FROM users WHERE name = ?', params: ['Alice'] },
        db
      );

      expect(response.result).toHaveLength(1);
      expect(response.result[0].name).toBe('Alice');
      expect(response.result[0].email).toBe('alice@example.com');
    });

    it('returns empty array when no rows match', () => {
      const response = handleMessage(
        {
          id: 1,
          type: 'query',
          sql: 'SELECT * FROM users WHERE name = ?',
          params: ['NonExistent'],
        },
        db
      );

      expect(response.result).toEqual([]);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      db.exec('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, value TEXT)');
    });

    it('returns single row', () => {
      db.prepare('INSERT INTO items (value) VALUES (?)').run('test-value');

      const response = handleMessage(
        { id: 1, type: 'get', sql: 'SELECT * FROM items WHERE value = ?', params: ['test-value'] },
        db
      );

      expect(response.result).toBeDefined();
      expect(response.result.value).toBe('test-value');
    });

    it('returns undefined when no row matches', () => {
      const response = handleMessage(
        { id: 1, type: 'get', sql: 'SELECT * FROM items WHERE value = ?', params: ['nonexistent'] },
        db
      );

      expect(response.result).toBeUndefined();
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      db.exec(
        'CREATE TABLE IF NOT EXISTS counters (id INTEGER PRIMARY KEY, count INTEGER DEFAULT 0)'
      );
    });

    it('executes INSERT statement', () => {
      const response = handleMessage(
        { id: 1, type: 'execute', sql: 'INSERT INTO counters (count) VALUES (?)', params: [5] },
        db
      );

      expect(response.result).toBe('ok');

      const verify = db.prepare('SELECT count FROM counters').get();
      expect(verify.count).toBe(5);
    });

    it('executes UPDATE statement', () => {
      db.prepare('INSERT INTO counters (count) VALUES (?)').run(5);

      const response = handleMessage(
        { id: 1, type: 'execute', sql: 'UPDATE counters SET count = count + 1 WHERE id = 1' },
        db
      );

      expect(response.result).toBe('ok');

      const verify = db.prepare('SELECT count FROM counters').get();
      expect(verify.count).toBe(6);
    });

    it('executes DELETE statement', () => {
      db.prepare('INSERT INTO counters (count) VALUES (?)').run(5);

      const response = handleMessage(
        { id: 1, type: 'execute', sql: 'DELETE FROM counters WHERE id = 1' },
        db
      );

      expect(response.result).toBe('ok');

      const verify = db.prepare('SELECT COUNT(*) as count FROM counters').get();
      expect(verify.count).toBe(0);
    });
  });

  describe('exec', () => {
    it('executes raw SQL statements', () => {
      const response = handleMessage(
        {
          id: 1,
          type: 'exec',
          sql: 'CREATE TABLE IF NOT EXISTS test_exec (id INTEGER PRIMARY KEY); INSERT INTO test_exec VALUES (1);',
        },
        db
      );

      expect(response.result).toBe('ok');

      const verify = db.prepare('SELECT COUNT(*) as count FROM test_exec').get();
      expect(verify.count).toBe(1);
    });
  });

  describe('error handling', () => {
    it('returns error when DB not initialized', () => {
      const response = handleMessage({ id: 1, type: 'query', sql: 'SELECT 1' }, null);

      expect(response.error).toBe('SQLite DB not initialized in worker');
    });

    it('returns error for unknown message type', () => {
      const response = handleMessage({ id: 1, type: 'unknown_type', sql: 'SELECT 1' }, db);

      expect(response.error).toBe('Unknown message type: unknown_type');
    });

    it('returns error for invalid SQL', () => {
      const response = handleMessage({ id: 1, type: 'query', sql: 'INVALID SQL STATEMENT' }, db);

      expect(response.error).toBeDefined();
      expect(response.error).toContain('syntax error');
    });

    it('returns error for constraint violation', () => {
      db.exec('CREATE TABLE IF NOT EXISTS unique_test (id INTEGER PRIMARY KEY, code TEXT UNIQUE)');
      db.prepare('INSERT INTO unique_test (code) VALUES (?)').run('ABC');

      const response = handleMessage(
        {
          id: 1,
          type: 'execute',
          sql: 'INSERT INTO unique_test (code) VALUES (?)',
          params: ['ABC'],
        },
        db
      );

      expect(response.error).toBeDefined();
      expect(response.error).toContain('UNIQUE constraint failed');
    });

    it('returns error for foreign key violation', () => {
      db.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec(
        'CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id))'
      );

      const response = handleMessage(
        { id: 1, type: 'execute', sql: 'INSERT INTO child (parent_id) VALUES (?)', params: [999] },
        db
      );

      expect(response.error).toBeDefined();
      expect(response.error).toContain('FOREIGN KEY constraint failed');
    });
  });

  describe('complex queries', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS authors (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT, author_id INTEGER, FOREIGN KEY(author_id) REFERENCES authors(id));
      `);
    });

    it('handles JOIN operations', () => {
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Alice');
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Bob');
      db.prepare('INSERT INTO books (title, author_id) VALUES (?, ?)').run('Book 1', 1);
      db.prepare('INSERT INTO books (title, author_id) VALUES (?, ?)').run('Book 2', 1);
      db.prepare('INSERT INTO books (title, author_id) VALUES (?, ?)').run('Book 3', 2);

      const response = handleMessage(
        {
          id: 1,
          type: 'query',
          sql: `
            SELECT authors.name, COUNT(books.id) as book_count
            FROM authors
            LEFT JOIN books ON authors.id = books.author_id
            GROUP BY authors.id
          `,
        },
        db
      );

      expect(response.result).toHaveLength(2);
      const alice = response.result.find((r: any) => r.name === 'Alice');
      expect(alice.book_count).toBe(2);
    });

    it('handles aggregate functions', () => {
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Alice');
      db.prepare('INSERT INTO books (title, author_id) VALUES (?, ?)').run('Book 1', 1);
      db.prepare('INSERT INTO books (title, author_id) VALUES (?, ?)').run('Book 2', 1);

      const response = handleMessage(
        {
          id: 1,
          type: 'query',
          sql: 'SELECT COUNT(*) as total, AVG(author_id) as avg_author FROM books',
        },
        db
      );

      expect(response.result[0].total).toBe(2);
      expect(response.result[0].avg_author).toBe(1);
    });

    it('handles ORDER BY and LIMIT', () => {
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Charlie');
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Alice');
      db.prepare('INSERT INTO authors (name) VALUES (?)').run('Bob');

      const response = handleMessage(
        {
          id: 1,
          type: 'query',
          sql: 'SELECT * FROM authors ORDER BY name ASC LIMIT 2',
        },
        db
      );

      expect(response.result).toHaveLength(2);
      expect(response.result[0].name).toBe('Alice');
      expect(response.result[1].name).toBe('Bob');
    });
  });

  describe('transactions', () => {
    beforeEach(() => {
      db.exec('CREATE TABLE IF NOT EXISTS accounts (id INTEGER PRIMARY KEY, balance INTEGER)');
    });

    it('supports explicit transactions', () => {
      // Begin transaction
      handleMessage({ id: 1, type: 'exec', sql: 'BEGIN TRANSACTION' }, db);

      // Insert and update
      handleMessage(
        { id: 2, type: 'execute', sql: 'INSERT INTO accounts (balance) VALUES (?)', params: [100] },
        db
      );
      handleMessage(
        { id: 3, type: 'execute', sql: 'UPDATE accounts SET balance = balance + 50 WHERE id = 1' },
        db
      );

      // Commit
      handleMessage({ id: 4, type: 'exec', sql: 'COMMIT' }, db);

      const result = handleMessage(
        { id: 5, type: 'query', sql: 'SELECT balance FROM accounts WHERE id = 1' },
        db
      );

      expect(result.result[0].balance).toBe(150);
    });

    it('rolls back on error', () => {
      // Insert initial data
      handleMessage(
        { id: 1, type: 'execute', sql: 'INSERT INTO accounts (balance) VALUES (?)', params: [100] },
        db
      );

      const beforeCount = handleMessage(
        { id: 2, type: 'query', sql: 'SELECT COUNT(*) as count FROM accounts' },
        db
      ).result[0].count;

      // Begin transaction
      handleMessage({ id: 3, type: 'exec', sql: 'BEGIN TRANSACTION' }, db);

      // Insert
      handleMessage(
        { id: 4, type: 'execute', sql: 'INSERT INTO accounts (balance) VALUES (?)', params: [200] },
        db
      );

      // Rollback
      handleMessage({ id: 5, type: 'exec', sql: 'ROLLBACK' }, db);

      const afterCount = handleMessage(
        { id: 6, type: 'query', sql: 'SELECT COUNT(*) as count FROM accounts' },
        db
      ).result[0].count;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('data types', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS types_test (
          id INTEGER PRIMARY KEY,
          int_col INTEGER,
          real_col REAL,
          text_col TEXT,
          blob_col BLOB
        )
      `);
    });

    it('handles INTEGER, REAL, TEXT, BLOB', () => {
      const blobData = Buffer.from('hello blob');

      handleMessage(
        {
          id: 1,
          type: 'execute',
          sql: 'INSERT INTO types_test (int_col, real_col, text_col, blob_col) VALUES (?, ?, ?, ?)',
          params: [42, 3.14, 'hello text', blobData],
        },
        db
      );

      const result = handleMessage({ id: 2, type: 'query', sql: 'SELECT * FROM types_test' }, db);

      expect(result.result[0].int_col).toBe(42);
      expect(result.result[0].real_col).toBeCloseTo(3.14);
      expect(result.result[0].text_col).toBe('hello text');
      expect(Buffer.from(result.result[0].blob_col).toString()).toBe('hello blob');
    });

    it('handles NULL values', () => {
      handleMessage(
        {
          id: 1,
          type: 'execute',
          sql: 'INSERT INTO types_test (int_col) VALUES (?)',
          params: [null],
        },
        db
      );

      const result = handleMessage({ id: 2, type: 'query', sql: 'SELECT * FROM types_test' }, db);

      expect(result.result[0].int_col).toBeNull();
      expect(result.result[0].real_col).toBeNull();
      expect(result.result[0].text_col).toBeNull();
    });
  });
});
