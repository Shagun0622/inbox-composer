import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'inbox.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const rawDb = new DatabaseSync(DB_PATH);

rawDb.exec('PRAGMA journal_mode = WAL');
rawDb.exec('PRAGMA foreign_keys = ON');

rawDb.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id             TEXT PRIMARY KEY,
    match_key      TEXT NOT NULL,
    type           TEXT NOT NULL,
    date           TEXT NOT NULL,
    time           TEXT,
    title          TEXT NOT NULL,
    detected_on    TEXT NOT NULL,
    attendees      TEXT NOT NULL,
    projects       TEXT NOT NULL,
    summary        TEXT,
    expected_files TEXT NOT NULL DEFAULT '[]',
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT '{}',
    sources        TEXT NOT NULL DEFAULT '{}',
    source         TEXT NOT NULL DEFAULT 'composer',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
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

// ---- Compatibility shim ----
// Existing code uses better-sqlite3's API:
//   db.prepare(sql).run(params)  -> { changes, lastInsertRowid }
//   db.prepare(sql).get(params)  -> row | undefined
//   db.prepare(sql).all(params)  -> row[]
//   db.transaction(fn)           -> returns a function that runs fn in a transaction
// node:sqlite uses @name -> :name for named params. This shim bridges both.

const _prepare = rawDb.prepare.bind(rawDb);

rawDb.prepare = function (sql) {
  // Rewrite @name to :name for node:sqlite compatibility
  const rewritten = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, ':$1');
  const stmt = _prepare(rewritten);

  function callWith(method, args) {
    const [first] = args;
    if (
      first !== undefined &&
      typeof first === 'object' &&
      first !== null &&
      !Array.isArray(first)
    ) {
      // Named params object
      return stmt[method](first);
    }
    return stmt[method](...args);
  }

  return {
    run: (...args) => {
      const res = callWith('run', args);
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowid: Number(res.lastInsertRowid ?? 0),
      };
    },
    get: (...args) => callWith('get', args),
    all: (...args) => callWith('all', args),
  };
};

rawDb.transaction = function (fn) {
  return (...args) => {
    rawDb.exec('BEGIN');
    try {
      const out = fn(...args);
      rawDb.exec('COMMIT');
      return out;
    } catch (err) {
      rawDb.exec('ROLLBACK');
      throw err;
    }
  };
};

export default rawDb;