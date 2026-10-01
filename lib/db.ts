import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  picture_url TEXT,
  status_message TEXT,
  blocked INTEGER NOT NULL DEFAULT 0,
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  followed_at INTEGER NOT NULL,
  unfollowed_at INTEGER,
  last_message_at INTEGER
);
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#06c755'
);
CREATE TABLE IF NOT EXISTS friend_tags (
  friend_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (friend_id, tag_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  ref_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_friend ON messages(friend_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE TABLE IF NOT EXISTS auto_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact','contains')),
  reply TEXT NOT NULL,
  add_tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('follow','tag','manual')),
  trigger_tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  delay_minutes INTEGER NOT NULL,
  content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  next_step_index INTEGER NOT NULL DEFAULT 0,
  next_run_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','stopped')),
  UNIQUE (friend_id, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, next_run_at);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tag_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('scheduled','sending','sent','canceled','failed')),
  scheduled_at INTEGER NOT NULL,
  sent_at INTEGER,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  add_tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  friend_id INTEGER REFERENCES friends(id) ON DELETE SET NULL,
  message_source TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const globalForDb = globalThis as unknown as { __db?: Database.Database };

function open(): Database.Database {
  const file = process.env.DATABASE_PATH || "./data/app.db";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function db(): Database.Database {
  if (!globalForDb.__db) globalForDb.__db = open();
  return globalForDb.__db;
}

export function getSetting(key: string, fallback = ""): string {
  const row = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}
