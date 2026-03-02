import sqlite3 from 'sqlite3';
import { config } from '../config/slack.js';
import { pool, initializeDatabase } from './dbPostgres.js';
import fs from 'fs';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL;
const usePostgres = databaseUrl && (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'));

let db;

if (usePostgres) {
  console.log('Using PostgreSQL database');
  await initializeDatabase();
  db = pool;
} else {
  console.log('Using SQLite database');
  const dbPath = config.database.path;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err);
    } else {
      console.log('Connected to SQLite database');
    }
  });

  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        text TEXT,
        timestamp TEXT NOT NULL,
        thread_ts TEXT,
        is_user_message INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS team_members (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        real_name TEXT,
        display_name TEXT,
        message_count INTEGER DEFAULT 0,
        last_seen DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS personality_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        avg_message_length REAL,
        common_phrases TEXT,
        tone_indicators TEXT,
        emoji_patterns TEXT,
        greeting_patterns TEXT,
        closing_patterns TEXT,
        vocabulary_frequency TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS response_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT,
        channel_id TEXT,
        context TEXT,
        generated_response TEXT,
        confidence_score REAL,
        auto_sent INTEGER DEFAULT 0,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `);
  });
}

export default db;
export { usePostgres };
