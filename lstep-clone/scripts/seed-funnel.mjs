// 導線の設定ファイル（funnels/*/funnel.mjs）を DB に一括投入する
//   node scripts/seed-funnel.mjs funnels/claude-code-course/funnel.mjs [--replace] [--dry-run]
//
// - 接続先は アプリと同じ DATABASE_URL / DATABASE_AUTH_TOKEN（未設定なら file:./data/app.db）
// - テーブル作成はアプリ側で行うため、先に一度アプリを起動しておくこと
// - 同名のタグ・リンク・経路・フォーム・キーワード・シナリオは上書きせずスキップ
//   （--replace を付けると、シナリオとステップを作り直し、既存のキーワード応答・フォーム・計測リンクの中身も更新する。進行中の配信状況はリセットされる）
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
// --text-only：シナリオは作り直さず、ステップの文面だけを差し替える（配信中の人の進み具合を保つ）。
//              キーワード応答・フォーム・計測リンクの中身は --replace と同じく更新する
const TEXT_ONLY = args.includes("--text-only");
const REPLACE = args.includes("--replace") || TEXT_ONLY;
const DRY = args.includes("--dry-run");
if (!file) {
  console.error("使い方: node scripts/seed-funnel.mjs <funnel.mjs> [--replace | --text-only] [--dry-run]");
  process.exit(1);
}

const funnel = await import(pathToFileURL(path.resolve(file)).href);
const { tags = [], links = [], sources = [], forms = [], autoReplies = [], scenarios = [], CONFIG = {} } = funnel;

// ---- 事前チェック（管理画面と同じルール） ----
const MAX_BUBBLES = 5;
const problems = [];
const warnings = [];
const formKeys = new Set(forms.map((f) => f.key));
const linkCodes = new Set(links.map((l) => l.code));
const tagNames = new Set(tags.map((t) => t.name));

function checkContent(where, content) {
  const blocks = content.split(/^\s*---\s*$/m).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) problems.push(`${where}: 本文が空です`);
  if (blocks.length > MAX_BUBBLES) problems.push(`${where}: 吹き出しが${blocks.length}個（最大${MAX_BUBBLES}）`);
  for (const b of blocks) if (b.length > 5000) problems.push(`${where}: 吹き出しが5000文字を超えています`);
  for (const [, key] of content.matchAll(/\{\{\s*form:@([\w-]+)\s*\}\}/g)) {
    if (!formKeys.has(key)) problems.push(`${where}: 未定義のフォーム @${key}`);
  }
  for (const [, code] of content.matchAll(/\{\{\s*link:([\w-]+)\s*\}\}/g)) {
    if (!linkCodes.has(code)) problems.push(`${where}: 未定義のリンク ${code}`);
  }
}
const checkTag = (where, name) => name && !tagNames.has(name) && problems.push(`${where}: 未定義のタグ「${name}」`);

for (const l of links) checkTag(`リンク ${l.code}`, l.tag);
for (const s of sources) checkTag(`流入経路 ${s.code}`, s.tag);
for (const f of forms) checkTag(`フォーム ${f.key}`, f.tag);
for (const r of autoReplies) {
  checkTag(`キーワード「${r.keyword}」`, r.tag);
  checkContent(`キーワード「${r.keyword}」`, r.reply);
}
for (const sc of scenarios) {
  checkTag(`シナリオ「${sc.name}」`, sc.triggerTag);
  checkTag(`シナリオ「${sc.name}」`, sc.stopTag);
  if (sc.trigger === "tag" && !sc.triggerTag) problems.push(`シナリオ「${sc.name}」: 開始タグがありません`);
  const kinds = new Set(sc.steps.map((st) => (st.at ? "at" : "after")));
  if (kinds.size > 1 && sc.steps.some((st) => st.after > 0)) {
    warnings.push(`シナリオ「${sc.name}」: 時刻指定と経過時間指定（0以外）が混在しています。配信順が前後しないか確認してください`);
  }
  sc.steps.forEach((st, i) => checkContent(`シナリオ「${sc.name}」#${i + 1}`, st.content));
}
const unset = JSON.stringify(CONFIG).match(/要設定[^"]*/g) ?? [];
for (const u of unset) warnings.push(`CONFIG: ${u}`);

for (const w of warnings) console.warn(`⚠ ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}

const stepMinutes = (st) => (st.at ? st.at[0] * 1440 + st.at[1] * 60 + (st.at[2] ?? 0) : st.after ?? 0);
const summary = {
  tags: tags.length,
  links: links.length,
  sources: sources.length,
  forms: forms.length,
  autoReplies: autoReplies.length,
  scenarios: scenarios.map((s) => `${s.name}（${s.steps.length}ステップ）`),
};
if (DRY) {
  console.log("チェックOK（--dry-run のため投入していません）");
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

// ---- 投入 ----
const url = process.env.DATABASE_URL || "file:./data/app.db";
if (url.startsWith("file:") && !fs.existsSync(url.slice(5))) {
  console.error(`DBが見つかりません（${url}）。先に一度アプリを起動してテーブルを作成してください。`);
  process.exit(1);
}
const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
const q = async (sql, ...a) => (await db.execute({ sql, args: a })).rows;
const one = async (sql, ...a) => (await q(sql, ...a))[0];
const cols = (await q("PRAGMA table_info(scenario_steps)")).map((r) => r.name);
if (!cols.includes("fixed_time")) {
  console.error("DBが古い形式です。最新版のアプリを一度起動してから実行してください。");
  process.exit(1);
}

const now = Date.now();
// --replace では、タグ・流入経路以外の既存項目は中身を更新している
const log = (kind, name, created) => {
  const updated = REPLACE && !["タグ", "流入経路"].includes(kind);
  console.log(`${created ? "＋" : updated ? "↻" : "・"} ${kind}: ${name}${created ? "" : updated ? "（更新）" : "（既存のためスキップ）"}`);
};

for (const t of tags) {
  const r = await db.execute({ sql: "INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)", args: [t.name, t.color ?? "#06c755"] });
  log("タグ", t.name, r.rowsAffected > 0);
}
const tagId = new Map((await q("SELECT id, name FROM tags")).map((r) => [r.name, Number(r.id)]));
const tid = (name) => (name ? tagId.get(name) ?? null : null);

for (const l of links) {
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO links (code, name, url, add_tag_id, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [l.code, l.name, l.url, tid(l.tag), now],
  });
  if (r.rowsAffected === 0 && REPLACE) await q("UPDATE links SET name = ?, url = ?, add_tag_id = ? WHERE code = ?", l.name, l.url, tid(l.tag), l.code);
  log("計測リンク", `${l.code}（${l.name}）`, r.rowsAffected > 0);
}

for (const s of sources) {
  const r = await db.execute({
    sql: "INSERT OR IGNORE INTO sources (code, name, add_tag_id, created_at) VALUES (?, ?, ?, ?)",
    args: [s.code, s.name, tid(s.tag), now],
  });
  log("流入経路", `${s.code}（${s.name}）`, r.rowsAffected > 0);
}

const formId = new Map();
for (const f of forms) {
  const existing = await one("SELECT id FROM forms WHERE title = ?", f.title);
  const fields = f.fields.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const [label, type = "text", options = "", req = ""] = line.split("|").map((x) => x.trim());
    return { label, type, options: options ? options.split(",").map((o) => o.trim()) : [], required: req === "必須" };
  });
  if (existing) {
    formId.set(f.key, Number(existing.id));
    if (REPLACE) {
      await q(
        "UPDATE forms SET description = ?, fields = ?, add_tag_id = ?, thanks_message = ? WHERE id = ?",
        f.description ?? "", JSON.stringify(fields), tid(f.tag), f.thanks ?? "", existing.id,
      );
    }
    log("フォーム", f.title, false);
    continue;
  }
  const r = await db.execute({
    sql: "INSERT INTO forms (title, description, fields, add_tag_id, thanks_message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [f.title, f.description ?? "", JSON.stringify(fields), tid(f.tag), f.thanks ?? "", now],
  });
  formId.set(f.key, Number(r.lastInsertRowid));
  log("フォーム", f.title, true);
}
const resolve = (content) => content.replace(/\{\{\s*form:@([\w-]+)\s*\}\}/g, (_, key) => `{{form:${formId.get(key)}}}`);

for (const r of autoReplies) {
  const existing = await one("SELECT id FROM auto_replies WHERE keyword = ? AND match_type = ?", r.keyword, r.match);
  if (!existing) {
    await q(
      "INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES (?, ?, ?, ?)",
      r.keyword,
      r.match,
      resolve(r.reply),
      tid(r.tag),
    );
  } else if (REPLACE) {
    await q("UPDATE auto_replies SET reply = ?, add_tag_id = ? WHERE id = ?", resolve(r.reply), tid(r.tag), existing.id);
  }
  log("キーワード", `${r.keyword}（${r.match === "exact" ? "完全一致" : "部分一致"}）`, !existing);
}

for (const sc of scenarios) {
  const existing = await one("SELECT id FROM scenarios WHERE name = ?", sc.name);
  if (existing && TEXT_ONLY) {
    const steps = await q("SELECT id FROM scenario_steps WHERE scenario_id = ? ORDER BY id", existing.id);
    if (steps.length !== sc.steps.length) {
      console.error(`✖ シナリオ: ${sc.name} はステップ数が変わっています（今 ${steps.length} → 新 ${sc.steps.length}）。--replace で作り直してください`);
      continue;
    }
    await db.batch(
      sc.steps.map((st, i) => ({ sql: "UPDATE scenario_steps SET content = ? WHERE id = ?", args: [resolve(st.content), steps[i].id] })),
      "write",
    );
    console.log(`↻ シナリオ: ${sc.name}（${sc.steps.length}ステップの文面を更新・進み具合はそのまま）`);
    continue;
  }
  if (existing && !REPLACE) {
    log("シナリオ", sc.name, false);
    continue;
  }
  const stmts = [];
  if (existing) {
    for (const t of ["enrollments", "scenario_steps"]) stmts.push({ sql: `DELETE FROM ${t} WHERE scenario_id = ?`, args: [existing.id] });
    stmts.push({ sql: "DELETE FROM scenarios WHERE id = ?", args: [existing.id] });
  }
  await db.batch(stmts, "write");
  const r = await db.execute({
    sql: "INSERT INTO scenarios (name, trigger, trigger_tag_id, stop_tag_id, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [sc.name, sc.trigger, sc.trigger === "tag" ? tid(sc.triggerTag) : null, tid(sc.stopTag), now],
  });
  const id = Number(r.lastInsertRowid);
  await db.batch(
    sc.steps.map((st) => ({
      sql: "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, fixed_time, content) VALUES (?, ?, ?, ?, ?)",
      args: [id, stepMinutes(st), st.reply ? "reply" : "push", st.at ? 1 : 0, resolve(st.content)],
    })),
    "write",
  );
  console.log(`＋ シナリオ: ${sc.name}（${sc.steps.length}ステップ）${existing ? " ※作り直し" : ""}`);
}

console.log("\n投入完了。管理画面の「ステップ配信」「キーワード応答」などで内容を確認してください。");
