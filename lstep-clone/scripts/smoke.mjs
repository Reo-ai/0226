// 起動中のサーバーに疑似Webhookを送り、配信ロジックを検証するスモークテスト
//   npm run build && npm run smoke
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@libsql/client";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const DB_FILE = "./data/smoke.db";
const SECRET = "smoke-secret";
for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: {
    ...process.env,
    DATABASE_URL: `file:${DB_FILE}`,
    LINE_CHANNEL_SECRET: SECRET,
    LINE_CHANNEL_ACCESS_TOKEN: "",
    ANTHROPIC_API_KEY: "",
    CRON_SECRET: "cron",
    DISABLE_INTERNAL_CRON: "1",
    BASE_URL: BASE,
    LINE_ADD_FRIEND_URL: "https://line.me/R/ti/p/@example",
    ADMIN_PASSWORD: "x",
    SESSION_SECRET: "y",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${BASE}/login`);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("server did not start");
}

const db = createClient({ url: `file:${DB_FILE}` });
const q = async (sql, ...args) => (await db.execute({ sql, args })).rows;
const one = async (sql, ...args) => (await q(sql, ...args))[0];

async function hook(events) {
  const body = JSON.stringify({ events });
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64");
  const res = await fetch(`${BASE}/api/line/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-line-signature": sig },
    body,
  });
  assert.equal(res.status, 200);
  await sleep(700); // after() の処理待ち
}
const ev = (type, userId, extra = {}) => ({ type, replyToken: `rt-${Math.random()}`, source: { type: "user", userId }, ...extra });
const text = (userId, t) => ev("message", userId, { message: { type: "text", text: t } });
const cron = () => fetch(`${BASE}/api/cron?key=cron`).then((r) => assert.equal(r.status, 200));
const out = (fid) => q("SELECT source, channel, content FROM messages WHERE friend_id = ? AND direction = 'out' ORDER BY id", fid);

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}\n`, e);
    console.error(log.slice(-3000));
    server.kill();
    process.exit(1);
  }
}

await waitUp();
await cron(); // スキーマ初期化

// ---- seed ----
await db.batch([
  "INSERT INTO tags (name) VALUES ('資料請求')",
  "INSERT INTO tags (name) VALUES ('回答済み')",
  "INSERT INTO scenarios (name, trigger, created_at) VALUES ('ウェルカム', 'follow', 0)",
  "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, content) VALUES (1, 0, 'push', 'ようこそ{{name}} {{link:lp}}')",
  "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, content) VALUES (1, 60, 'push', '1時間後のお知らせ')",
  "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, content) VALUES (1, 120, 'reply', '2時間後（反応待ち）')",
  "INSERT INTO scenarios (name, trigger, trigger_tag_id, created_at) VALUES ('資料フォロー', 'tag', 1, 0)",
  "INSERT INTO scenario_steps (scenario_id, delay_minutes, content) VALUES (2, 0, '資料はこちら')",
  "INSERT INTO links (code, name, url, add_tag_id, created_at) VALUES ('lp', 'LP', 'https://example.com', NULL, 0)",
  "INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES ('資料', 'contains', '資料をお送りします', 1)",
  "INSERT INTO auto_replies (keyword, match_type, reply) VALUES ('たくさん', 'exact', 'a\n---\nb\n---\nc\n---\nd\n---\ne')",
  `INSERT INTO forms (title, fields, add_tag_id, created_at) VALUES ('アンケート', '[{"label":"名前","type":"text","options":[],"required":true}]', 2, 0)`,
  "INSERT INTO sources (code, name, add_tag_id, created_at) VALUES ('insta', 'Instagram', NULL, 0)",
]);

await test("署名が不正なWebhookは401", async () => {
  const r = await fetch(`${BASE}/api/line/webhook`, { method: "POST", headers: { "x-line-signature": "bad" }, body: "{}" });
  assert.equal(r.status, 401);
});

await test("友だち追加: 即時ステップは応答（無料）で届く", async () => {
  await hook([ev("follow", "U1")]);
  const msgs = await out(1);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].channel, "reply");
  assert.match(msgs[0].content, /\/r\/lp\?s=step&f=/);
});

await test("キーワード応答＋タグ起点ステップを1回の応答にまとめる", async () => {
  await hook([text("U1", "資料ください")]);
  const msgs = await out(1);
  assert.deepEqual(msgs.slice(1).map((m) => [m.source, m.channel]), [["auto", "reply"], ["step", "reply"]]);
  assert.ok(await one("SELECT 1 FROM friend_tags WHERE friend_id = 1 AND tag_id = 1"));
});

await test("時間が来たpush型ステップはcronでプッシュ（1通消費）", async () => {
  await q("UPDATE enrollments SET started_at = started_at - 61 * 60000, next_run_at = next_run_at - 61 * 60000 WHERE scenario_id = 1");
  await cron();
  const last = (await out(1)).at(-1);
  assert.equal(last.content, "1時間後のお知らせ");
  assert.equal(last.channel, "push");
});

await test("reply型ステップはcronでは送らず反応待ちにし、次の発言時に無料で届く", async () => {
  await q("UPDATE enrollments SET started_at = started_at - 60 * 60000, next_run_at = next_run_at - 60 * 60000 WHERE scenario_id = 1");
  await cron();
  assert.equal((await one("SELECT waiting FROM enrollments WHERE scenario_id = 1")).waiting, 1);
  const before = (await out(1)).length;
  await hook([text("U1", "こんにちは")]);
  const msgs = await out(1);
  assert.equal(msgs.length, before + 1);
  assert.equal(msgs.at(-1).content, "2時間後（反応待ち）");
  assert.equal(msgs.at(-1).channel, "reply");
  assert.equal((await one("SELECT status FROM enrollments WHERE scenario_id = 1")).status, "done");
});

await test("5吹き出しを超える分は保留され、次の反応で無料配信", async () => {
  await q("INSERT INTO pending_messages (friend_id, content, source, created_at, expires_at) VALUES (1, '保留分', 'manual', 0, 9999999999999)");
  await hook([text("U1", "たくさん")]);
  // 'たくさん' の応答で5吹き出しを使い切るので、保留分は次回へ
  assert.equal((await one("SELECT COUNT(*) n FROM pending_messages WHERE friend_id = 1")).n, 1);
  await hook([text("U1", "ok")]);
  assert.equal((await one("SELECT COUNT(*) n FROM pending_messages WHERE friend_id = 1")).n, 0);
  assert.equal((await out(1)).at(-1).channel, "reply");
});

await test("ポストバック form=ID でフォームURLを無料で返す", async () => {
  await hook([ev("postback", "U1", { postback: { data: "form=1" } })]);
  const last = (await out(1)).at(-1);
  assert.match(last.content, /\/f\/1\?f=/);
  assert.equal(last.channel, "reply");
});

await test("無料通数の上限を超えるプッシュ配信は止まる", async () => {
  await hook([ev("follow", "U2")]);
  await q("INSERT INTO settings (key, value) VALUES ('push_limit', '2') ON CONFLICT(key) DO UPDATE SET value = '2'");
  await q("INSERT INTO broadcasts (title, content, delivery, status, scheduled_at, created_at) VALUES ('p', 'プッシュ', 'push', 'scheduled', 0, 0)");
  await cron(); // 使用済み1 + 対象2人 > 上限2
  const b = await one("SELECT status, error FROM broadcasts WHERE title = 'p'");
  assert.equal(b.status, "failed");
  assert.match(b.error, /無料通数が足りません/);
});

await test("無料配信（反応時）は全員に保留され、反応した人にだけ応答で届く", async () => {
  await q("INSERT INTO broadcasts (title, content, delivery, status, scheduled_at, created_at) VALUES ('r', '無料のお知らせ', 'reply', 'scheduled', 0, 0)");
  await cron();
  assert.equal((await one("SELECT recipient_count FROM broadcasts WHERE title = 'r'")).recipient_count, 2);
  await hook([text("U2", "hi")]);
  const last = (await out(2)).at(-1);
  assert.equal(last.content, "無料のお知らせ");
  assert.equal(last.channel, "reply");
});

await test("通数切れ時、push型ステップは止まり、反応時に無料で届く", async () => {
  // U2 の 1時間後ステップを期限切れにする（上限2・使用済み1）
  await q("UPDATE settings SET value = '1' WHERE key = 'push_limit'");
  await q("UPDATE enrollments SET started_at = started_at - 61 * 60000, next_run_at = next_run_at - 61 * 60000 WHERE friend_id = 2 AND scenario_id = 1");
  await cron();
  assert.equal((await out(2)).filter((m) => m.channel === "push").length, 0);
  await hook([text("U2", "まだ？")]);
  const last = (await out(2)).at(-1);
  assert.equal(last.content, "1時間後のお知らせ");
  assert.equal(last.channel, "reply");
});

await test("クリック計測リダイレクト", async () => {
  const token = (await one("SELECT token FROM friends WHERE id = 1")).token;
  const r = await fetch(`${BASE}/r/lp?f=${token}&s=step`, { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "https://example.com/");
  assert.equal((await one("SELECT COUNT(*) n FROM link_clicks WHERE friend_id = 1")).n, 1);
});

await test("流入経路URL（LIFFなし）は訪問を記録して友だち追加へ", async () => {
  const r = await fetch(`${BASE}/join/insta`, { redirect: "manual" });
  assert.ok([302, 303, 307].includes(r.status), `status ${r.status}`);
  assert.equal(r.headers.get("location"), "https://line.me/R/ti/p/@example");
  assert.equal((await one("SELECT COUNT(*) n FROM source_visits")).n, 1);
});

await test("友だち追加前の訪問から流入経路を紐付け", async () => {
  await q("INSERT INTO source_visits (source_id, line_user_id, created_at) VALUES (1, 'U3', ?)", Date.now());
  await hook([ev("follow", "U3")]);
  assert.equal((await one("SELECT source_id FROM friends WHERE line_user_id = 'U3'")).source_id, 1);
});

await test("ブロックでシナリオ停止・保留削除", async () => {
  await q("INSERT INTO pending_messages (friend_id, content, source, created_at, expires_at) VALUES (2, 'x', 'manual', 0, 9999999999999)");
  await hook([{ type: "unfollow", source: { type: "user", userId: "U2" } }]);
  assert.equal((await one("SELECT blocked FROM friends WHERE id = 2")).blocked, 1);
  assert.equal((await one("SELECT COUNT(*) n FROM pending_messages WHERE friend_id = 2")).n, 0);
  assert.equal((await one("SELECT COUNT(*) n FROM enrollments WHERE friend_id = 2 AND status = 'active'")).n, 0);
});

await test("停止タグが付くとシナリオが止まり、タグ起点の時刻指定ステップは開始日0時(JST)から数える", async () => {
  await db.batch([
    "INSERT INTO tags (name) VALUES ('購入済み')",
    "INSERT INTO scenarios (name, trigger, stop_tag_id, created_at) VALUES ('セールス', 'manual', 3, 0)",
    "INSERT INTO scenario_steps (scenario_id, delay_minutes, content) VALUES (3, 60, '購入しませんか')",
    "INSERT INTO scenarios (name, trigger, trigger_tag_id, created_at) VALUES ('購入者フォロー', 'tag', 3, 0)",
    "INSERT INTO scenario_steps (scenario_id, delay_minutes, fixed_time, content) VALUES (4, 2640, 1, '翌日20時')",
    "INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES ('購入しました', 'exact', 'ありがとうございます', 3)",
    "INSERT INTO enrollments (friend_id, scenario_id, started_at, next_run_at) VALUES (3, 3, 0, 0)",
  ]);
  await hook([text("U3", "購入しました")]);
  assert.ok(!(await out(3)).some((m) => m.content === "購入しませんか"));
  assert.equal((await one("SELECT status FROM enrollments WHERE friend_id = 3 AND scenario_id = 3")).status, "stopped");
  const e = await one("SELECT started_at, next_run_at FROM enrollments WHERE friend_id = 3 AND scenario_id = 4");
  const dayStart = Math.floor((Number(e.started_at) + 9 * 3600_000) / 86_400_000) * 86_400_000 - 9 * 3600_000;
  assert.equal(Number(e.next_run_at), dayStart + 2640 * 60_000);
});

await test("CSVエクスポートは要ログイン", async () => {
  assert.equal((await fetch(`${BASE}/api/export/friends`)).status, 401);
});

console.log(`\n${passed} passed`);
server.kill();
process.exit(0);
