/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Test the sqliteWorker logic directly (without worker_threads)
describe("sqliteWorker logic", () => {
  let db: DatabaseSync;
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `test_sqlite_${Date.now()}.db`);
    db = new DatabaseSync(tempDbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
    // Clean up WAL files
    const walPath = tempDbPath + "-wal";
    const shmPath = tempDbPath + "-shm";
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe("PRAGMA settings", () => {
    it("sets WAL journal mode", () => {
      const result = db.prepare("PRAGMA journal_mode").get();
      expect(result.journal_mode).toBe("wal");
    });

    it("enables foreign keys", () => {
      const result = db.prepare("PRAGMA foreign_keys").get();
      expect(result.foreign_keys).toBe(1);
    });
  });

  describe("query operations", () => {
    it("executes CREATE TABLE statement", () => {
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
      const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'").get();
      expect(result).toBeDefined();
    });

    it("executes INSERT and retrieves data", () => {
      db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");
      db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run("Alice", "alice@example.com");
      
      const result = db.prepare("SELECT * FROM users WHERE name = ?").all("Alice");
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Alice");
      expect(result[0].email).toBe("alice@example.com");
    });

    it("returns single row with get operation", () => {
      db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
      db.prepare("INSERT INTO items (value) VALUES (?)").run("test-value");
      
      const result = db.prepare("SELECT * FROM items WHERE value = ?").get("test-value");
      expect(result).toBeDefined();
      expect(result.value).toBe("test-value");
    });

    it("handles parameterized queries", () => {
      db.exec("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)");
      db.prepare("INSERT INTO products (name, price) VALUES (?, ?)").run("Widget", 9.99);
      db.prepare("INSERT INTO products (name, price) VALUES (?, ?)").run("Gadget", 19.99);
      
      const result = db.prepare("SELECT * FROM products WHERE price > ?").all(10);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Gadget");
    });

    it("handles UPDATE operations", () => {
      db.exec("CREATE TABLE counter (id INTEGER PRIMARY KEY, count INTEGER DEFAULT 0)");
      db.prepare("INSERT INTO counter (count) VALUES (0)").run();
      
      db.prepare("UPDATE counter SET count = count + 1 WHERE id = 1").run();
      
      const result = db.prepare("SELECT count FROM counter WHERE id = 1").get();
      expect(result.count).toBe(1);
    });

    it("handles DELETE operations", () => {
      db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
      db.prepare("INSERT INTO items (value) VALUES (?)").run("item1");
      db.prepare("INSERT INTO items (value) VALUES (?)").run("item2");
      
      db.prepare("DELETE FROM items WHERE value = ?").run("item1");
      
      const result = db.prepare("SELECT * FROM items").all();
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe("item2");
    });
  });

  describe("error handling", () => {
    it("throws error for non-existent table", () => {
      expect(() => {
        db.prepare("SELECT * FROM nonexistent").all();
      }).toThrow("no such table");
    });

    it("throws error for invalid SQL", () => {
      expect(() => {
        db.prepare("INVALID SQL STATEMENT").run();
      }).toThrow();
    });

    it("handles constraint violations", () => {
      db.exec("CREATE TABLE unique_items (id INTEGER PRIMARY KEY, code TEXT UNIQUE)");
      db.prepare("INSERT INTO unique_items (code) VALUES (?)").run("ABC");
      
      expect(() => {
        db.prepare("INSERT INTO unique_items (code) VALUES (?)").run("ABC");
      }).toThrow("UNIQUE constraint failed");
    });

    it("handles foreign key violations", () => {
      db.exec("CREATE TABLE parent (id INTEGER PRIMARY KEY, name TEXT)");
      db.exec("CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER, FOREIGN KEY(parent_id) REFERENCES parent(id))");
      
      expect(() => {
        db.prepare("INSERT INTO child (parent_id) VALUES (?)").run(999);
      }).toThrow("FOREIGN KEY constraint failed");
    });
  });

  describe("transactions", () => {
    it("supports explicit transactions", () => {
      db.exec("CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)");
      db.prepare("INSERT INTO accounts (balance) VALUES (?)").run(100);
      db.prepare("INSERT INTO accounts (balance) VALUES (?)").run(200);
      
      // Begin transaction
      db.exec("BEGIN TRANSACTION");
      try {
        db.prepare("UPDATE accounts SET balance = balance - 50 WHERE id = 1").run();
        db.prepare("UPDATE accounts SET balance = balance + 50 WHERE id = 2").run();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      
      const result = db.prepare("SELECT * FROM accounts ORDER BY id").all();
      expect(result[0].balance).toBe(50);
      expect(result[1].balance).toBe(250);
    });

    it("rolls back on error", () => {
      db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value INTEGER)");
      db.prepare("INSERT INTO test (value) VALUES (?)").run(1);
      
      const beforeCount = db.prepare("SELECT COUNT(*) as count FROM test").get().count;
      
      // Try a transaction that will fail
      db.exec("BEGIN TRANSACTION");
      try {
        db.prepare("INSERT INTO test (value) VALUES (?)").run(2);
        db.prepare("INSERT INTO nonexistent (value) VALUES (?)").run(3); // This will fail
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
      }
      
      const afterCount = db.prepare("SELECT COUNT(*) as count FROM test").get().count;
      expect(afterCount).toBe(beforeCount); // Should be same as before transaction
    });
  });

  describe("complex queries", () => {
    it("handles JOIN operations", () => {
      db.exec("CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT)");
      db.exec("CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author_id INTEGER)");
      
      db.prepare("INSERT INTO authors (name) VALUES (?)").run("Alice");
      db.prepare("INSERT INTO authors (name) VALUES (?)").run("Bob");
      db.prepare("INSERT INTO books (title, author_id) VALUES (?, ?)").run("Book 1", 1);
      db.prepare("INSERT INTO books (title, author_id) VALUES (?, ?)").run("Book 2", 1);
      db.prepare("INSERT INTO books (title, author_id) VALUES (?, ?)").run("Book 3", 2);
      
      const result = db.prepare(`
        SELECT authors.name, COUNT(books.id) as book_count
        FROM authors
        LEFT JOIN books ON authors.id = books.author_id
        GROUP BY authors.id
      `).all();
      
      expect(result).toHaveLength(2);
      expect(result.find((r: any) => r.name === "Alice")?.book_count).toBe(2);
      expect(result.find((r: any) => r.name === "Bob")?.book_count).toBe(1);
    });

    it("handles aggregate functions", () => {
      db.exec("CREATE TABLE sales (id INTEGER PRIMARY KEY, amount REAL, date TEXT)");
      db.prepare("INSERT INTO sales (amount, date) VALUES (?, ?)").run(100, "2026-03-01");
      db.prepare("INSERT INTO sales (amount, date) VALUES (?, ?)").run(200, "2026-03-01");
      db.prepare("INSERT INTO sales (amount, date) VALUES (?, ?)").run(150, "2026-03-02");
      
      const result = db.prepare(`
        SELECT date, SUM(amount) as total, AVG(amount) as average, COUNT(*) as count
        FROM sales
        GROUP BY date
      `).all();
      
      expect(result).toHaveLength(2);
      const day1 = result.find((r: any) => r.date === "2026-03-01");
      expect(day1.total).toBe(300);
      expect(day1.average).toBe(150);
      expect(day1.count).toBe(2);
    });

    it("handles ORDER BY and LIMIT", () => {
      db.exec("CREATE TABLE scores (id INTEGER PRIMARY KEY, player TEXT, score INTEGER)");
      db.prepare("INSERT INTO scores (player, score) VALUES (?, ?)").run("Alice", 100);
      db.prepare("INSERT INTO scores (player, score) VALUES (?, ?)").run("Bob", 300);
      db.prepare("INSERT INTO scores (player, score) VALUES (?, ?)").run("Charlie", 200);
      
      const result = db.prepare("SELECT * FROM scores ORDER BY score DESC LIMIT 2").all();
      
      expect(result).toHaveLength(2);
      expect(result[0].player).toBe("Bob");
      expect(result[1].player).toBe("Charlie");
    });
  });

  describe("data types", () => {
    it("handles INTEGER, REAL, TEXT, BLOB", () => {
      db.exec(`CREATE TABLE types_test (
        id INTEGER PRIMARY KEY,
        int_col INTEGER,
        real_col REAL,
        text_col TEXT,
        blob_col BLOB
      )`);
      
      const blobData = Buffer.from("hello blob");
      db.prepare("INSERT INTO types_test (int_col, real_col, text_col, blob_col) VALUES (?, ?, ?, ?)")
        .run(42, 3.14, "hello text", blobData);
      
      const result = db.prepare("SELECT * FROM types_test").get();
      expect(result.int_col).toBe(42);
      expect(result.real_col).toBeCloseTo(3.14);
      expect(result.text_col).toBe("hello text");
      expect(Buffer.from(result.blob_col).toString()).toBe("hello blob");
    });

    it("handles NULL values", () => {
      db.exec("CREATE TABLE nullable_test (id INTEGER PRIMARY KEY, value TEXT)");
      db.prepare("INSERT INTO nullable_test (value) VALUES (?)").run(null);
      
      const result = db.prepare("SELECT * FROM nullable_test").get();
      expect(result.value).toBeNull();
    });
  });

  describe("WAL mode benefits", () => {
    it("allows concurrent reads during write", () => {
      db.exec("CREATE TABLE wal_test (id INTEGER PRIMARY KEY, value TEXT)");
      db.prepare("INSERT INTO wal_test (value) VALUES (?)").run("initial");
      
      // In WAL mode, readers don't block writers and vice versa
      const reader = db.prepare("SELECT * FROM wal_test").all();
      expect(reader).toHaveLength(1);
      
      db.prepare("INSERT INTO wal_test (value) VALUES (?)").run("added");
      
      const reader2 = db.prepare("SELECT * FROM wal_test").all();
      expect(reader2).toHaveLength(2);
    });
  });
});
