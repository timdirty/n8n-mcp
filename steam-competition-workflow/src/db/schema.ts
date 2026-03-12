import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  hash_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  category TEXT NOT NULL,
  target_audience TEXT DEFAULT '全年齡',
  registration_start TEXT,
  registration_end TEXT,
  competition_date TEXT,
  location TEXT,
  description TEXT,
  url TEXT,
  contact TEXT,
  prize TEXT,
  fee TEXT,
  source TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  ai_categories TEXT,
  ai_primary TEXT,
  ai_confidence REAL,
  ai_summary TEXT,
  ai_key_points TEXT,
  ai_call_to_action TEXT,
  sent_to_line INTEGER DEFAULT 0,
  sent_at TEXT,
  scraped_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comp_hash ON competitions(hash_key);
CREATE INDEX IF NOT EXISTS idx_comp_url ON competitions(url);
CREATE INDEX IF NOT EXISTS idx_comp_sent ON competitions(sent_to_line);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL UNIQUE,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT DEFAULT 'running',
  sources_fetched INTEGER DEFAULT 0,
  items_raw INTEGER DEFAULT 0,
  items_normalized INTEGER DEFAULT 0,
  items_filtered INTEGER DEFAULT 0,
  items_after_dedup INTEGER DEFAULT 0,
  items_classified INTEGER DEFAULT 0,
  items_sent_line INTEGER DEFAULT 0,
  dedup_stats TEXT,
  duration_ms INTEGER,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  stage TEXT NOT NULL,
  source_id TEXT,
  severity TEXT DEFAULT 'error',
  message TEXT NOT NULL,
  stack TEXT,
  context TEXT,
  resolved INTEGER DEFAULT 0
);
`;

export function initDatabase(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}
