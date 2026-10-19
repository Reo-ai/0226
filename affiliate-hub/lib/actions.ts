"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, COMPLIANCE_RULES, generate } from "./ai";
import { checkPassword, clearSession, requireAuth, setSession } from "./auth";
import { normalizeStatus, parseAmount, parseCsv } from "./csv";
import { all, batch, get, run, setSetting } from "./db";
import { baseUrl } from "./env";
import { jstMonthStart, parseJstDate, yen } from "./format";
import { PLATFORM_LABEL, POST_KINDS, PROGRAM_STATUS, unitReward, VIDEO_SERVICES, VIDEO_THEMES } from "./score";
import { linkStats, programStats } from "./stats";
import type { Link, Program } from "./types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string) => Number(fd.get(k) ?? 0) || 0;
const optId = (fd: FormData, k: string) => num(fd, k) || null;
const enc = encodeURIComponent;

// ---- auth ----
export async function login(_: string | null, fd: FormData): Promise<string | null> {
  if (!checkPassword(str(fd, "password"))) return "パスワードが違います（または環境変数が未設定です）";
  await setSession();
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

// ---- programs ----
export async function createProgram(fd: FormData) {
  await requireAuth();
  const name = str(fd, "name");
  if (!name) return;
  await run(
    `INSERT INTO programs (name, asp, category, url, reward_type, reward, avg_price, approval_rate, est_cvr, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name,
    str(fd, "asp"),
    str(fd, "category"),
    str(fd, "url"),
    str(fd, "reward_type") === "rate" ? "rate" : "fixed",
    num(fd, "reward"),
    num(fd, "avg_price"),
    Math.min(100, num(fd, "approval_rate")),
    Math.min(100, num(fd, "est_cvr")),
    str(fd, "status") in PROGRAM_STATUS ? str(fd, "status") : "candidate",
    str(fd, "notes"),
    Date.now(),
  );
  revalidatePath("/programs");
}

export async function setProgramStatus(fd: FormData) {
  await requireAuth();
  const status = str(fd, "status");
  if (!(status in PROGRAM_STATUS)) return;
  await run("UPDATE programs SET status = ? WHERE id = ?", status, num(fd, "id"));
  revalidatePath("/programs");
}

export async function deleteProgram(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM programs WHERE id = ?", args: [id] },
    { sql: "UPDATE links SET program_id = NULL WHERE program_id = ?", args: [id] },
  ]);
  revalidatePath("/programs");
}

export async function runResearch(fd: FormData) {
  await requireAuth();
  const programs = await programStats(jstMonthStart() - 60 * 86_400_000);
  const links = await linkStats(jstMonthStart() - 60 * 86_400_000);
  const goal = str(fd, "goal");
  const table = programs
    .map(
      (p) =>
        `- ${p.name}｜ASP:${p.asp || "-"}｜ジャンル:${p.category || "-"}｜状態:${PROGRAM_STATUS[p.status]}｜1件報酬:${yen(unitReward(p))}｜承認率:${p.approval_rate}%｜想定CVR:${p.est_cvr}%｜想定EPC:${yen(p.expEpc)}｜直近クリック:${p.clicks}｜成果:${p.cv}件 ${yen(p.earned)}｜実績込みEPC:${yen(p.epc)}${p.notes ? `｜メモ:${p.notes}` : ""}`,
    )
    .join("\n");
  const linkTable = links
    .filter((l) => l.clicks > 0)
    .slice(0, 20)
    .map((l) => `- ${l.name}（${l.channel || "未指定"}／${l.program_name ?? "案件なし"}）: ${l.clicks}クリック, ${l.cv}件, ${yen(l.earned)}`)
    .join("\n");

  const prompt = `以下は私のアフィリエイト案件リストと直近約2ヶ月の実績です。

# 案件
${table || "（まだ登録なし）"}

# リンク別実績
${linkTable || "（まだクリックなし）"}

${goal ? `# 今の目標・悩み\n${goal}\n` : ""}
次の構成で、具体的に提案してください。
1. **今集中すべき案件TOP3** と理由（EPC・承認率・発信のしやすさの観点）
2. **止める/後回しにする案件** と理由
3. **追加で探すべき案件ジャンル** を3つ（ASPで検索するキーワード例つき）
4. **TOP3それぞれの発信の切り口** を3つずつ（どの媒体で・誰の・どんな悩みに刺すか）
5. **今週やることリスト**（5項目以内）

データが少ない場合は一般的な相場観（ジャンル別の報酬・承認率の傾向）で補い、そう明記してください。`;

  let result: string;
  try {
    result = await generate(
      "research",
      "あなたは日本のアフィリエイト（ASP案件・SNS集客）に精通した戦略コンサルタントです。数字に基づき、初心者にも実行できる具体的な提案をします。",
      prompt,
    );
  } catch (e) {
    if (e instanceof AiError) redirect(`/programs?error=${enc(e.message)}`);
    throw e;
  }
  await setSetting("research_last", JSON.stringify({ at: Date.now(), text: result }));
  redirect("/programs#research");
}

// ---- links ----
export async function createLink(fd: FormData) {
  await requireAuth();
  const url = str(fd, "url");
  const programId = optId(fd, "program_id");
  const program = programId ? await get<Program>("SELECT * FROM programs WHERE id = ?", programId) : undefined;
  const target = url || program?.url || "";
  if (!/^https?:\/\//.test(target)) redirect(`/links?error=${enc("リンク先URL（https://〜）を入力してください")}`);
  const code = (str(fd, "code") || crypto.randomBytes(4).toString("base64url")).replace(/[^A-Za-z0-9_-]/g, "");
  if (await get("SELECT 1 FROM links WHERE code = ?", code)) {
    redirect(`/links?error=${enc(`コード「${code}」は使用中です`)}`);
  }
  await run(
    "INSERT INTO links (code, program_id, name, url, channel, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    code,
    programId,
    str(fd, "name") || program?.name || code,
    target,
    str(fd, "channel"),
    Date.now(),
  );
  revalidatePath("/links");
}

export async function deleteLink(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  await batch([
    { sql: "DELETE FROM links WHERE id = ?", args: [id] },
    { sql: "DELETE FROM clicks WHERE link_id = ?", args: [id] },
  ]);
  revalidatePath("/links");
}

// ---- conversions ----
export async function createConversion(fd: FormData) {
  await requireAuth();
  const at = parseJstDate(str(fd, "date"));
  const count = Math.max(1, Math.min(100, num(fd, "count") || 1));
  const linkId = optId(fd, "link_id");
  let programId = optId(fd, "program_id");
  if (!programId && linkId) programId = (await get<Link>("SELECT * FROM links WHERE id = ?", linkId))?.program_id ?? null;
  if (Number.isNaN(at) || !programId) redirect(`/conversions?error=${enc("日付と案件を指定してください")}`);
  const status = str(fd, "status");
  const stmt = {
    sql: "INSERT INTO conversions (program_id, link_id, occurred_at, amount, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [programId, linkId, at, num(fd, "amount"), ["approved", "rejected"].includes(status) ? status : "pending", str(fd, "note"), Date.now()],
  };
  await batch(Array.from({ length: count }, () => stmt));
  revalidatePath("/conversions");
}

/** ASP管理画面からコピーした表を取り込む: 日付, 案件名 or リンクコード, 報酬, ステータス */
export async function importConversions(fd: FormData) {
  await requireAuth();
  const rows = parseCsv(str(fd, "csv"));
  const programs = await all<Program>("SELECT * FROM programs");
  const links = await all<Link>("SELECT * FROM links");
  const stmts = [];
  const skipped: string[] = [];
  for (const [i, r] of rows.entries()) {
    const [date, key, amountStr, statusStr = ""] = r;
    const at = parseJstDate(date ?? "");
    const amount = parseAmount(amountStr ?? "");
    if (Number.isNaN(at)) {
      if (i > 0) skipped.push(`${i + 1}行目: 日付が読めません`); // 1行目はヘッダーとみなして無視
      continue;
    }
    const link = links.find((l) => l.code === key);
    const program =
      (link?.program_id && programs.find((p) => p.id === link.program_id)) ||
      programs.find((p) => p.name === key) ||
      programs.find((p) => key && (p.name.includes(key) || key.includes(p.name)));
    if (!program || Number.isNaN(amount)) {
      skipped.push(`${i + 1}行目: ${!program ? `案件「${key}」が見つかりません` : "報酬が読めません"}`);
      continue;
    }
    stmts.push({
      sql: "INSERT INTO conversions (program_id, link_id, occurred_at, amount, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [program.id, link?.id ?? null, at, amount, normalizeStatus(statusStr), "CSV取込", Date.now()],
    });
  }
  await batch(stmts);
  const msg = `${stmts.length}件取り込みました` + (skipped.length ? `／スキップ: ${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? " ほか" : ""}` : "");
  redirect(`/conversions?notice=${enc(msg)}`);
}

export async function setConversionStatus(fd: FormData) {
  await requireAuth();
  const status = str(fd, "status");
  if (!["pending", "approved", "rejected"].includes(status)) return;
  await run("UPDATE conversions SET status = ? WHERE id = ?", status, num(fd, "id"));
  revalidatePath("/conversions");
}

export async function deleteConversion(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM conversions WHERE id = ?", num(fd, "id"));
  revalidatePath("/conversions");
}

// ---- content ----
const PLATFORM_FORMAT: Record<string, string> = {
  tiktok: "TikTok動画。①冒頭2秒のフック（テロップ文）②15〜40秒の台本（シーンごとに「映像」「テロップ」「ナレーション」）③キャプション（150字以内）④ハッシュタグ5個 ⑤固定コメント案（リンクはプロフィールへ誘導）",
  instagram: "Instagramリール＋カルーセル。①リールのフック ②30秒台本 ③カルーセル7枚の各スライド文言 ④キャプション（保存したくなるまとめ＋プロフィールリンクへの誘導）⑤ハッシュタグ10個",
  x: "X（旧Twitter）。①メインポスト（140字以内、リンクは含めない）②スレッドの続き3〜5ポスト ③最後のポストにリンク",
  youtube: "YouTubeショート。①タイトル（30字以内）②冒頭フック ③40秒台本（映像・テロップ・ナレーション）④概要欄（リンク付き）",
  blog: "ブログ記事。①SEOタイトル案3つ ②狙うキーワード ③見出し構成（H2/H3）④導入文 ⑤各見出しの要点 ⑥CTA文（リンク付き）",
  line: "LINE配信。①吹き出し1（共感）②吹き出し2（解決策の提示）③吹き出し3（リンク付きCTA）。各200字以内",
};

export async function generatePost(fd: FormData) {
  await requireAuth();
  const program = await get<Program>("SELECT * FROM programs WHERE id = ?", num(fd, "program_id"));
  if (!program) redirect(`/content?error=${enc("案件を選んでください")}`);
  const platform = str(fd, "platform");
  const kind = str(fd, "kind");
  if (!(platform in PLATFORM_FORMAT)) redirect(`/content?error=${enc("媒体を選んでください")}`);

  // 案件に計測リンクがなければ自動で作る
  let link = await get<Link>("SELECT * FROM links WHERE program_id = ? ORDER BY id LIMIT 1", program.id);
  if (!link && /^https?:\/\//.test(program.url)) {
    const code = crypto.randomBytes(4).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "x");
    const { lastId } = await run(
      "INSERT INTO links (code, program_id, name, url, channel, created_at) VALUES (?, ?, ?, ?, '', ?)",
      code,
      program.id,
      program.name,
      program.url,
      Date.now(),
    );
    link = await get<Link>("SELECT * FROM links WHERE id = ?", lastId);
  }
  const linkUrl = link ? `${baseUrl()}/go/${link.code}?ch=${platform}` : "（リンク未設定）";
  const kindLabel = POST_KINDS.find(([k]) => k === kind)?.[1] ?? "おまかせ";

  const prompt = `次の案件を紹介する投稿を作ってください。

# 案件
- 商品/サービス: ${program.name}
- ジャンル: ${program.category || "-"}
- 1件報酬: ${yen(unitReward(program))}
- メモ（特徴・ターゲットなど）: ${program.notes || "-"}
- 紹介リンク: ${linkUrl}

# 形式
媒体: ${PLATFORM_LABEL[platform]}
型: ${kindLabel}
${PLATFORM_FORMAT[platform]}

${str(fd, "extra") ? `# 追加の指示\n${str(fd, "extra")}\n` : ""}
売り込み感を抑え、読者の悩み→解決のきっかけとして自然に紹介してください。見出しは【】で区切り、Markdown記法（#, ** など）は使わないでください。`;

  let body: string;
  try {
    body = await generate(
      "content",
      `あなたはSNSで成果を出しているアフィリエイターの専属コピーライターです。日本の視聴者に刺さる、自然で具体的な投稿を書きます。\n\n${COMPLIANCE_RULES}`,
      prompt,
    );
  } catch (e) {
    if (e instanceof AiError) redirect(`/content?error=${enc(e.message)}`);
    throw e;
  }
  const { lastId } = await run(
    "INSERT INTO posts (program_id, link_id, platform, kind, body, status, created_at) VALUES (?, ?, ?, ?, ?, 'draft', ?)",
    program.id,
    link?.id ?? null,
    platform,
    kind,
    body,
    Date.now(),
  );
  redirect(`/content?id=${lastId}`);
}

export async function updatePost(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  const posted = str(fd, "status") === "posted";
  await run(
    "UPDATE posts SET body = ?, status = ?, posted_at = CASE WHEN ? THEN COALESCE(posted_at, ?) ELSE NULL END WHERE id = ?",
    str(fd, "body"),
    posted ? "posted" : "draft",
    posted ? 1 : 0,
    Date.now(),
    id,
  );
  redirect(`/content?id=${id}`);
}

export async function deletePost(fd: FormData) {
  await requireAuth();
  await run("DELETE FROM posts WHERE id = ?", num(fd, "id"));
  redirect("/content");
}

/** 投稿を動画パイプライン（npm start -- hub-sync）の待ち行列に入れる／取り消す */
export async function queueVideo(fd: FormData) {
  await requireAuth();
  const id = num(fd, "id");
  if (str(fd, "cancel") === "1") {
    await run("UPDATE posts SET video_status = '', video_updated_at = ? WHERE id = ? AND video_status = 'queued'", Date.now(), id);
    redirect(`/content?id=${id}`);
  }
  const theme = str(fd, "theme");
  const service = str(fd, "service");
  if (!VIDEO_THEMES.some(([k]) => k === theme) || !VIDEO_SERVICES.some(([k]) => k === service)) {
    redirect(`/content?id=${id}&error=${enc("テーマと動画サービスを選んでください")}`);
  }
  await run(
    "UPDATE posts SET video_status = 'queued', video_theme = ?, video_service = ?, video_result = '', video_updated_at = ? WHERE id = ?",
    theme,
    service,
    Date.now(),
    id,
  );
  redirect(`/content?id=${id}`);
}

// ---- guide ----
export async function toggleGuide(fd: FormData) {
  await requireAuth();
  const id = str(fd, "step");
  if (str(fd, "done") === "1") {
    await run("INSERT OR IGNORE INTO guide_progress (step_id, done_at) VALUES (?, ?)", id, Date.now());
  } else {
    await run("DELETE FROM guide_progress WHERE step_id = ?", id);
  }
  revalidatePath("/guide");
  revalidatePath("/");
}

// ---- settings ----
export async function saveSettings(fd: FormData) {
  await requireAuth();
  await setSetting("ai_model", str(fd, "ai_model"));
  await setSetting("ai_monthly_limit", String(Math.max(0, num(fd, "ai_monthly_limit"))));
  await setSetting("profile", str(fd, "profile"));
  redirect("/settings?notice=" + enc("保存しました"));
}
