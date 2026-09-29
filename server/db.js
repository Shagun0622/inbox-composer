import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Where the SQLite file lives: ../data/inbox.db
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'inbox.db');

// Make sure data/ exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// Open (or create) the database
const db = new Database(DB_PATH);

// Performance + safety pragmas
db.pragma('journal_mode = WAL');   // better concurrency
db.pragma('foreign_keys = ON');    // enforce FK constraints

// ---- Schema ----
db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id            TEXT PRIMARY KEY,          -- {date}_{match_key}
    match_key     TEXT NOT NULL,
    type          TEXT NOT NULL,             -- meeting | slack_thread | email_thread
    date          TEXT NOT NULL,
    time          TEXT,
    title         TEXT NOT NULL,
    detected_on   TEXT NOT NULL,
    attendees     TEXT NOT NULL,             -- JSON array (stored as text)
    projects      TEXT NOT NULL,             -- JSON array
    summary       TEXT,
    expected_files TEXT NOT NULL DEFAULT '[]',
    notes         TEXT,
    status        TEXT NOT NULL DEFAULT '{}',-- JSON object
    sources       TEXT NOT NULL DEFAULT '{}',-- JSON object
    source        TEXT NOT NULL DEFAULT 'composer', -- where it came from
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

    CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT NOT NULL,
  signal_id   TEXT,
  payload     TEXT,
  result      TEXT NOT NULL,
  message     TEXT,
  actor       TEXT NOT NULL DEFAULT 'system',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

  CREATE INDEX IF NOT EXISTS idx_signals_match_key ON signals(match_key);
  CREATE INDEX IF NOT EXISTS idx_signals_date ON signals(date);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`);

export default db;