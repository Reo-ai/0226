import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  asp TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  reward_type TEXT NOT NULL DEFAULT 'fixed',
  reward REAL NOT NULL DEFAULT 0,
  avg_price REAL NOT NULL DEFAULT 0,
  approval_rate REAL NOT NULL DEFAULT 50,
  est_cvr REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'candidate',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  program_id INTEGER,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  referer TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clicks_link ON clicks(link_id, created_at);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at);
CREATE TABLE IF NOT EXISTS conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER,
  link_id INTEGER,
  occurred_at INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conv_occurred ON conversions(occurred_at);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER,
  link_id INTEGER,
  platform TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  posted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guide_progress (
  step_id TEXT PRIMARY KEY,
  done_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// 既存DBに後から足した列（CREATE TABLE IF NOT EXISTS では追加されないため）
const MIGRATIONS = [
  "ALTER TABLE posts ADD COLUMN video_status TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE posts ADD COLUMN video_theme TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE posts ADD COLUMN video_service TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE posts ADD COLUMN video_result TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE posts ADD COLUMN video_updated_at INTEGER",
];

export type Arg = InValue;

const g = globalThis as unknown as { __db?: Client; __dbReady?: Promise<void> };

function client(): Client {
  if (!g.__db) {
    const url = process.env.DATABASE_URL || (process.env.VERCEL ? "file:/tmp/app.db" : "file:./data/app.db");
    if (url.startsWith("file:")) {
      fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });
    }
    g.__db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
    g.__dbReady = (async () => {
      if (url.startsWith("file:")) await g.__db!.execute("PRAGMA journal_mode = WAL");
      await g.__db!.executeMultiple(SCHEMA);
      for (const sql of MIGRATIONS) {
        await g.__db!.execute(sql).catch((e) => {
          if (!/duplicate column/i.test(String(e))) throw e;
        });
      }
    })();
  }
  return g.__db;
}

async function ready(): Promise<Client> {
  const c = client();
  await g.__dbReady;
  return c;
}

function toObjects<T>(rs: { columns: string[]; rows: ArrayLike<unknown>[] }): T[] {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])) as T);
}

export async function all<T>(sql: string, ...args: Arg[]): Promise<T[]> {
  const rs = await (await ready()).execute({ sql, args });
  return toObjects<T>(rs);
}

export async function get<T>(sql: string, ...args: Arg[]): Promise<T | undefined> {
  return (await all<T>(sql, ...args))[0];
}

export async function run(sql: string, ...args: Arg[]): Promise<{ changes: number; lastId: number }> {
  const rs = await (await ready()).execute({ sql, args });
  return { changes: rs.rowsAffected, lastId: Number(rs.lastInsertRowid ?? 0) };
}

/** 複数の書き込みを1トランザクションで実行 */
export async function batch(stmts: InStatement[]) {
  if (stmts.length === 0) return;
  await (await ready()).batch(stmts, "write");
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
