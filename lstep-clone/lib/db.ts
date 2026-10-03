import { createClient, type Client, type InStatement, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { currentWorkspace, MAIN } from "./workspace";

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
  source_id INTEGER,
  rich_menu_id INTEGER,
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
  friend_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (friend_id, tag_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL,
  direction TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'none',
  ref_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_friend ON messages(friend_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at, channel);
CREATE TABLE IF NOT EXISTS pending_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  ref_id INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_friend ON pending_messages(friend_id);
CREATE TABLE IF NOT EXISTS auto_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'exact',
  reply TEXT NOT NULL,
  add_tag_id INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  hit_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  trigger_tag_id INTEGER,
  stop_tag_id INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scenario_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL,
  delay_minutes INTEGER NOT NULL,
  delivery TEXT NOT NULL DEFAULT 'push',
  fixed_time INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER NOT NULL,
  scenario_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  next_step_index INTEGER NOT NULL DEFAULT 0,
  next_run_at INTEGER,
  waiting INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  UNIQUE (friend_id, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, waiting, next_run_at);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tag_ids TEXT NOT NULL DEFAULT '[]',
  delivery TEXT NOT NULL DEFAULT 'push',
  status TEXT NOT NULL,
  error TEXT,
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
  add_tag_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  friend_id INTEGER,
  message_source TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rich_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  chat_bar_text TEXT NOT NULL,
  layout TEXT NOT NULL,
  areas TEXT NOT NULL,
  image_data TEXT NOT NULL,
  line_rich_menu_id TEXT,
  tag_id INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL,
  add_tag_id INTEGER,
  thanks_message TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS form_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL,
  friend_id INTEGER,
  answers TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  add_tag_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS source_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  line_user_id TEXT,
  attributed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_user ON source_visits(line_user_id, created_at);
CREATE TABLE IF NOT EXISTS ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id INTEGER,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS habits (
  friend_id INTEGER PRIMARY KEY,
  action TEXT NOT NULL DEFAULT '',
  remind_time TEXT,
  remind_enabled INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  last_done_date TEXT,
  last_reminded_date TEXT,
  state TEXT,
  badges TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS habit_logs (
  friend_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (friend_id, date)
);
CREATE TABLE IF NOT EXISTS custom_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS friend_fields (
  friend_id INTEGER NOT NULL,
  field_id INTEGER NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (friend_id, field_id)
);
CREATE TABLE IF NOT EXISTS booking_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  starts_at INTEGER NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 60,
  capacity INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_slots_start ON booking_slots(starts_at);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id INTEGER NOT NULL,
  friend_id INTEGER,
  name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'booked',
  reminded INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id, status);
CREATE TABLE IF NOT EXISTS score_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  ref_id INTEGER,
  points INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** 既存DBに後から足した列（CREATE TABLE IF NOT EXISTS では追加されない） */
const MIGRATIONS = [
  "ALTER TABLE scenarios ADD COLUMN stop_tag_id INTEGER",
  "ALTER TABLE scenario_steps ADD COLUMN fixed_time INTEGER NOT NULL DEFAULT 0",
  // シナリオの分岐：タグがある人だけ／ない人だけに送るステップ
  "ALTER TABLE scenario_steps ADD COLUMN cond_tag_id INTEGER",
  "ALTER TABLE scenario_steps ADD COLUMN cond_type TEXT",
  // 未返信の管理
  "ALTER TABLE friends ADD COLUMN needs_reply INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE friends ADD COLUMN needs_reply_at INTEGER",
  // 行動スコア
  "ALTER TABLE friends ADD COLUMN score INTEGER NOT NULL DEFAULT 0",
];

/** main だけの表への追加 */
const CONTROL_MIGRATIONS = [
  // スタッフ招待：既存の場所（target_ws）へ、役割（role）付きで招待する
  "ALTER TABLE invites ADD COLUMN target_ws TEXT",
  "ALTER TABLE invites ADD COLUMN role TEXT",
];

export type Arg = InValue;

/** main のデータベースだけに置く「場所・メンバー・招待」の表 */
const CONTROL_SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  owner_line_user_id TEXT NOT NULL,
  db_url TEXT NOT NULL,
  db_token TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, line_user_id)
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT,
  used_at INTEGER,
  workspace_id TEXT
);
`;

interface Conn {
  client: Client;
  ready: Promise<void>;
}
const g = globalThis as unknown as { __conns?: Map<string, Conn> };
const conns = (g.__conns ??= new Map());

function open(url: string, authToken: string | undefined, extraSchema = "", extraMigrations: string[] = []): Conn {
  if (url.startsWith("file:")) fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  const c = createClient({ url, authToken: authToken || undefined });
  const ready = (async () => {
    if (url.startsWith("file:")) await c.execute("PRAGMA journal_mode = WAL");
    await c.executeMultiple(SCHEMA + extraSchema);
    for (const sql of [...MIGRATIONS, ...extraMigrations]) {
      try {
        await c.execute(sql);
      } catch (err) {
        if (!/duplicate column/i.test(String(err))) throw err;
      }
    }
  })();
  return { client: c, ready };
}

function mainConn(): Conn {
  let c = conns.get(MAIN);
  if (!c) {
    const url = process.env.DATABASE_URL || (process.env.VERCEL ? "file:/tmp/app.db" : "file:./data/app.db");
    c = open(url, process.env.DATABASE_AUTH_TOKEN, CONTROL_SCHEMA, CONTROL_MIGRATIONS);
    conns.set(MAIN, c);
  }
  return c;
}

async function connFor(ws: string): Promise<Conn> {
  if (ws === MAIN) return mainConn();
  let c = conns.get(ws);
  if (!c) {
    const m = mainConn();
    await m.ready;
    const rs = await m.client.execute({ sql: "SELECT db_url, db_token FROM workspaces WHERE id = ?", args: [ws] });
    const row = rs.rows[0];
    if (!row) throw new Error(`ワークスペース ${ws} が見つかりません`);
    c = open(String(row[0]), row[1] ? String(row[1]) : undefined);
    conns.set(ws, c);
  }
  return c;
}

async function ready(): Promise<Client> {
  const c = await connFor(await currentWorkspace());
  await c.ready;
  return c.client;
}

/** main（場所・メンバー・招待の表がある）に対して実行する */
async function mainReady(): Promise<Client> {
  const c = mainConn();
  await c.ready;
  return c.client;
}

export async function mainAll<T>(sql: string, ...args: Arg[]): Promise<T[]> {
  return toObjects<T>(await (await mainReady()).execute({ sql, args }));
}
export async function mainGet<T>(sql: string, ...args: Arg[]): Promise<T | undefined> {
  return (await mainAll<T>(sql, ...args))[0];
}
export async function mainRun(sql: string, ...args: Arg[]) {
  const rs = await (await mainReady()).execute({ sql, args });
  return { changes: rs.rowsAffected };
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
