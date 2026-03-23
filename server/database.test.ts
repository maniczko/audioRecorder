import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Database } from 'bun:sqlite';
import { initDatabase } from './database';

describe('Database Integration Tests', () => {
  let db: Database;

  beforeAll(() => {
    // Używamy bazy w pamięci dla szybkości testów
    db = new Database(':memory:');
    initDatabase(db);
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
      
      const deleted = db.get('SELECT * FROM users WHERE id = ?', user.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Meetings Table', () => {
    it('should create a meeting and link to user', () => {
      const date = new Date().toISOString();
      // Create user first
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'owner@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'owner@example.com') as any;

      const meetingTitle = 'Team Standup';
      const meetingDate = new Date().toISOString();

      const result = db.run(
        `INSERT INTO meetings (user_id, title, start_time, status, created_at) 
         VALUES (?, ?, ?, 'completed', ?)`,
        user.id, meetingTitle, meetingDate, date
      );

      expect(result.changes).toBe(1);

      const meeting = db.get('SELECT * FROM meetings WHERE id = ?', result.lastInsertRowid) as any;
      expect(meeting.title).toBe(meetingTitle);
      expect(meeting.user_id).toBe(user.id);
    });

    it('should fail to create meeting for non-existent user (FK constraint)', () => {
      const date = new Date().toISOString();
      expect(() => {
        db.run(
          `INSERT INTO meetings (user_id, title, start_time, status, created_at) 
           VALUES (?, ?, ?, 'completed', ?)`,
          9999, 'Fake Meeting', date, date
        );
      }).toThrow(); // FOREIGN KEY constraint failed
    });

    it('should cascade delete meetings when user is deleted', () => {
      const date = new Date().toISOString();
      // Create user
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'cascade@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'cascade@example.com') as any;

      // Create meeting
      db.run(
        `INSERT INTO meetings (user_id, title, start_time, status, created_at) 
         VALUES (?, ?, ?, 'completed', ?)`,
        user.id, 'To Be Deleted', date, date
      );

      // Verify meeting exists
      const countBefore = db.get('SELECT COUNT(*) as count FROM meetings WHERE user_id = ?', user.id) as any;
      expect(countBefore.count).toBe(1);

      // Delete user
      db.run('DELETE FROM users WHERE id = ?', user.id);

      // Verify meeting is gone
      const countAfter = db.get('SELECT COUNT(*) as count FROM meetings WHERE user_id = ?', user.id) as any;
      expect(countAfter.count).toBe(0);
    });

    it('should filter meetings by date range', () => {
      const date = new Date().toISOString();
      // Create user
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'filter@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'filter@example.com') as any;

      // Create meetings with different dates
      const oldDate = '2023-01-01T10:00:00Z';
      const newDate = '2024-01-01T10:00:00Z';
      
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Old Meeting', oldDate, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'New Meeting', newDate, date);

      const recentMeetings = db.all(
        'SELECT * FROM meetings WHERE user_id = ? AND start_time >= ?',
        user.id, '2023-06-01T00:00:00Z'
      ) as any[];

      expect(recentMeetings.length).toBe(1);
      expect(recentMeetings[0].title).toBe('New Meeting');
    });

    it('should filter meetings by status', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'status@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'status@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Completed', date, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'processing', ?)`, user.id, 'Processing', date, date);

      const completed = db.all(
        'SELECT * FROM meetings WHERE user_id = ? AND status = ?',
        user.id, 'completed'
      ) as any[];

      expect(completed.length).toBe(1);
      expect(completed[0].title).toBe('Completed');
    });

    it('should order meetings by created_at DESC', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'order@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'order@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'First', '2023-01-01T00:00:00Z', date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Second', '2023-06-01T00:00:00Z', date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Third', '2023-12-01T00:00:00Z', date);

      const ordered = db.all(
        'SELECT * FROM meetings WHERE user_id = ? ORDER BY start_time DESC',
        user.id
      ) as any[];

      expect(ordered.length).toBe(3);
      expect(ordered[0].title).toBe('Third');
      expect(ordered[1].title).toBe('Second');
      expect(ordered[2].title).toBe('First');
    });

    it('should update meeting status', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'update@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'update@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'processing', ?)`, user.id, 'Update Status', date, date);
      const meeting = db.get('SELECT * FROM meetings WHERE title = ?', 'Update Status') as any;

      db.run('UPDATE meetings SET status = ? WHERE id = ?', 'completed', meeting.id);

      const updated = db.get('SELECT * FROM meetings WHERE id = ?', meeting.id) as any;
      expect(updated.status).toBe('completed');
    });

    it('should count meetings per user', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'count@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'count@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'M1', date, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'M2', date, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'M3', date, date);

      const count = db.get('SELECT COUNT(*) as count FROM meetings WHERE user_id = ?', user.id) as any;
      expect(count.count).toBe(3);
    });
  });

  describe('Transcripts Table', () => {
    it('should create transcript linked to meeting', () => {
      const date = new Date().toISOString();
      // Setup user and meeting
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'transcript@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'transcript@example.com') as any;
      
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Meeting for Transcript', date, date);
      const meeting = db.get('SELECT id FROM meetings WHERE title = ?', 'Meeting for Transcript') as any;

      const content = 'Hello, this is a test transcript.';
      
      db.run(
        `INSERT INTO transcripts (meeting_id, content, language, created_at) 
         VALUES (?, ?, 'en', ?)`,
        meeting.id, content, date
      );

      const transcript = db.get('SELECT * FROM transcripts WHERE meeting_id = ?', meeting.id) as any;
      expect(transcript).toBeDefined();
      expect(transcript.content).toBe(content);
      expect(transcript.language).toBe('en');
    });

    it('should update transcript content', () => {
      const date = new Date().toISOString();
      // Setup
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'update@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'update@example.com') as any;
      
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Update Meeting', date, date);
      const meeting = db.get('SELECT id FROM meetings WHERE title = ?', 'Update Meeting') as any;

      db.run(`INSERT INTO transcripts (meeting_id, content, language, created_at) VALUES (?, ?, 'en', ?)`, meeting.id, 'Original', date);

      // Update
      const newContent = 'Updated content here';
      db.run('UPDATE transcripts SET content = ? WHERE meeting_id = ?', newContent, meeting.id);

      const updated = db.get('SELECT * FROM transcripts WHERE meeting_id = ?', meeting.id) as any;
      expect(updated.content).toBe(newContent);
    });

    it('should fail to create transcript for non-existent meeting', () => {
      const date = new Date().toISOString();
      expect(() => {
        db.run(
          `INSERT INTO transcripts (meeting_id, content, language, created_at) 
           VALUES (?, ?, 'en', ?)`,
          9999, 'Fake content', date
        );
      }).toThrow(); // FOREIGN KEY constraint failed
    });

    it('should delete transcript when meeting is deleted', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'delete@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'delete@example.com') as any;
      
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Delete Meeting', date, date);
      const meeting = db.get('SELECT id FROM meetings WHERE title = ?', 'Delete Meeting') as any;

      db.run(`INSERT INTO transcripts (meeting_id, content, language, created_at) VALUES (?, ?, 'en', ?)`, meeting.id, 'Content', date);

      // Verify transcript exists
      const transcriptBefore = db.get('SELECT * FROM transcripts WHERE meeting_id = ?', meeting.id);
      expect(transcriptBefore).toBeDefined();

      // Delete meeting
      db.run('DELETE FROM meetings WHERE id = ?', meeting.id);

      // Verify transcript is gone
      const transcriptAfter = db.get('SELECT * FROM transcripts WHERE meeting_id = ?', meeting.id);
      expect(transcriptAfter).toBeUndefined();
    });
  });

  describe('Transactions', () => {
    it('should rollback transaction on error', () => {
      const date = new Date().toISOString();
      
      try {
        db.transaction(() => {
          // Create user
          db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'tx@example.com', 'hash', date);
          
          // Try to insert invalid data that will fail (simulated error)
          throw new Error('Simulated failure');
        })();
      } catch (e) {
        // Expected
      }

      // Verify no user was created
      const user = db.get('SELECT * FROM users WHERE email = ?', 'tx@example.com');
      expect(user).toBeUndefined();
    });

    it('should commit transaction successfully', () => {
      const date = new Date().toISOString();
      
      db.transaction(() => {
        db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'success@example.com', 'hash', date);
        db.run('INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES ((SELECT id FROM users WHERE email=?), ?, ?, \'completed\', ?)', 'success@example.com', 'Tx Meeting', date, date);
      })();

      const user = db.get('SELECT * FROM users WHERE email = ?', 'success@example.com');
      const meeting = db.get('SELECT * FROM meetings WHERE title = ?', 'Tx Meeting');

      expect(user).toBeDefined();
      expect(meeting).toBeDefined();
    });

    it('should handle nested transactions', () => {
      const date = new Date().toISOString();
      
      db.transaction(() => {
        db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'nested@example.com', 'hash', date);
        
        // Nested transaction
        db.transaction(() => {
          const user = db.get('SELECT id FROM users WHERE email = ?', 'nested@example.com') as any;
          db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Nested Meeting', date, date);
        })();
      })();

      const user = db.get('SELECT * FROM users WHERE email = ?', 'nested@example.com');
      const meeting = db.get('SELECT * FROM meetings WHERE title = ?', 'Nested Meeting');

      expect(user).toBeDefined();
      expect(meeting).toBeDefined();
    });
  });

  describe('Complex Queries', () => {
    it('should join meetings with users', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'join@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'join@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Join Meeting', date, date);

      const result = db.get(`
        SELECT m.title, u.email 
        FROM meetings m 
        JOIN users u ON m.user_id = u.id 
        WHERE m.title = ?
      `, 'Join Meeting') as any;

      expect(result).toBeDefined();
      expect(result.title).toBe('Join Meeting');
      expect(result.email).toBe('join@example.com');
    });

    it('should join meetings with transcripts', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'join2@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'join2@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Join Meeting 2', date, date);
      const meeting = db.get('SELECT id FROM meetings WHERE title = ?', 'Join Meeting 2') as any;

      db.run(`INSERT INTO transcripts (meeting_id, content, language, created_at) VALUES (?, ?, 'en', ?)`, meeting.id, 'Transcript content', date);

      const result = db.get(`
        SELECT m.title, t.content, t.language
        FROM meetings m
        JOIN transcripts t ON m.id = t.meeting_id
        WHERE m.title = ?
      `, 'Join Meeting 2') as any;

      expect(result).toBeDefined();
      expect(result.title).toBe('Join Meeting 2');
      expect(result.content).toBe('Transcript content');
      expect(result.language).toBe('en');
    });

    it('should aggregate data with GROUP BY', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'agg@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'agg@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'M1', date, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'M2', date, date);
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'processing', ?)`, user.id, 'M3', date, date);

      const result = db.all(`
        SELECT status, COUNT(*) as count
        FROM meetings
        WHERE user_id = ?
        GROUP BY status
      `, user.id) as any[];

      expect(result.length).toBe(2);
      const completed = result.find(r => r.status === 'completed');
      const processing = result.find(r => r.status === 'processing');
      expect(completed?.count).toBe(2);
      expect(processing?.count).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty result sets', () => {
      const result = db.all('SELECT * FROM meetings WHERE user_id = ?', 9999);
      expect(result).toEqual([]);
    });

    it('should handle NULL values correctly', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'null@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'null@example.com') as any;

      // Insert meeting with NULL in optional fields
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, null, date, date);
      
      const meeting = db.get('SELECT * FROM meetings WHERE user_id = ?', user.id) as any;
      expect(meeting.title).toBeNull();
    });

    it('should handle special characters in text fields', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'special@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'special@example.com') as any;

      const specialTitle = "Meeting with 'quotes' and \"double quotes\" and émojis 🎉";
      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, specialTitle, date, date);

      const meeting = db.get('SELECT * FROM meetings WHERE user_id = ?', user.id) as any;
      expect(meeting.title).toBe(specialTitle);
    });

    it('should handle very long text content', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'long@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'long@example.com') as any;

      db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, 'Long Meeting', date, date);
      const meeting = db.get('SELECT id FROM meetings WHERE title = ?', 'Long Meeting') as any;

      const longContent = 'A'.repeat(10000);
      db.run(`INSERT INTO transcripts (meeting_id, content, language, created_at) VALUES (?, ?, 'en', ?)`, meeting.id, longContent, date);

      const transcript = db.get('SELECT * FROM transcripts WHERE meeting_id = ?', meeting.id) as any;
      expect(transcript.content.length).toBe(10000);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk inserts efficiently', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'bulk@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'bulk@example.com') as any;

      const startTime = Date.now();
      
      const insertStmt = db.prepare(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`);
      
      db.transaction(() => {
        for (let i = 0; i < 100; i++) {
          insertStmt.run(user.id, `Meeting ${i}`, date, date);
        }
      })();

      const endTime = Date.now();
      const duration = endTime - startTime;

      const count = db.get('SELECT COUNT(*) as count FROM meetings WHERE user_id = ?', user.id) as any;
      expect(count.count).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should use indexes for filtered queries', () => {
      const date = new Date().toISOString();
      db.run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', 'index@example.com', 'hash', date);
      const user = db.get('SELECT id FROM users WHERE email = ?', 'index@example.com') as any;

      // Insert multiple meetings
      for (let i = 0; i < 50; i++) {
        db.run(`INSERT INTO meetings (user_id, title, start_time, status, created_at) VALUES (?, ?, ?, 'completed', ?)`, user.id, `Meeting ${i}`, date, date);
      }

      const startTime = Date.now();
      const result = db.all('SELECT * FROM meetings WHERE user_id = ? AND status = ?', user.id, 'completed');
      const endTime = Date.now();

      expect(result.length).toBe(50);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });
  });
});
