import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../common/logger.js';

let db: Database.Database | null = null;

export function getDatabase(dataDir: string): Database.Database {
  if (db) return db;

  const dbPath = path.join(dataDir, 'agent.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  logger.info(`Database initialized: ${dbPath}`);

  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT,
      is_active INTEGER DEFAULT 1,
      model TEXT,
      provider TEXT,
      cost REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL DEFAULT '',
      tool_call_id TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      reasoning_tokens INTEGER DEFAULT 0,
      model TEXT,
      provider TEXT,
      cost REAL DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS message_parts (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      part_type TEXT NOT NULL,
      content TEXT DEFAULT '{}',
      seq INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      tier TEXT DEFAULT 'working',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0,
      data TEXT DEFAULT '{}',
      trace_id TEXT,
      occurred_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tool_executions (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      session_id TEXT REFERENCES sessions(id),
      message_id TEXT,
      tool_name TEXT NOT NULL,
      tool_input TEXT DEFAULT '{}',
      tool_output TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      duration_ms INTEGER DEFAULT 0,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id);
    CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);
    CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
