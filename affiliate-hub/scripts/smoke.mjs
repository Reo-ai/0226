// 起動中のサーバーに対して、計測リダイレクトと各画面の表示を検証するスモークテスト
//   npm run build && npm run smoke
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@libsql/client";

const PORT = 3998;
const BASE = `http://localhost:${PORT}`;
const DB_FILE = "./data/smoke.db";
for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) fs.rmSync(f, { force: true });

const server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
  env: { ...process.env, DATABASE_URL: `file:${DB_FILE}`, ANTHROPIC_API_KEY: "", BASE_URL: BASE, ADMIN_PASSWORD: "x", SESSION_SECRET: "y" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cookie = `admin_session=${crypto.createHmac("sha256", "y").update("admin:x").digest("base64url")}`;
const page = async (path) => {
  const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
  assert.equal(res.status, 200, `${path} -> ${res.status}`);
  return res.text();
};

try {
  for (let i = 0; i < 60; i++) {
    try { await fetch(`${BASE}/login`); break; } catch { await sleep(500); }
  }
  // 未ログインはログイン画面へ
  const anon = await fetch(`${BASE}/`, { redirect: "manual" });
  assert.ok([307, 302, 303].includes(anon.status) || (await anon.text()).includes("login"), "未ログインで弾かれる");

  await page("/"); // スキーマ作成
  const db = createClient({ url: `file:${DB_FILE}` });
  const now = Date.now();
  await db.execute({
    sql: "INSERT INTO programs (name, asp, reward_type, reward, avg_price, approval_rate, est_cvr, status, url, created_at) VALUES ('テストプロテイン','A8.net','rate',10,5000,90,2,'active','https://example.com/aff',?)",
    args: [now],
  });
  await db.execute({ sql: "INSERT INTO links (code, program_id, name, url, channel, created_at) VALUES ('t1', 1, 'テストリンク', 'https://example.com/aff', 'tiktok', ?)", args: [now] });

  // 計測リダイレクト
  const r = await fetch(`${BASE}/go/t1?ch=instagram`, { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "https://example.com/aff");
  await fetch(`${BASE}/go/t1`, { redirect: "manual" });
  await fetch(`${BASE}/go/t1`, { redirect: "manual", headers: { "user-agent": "Twitterbot/1.0" } });
  assert.equal((await fetch(`${BASE}/go/nope`, { redirect: "manual" })).status, 404);
  const clicks = (await db.execute("SELECT channel FROM clicks ORDER BY id")).rows.map((x) => x.channel);
  assert.deepEqual(clicks, ["instagram", "tiktok"], "媒体別に記録・botは除外");

  await db.execute({ sql: "INSERT INTO conversions (program_id, link_id, occurred_at, amount, status, created_at) VALUES (1, 1, ?, 500, 'approved', ?)", args: [now, now] });

  const dash = await page("/");
  assert.ok(dash.includes("テストプロテイン") && dash.includes("¥500"), "ダッシュボードに実績が出る");
  const programs = await page("/programs");
  assert.ok(programs.includes("¥500") /* 1件報酬 = 5000×10% */, "定率の報酬計算");
  for (const p of ["/links", "/conversions", "/content", "/guide", "/settings"]) await page(p);
  const guide = await page("/guide");
  assert.ok(guide.includes("進捗"), "ガイド表示");
  console.log("smoke OK");
} catch (e) {
  console.error(log.slice(-3000));
  throw e;
} finally {
  server.kill();
}
