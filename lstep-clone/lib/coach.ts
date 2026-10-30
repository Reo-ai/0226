// 生徒管理ツール：質問と回答・応募案件・月の収入を、生徒（LINEの友だち）ごとに蓄積する
// - 質問は「質問フォームの回答」と「自動で返せなかったLINEのメッセージ」から自動で集める
// - LINEへの返信はまだ行わない（回答は記録として残す）
import { all, get, run } from "./db";
import { jstDateKey } from "./format";

export type QuestionStatus = "open" | "answered" | "resolved" | "hidden";
export type JobStatus = "applied" | "interview" | "won" | "lost";

export const QUESTION_STATUS: Record<QuestionStatus, string> = {
  open: "未回答",
  answered: "回答済み",
  resolved: "解決済み",
  hidden: "質問ではない",
};
export const JOB_STATUS: Record<JobStatus, string> = {
  applied: "応募済み",
  interview: "面談",
  won: "受注",
  lost: "見送り",
};
export const QUESTS = ["QUEST 1 スキル診断", "QUEST 2 プロフィール", "QUEST 3 案件探し", "QUEST 4 応募文", "QUEST 5 やり取り", "その他"];

export interface Question {
  id: number;
  friend_id: number | null;
  source: string;
  body: string;
  answer: string;
  status: QuestionStatus;
  quest: string;
  created_at: number;
  answered_at: number | null;
  display_name?: string | null;
  picture_url?: string | null;
}
export interface Job {
  id: number;
  friend_id: number;
  title: string;
  site: string;
  url: string;
  status: JobStatus;
  applied_on: string;
}
export interface Earning {
  id: number;
  friend_id: number;
  month: string;
  amount: number;
  note: string;
}
export interface StudentRow {
  id: number;
  display_name: string | null;
  picture_url: string | null;
  open_count: number;
  question_count: number;
  job_count: number;
  won_count: number;
  month_applies: number;
  month_income: number;
}

export const monthKey = (ms = Date.now()) => jstDateKey(ms).slice(0, 7);

/** 自動で返せなかったLINEのメッセージを質問として残す（webhook から呼ぶ。失敗しても返信の処理は止めない） */
export async function captureLineQuestion(friendId: number, text: string) {
  try {
    const m = await get<{ id: number; created_at: number }>(
      "SELECT id, created_at FROM messages WHERE friend_id = ? AND direction = 'in' ORDER BY id DESC LIMIT 1",
      friendId,
    );
    if (!m) return;
    await run(
      "INSERT OR IGNORE INTO coach_questions (friend_id, source, ref_id, body, created_at) VALUES (?, 'line', ?, ?, ?)",
      friendId,
      m.id,
      text,
      m.created_at,
    );
  } catch (e) {
    console.error("質問の記録に失敗", e);
  }
}

/** 質問フォームの回答を取り込む（題名に「質問」が入るフォーム。何度呼んでも重複しない） */
export async function syncFormQuestions() {
  const rows = await all<{ id: number; friend_id: number | null; answers: string; created_at: number }>(
    `SELECT r.id, r.friend_id, r.answers, r.created_at FROM form_responses r
     JOIN forms f ON f.id = r.form_id
     WHERE f.title LIKE '%質問%'
       AND NOT EXISTS (SELECT 1 FROM coach_questions q WHERE q.source = 'form' AND q.ref_id = r.id)`,
  );
  for (const r of rows) {
    let body = r.answers;
    try {
      body = Object.entries(JSON.parse(r.answers) as Record<string, string>)
        .filter(([, v]) => v)
        .map(([k, v]) => `【${k}】${v}`)
        .join("\n");
    } catch {
      // 読めない時はそのまま残す
    }
    await run(
      "INSERT OR IGNORE INTO coach_questions (friend_id, source, ref_id, body, created_at) VALUES (?, 'form', ?, ?, ?)",
      r.friend_id,
      r.id,
      body,
      r.created_at,
    );
  }
}

/** 全体の数字（今月） */
export async function overview() {
  const month = monthKey();
  const [q, s, a, j, e] = await Promise.all([
    get<{ n: number }>("SELECT COUNT(*) n FROM coach_questions WHERE status = 'open'"),
    get<{ n: number }>("SELECT COUNT(*) n FROM friends WHERE blocked = 0"),
    get<{ n: number }>("SELECT COALESCE(SUM(count), 0) n FROM apply_logs WHERE date LIKE ?", `${month}%`),
    get<{ n: number }>("SELECT COUNT(*) n FROM coach_jobs WHERE status = 'won'"),
    get<{ n: number }>("SELECT COALESCE(SUM(amount), 0) n FROM coach_earnings WHERE month = ?", month),
  ]);
  return { open: q?.n ?? 0, students: s?.n ?? 0, applies: a?.n ?? 0, won: j?.n ?? 0, income: e?.n ?? 0 };
}

/** 質問の一覧。status 省略なら「質問ではない」以外。q は質問と回答の本文で探す */
export async function listQuestions(opts: { status?: string; q?: string; quest?: string; friendId?: number }) {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status && opts.status in QUESTION_STATUS) {
    where.push("q.status = ?");
    args.push(opts.status);
  } else {
    where.push("q.status != 'hidden'");
  }
  if (opts.q) {
    where.push("(q.body LIKE ? OR q.answer LIKE ?)");
    args.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.quest) {
    where.push("q.quest = ?");
    args.push(opts.quest);
  }
  if (opts.friendId) {
    where.push("q.friend_id = ?");
    args.push(opts.friendId);
  }
  return all<Question>(
    `SELECT q.*, f.display_name, f.picture_url FROM coach_questions q LEFT JOIN friends f ON f.id = q.friend_id
     WHERE ${where.join(" AND ")} ORDER BY q.created_at DESC LIMIT 200`,
    ...args,
  );
}

/** 生徒の一覧（未回答が多い順 → 最近動いた順） */
export async function listStudents(search?: string): Promise<StudentRow[]> {
  const month = monthKey();
  return all<StudentRow>(
    `SELECT f.id, f.display_name, f.picture_url,
       (SELECT COUNT(*) FROM coach_questions q WHERE q.friend_id = f.id AND q.status = 'open') open_count,
       (SELECT COUNT(*) FROM coach_questions q WHERE q.friend_id = f.id AND q.status != 'hidden') question_count,
       (SELECT COUNT(*) FROM coach_jobs j WHERE j.friend_id = f.id) job_count,
       (SELECT COUNT(*) FROM coach_jobs j WHERE j.friend_id = f.id AND j.status = 'won') won_count,
       (SELECT COALESCE(SUM(a.count), 0) FROM apply_logs a WHERE a.friend_id = f.id AND a.date LIKE ?) month_applies,
       (SELECT COALESCE(SUM(e.amount), 0) FROM coach_earnings e WHERE e.friend_id = f.id AND e.month = ?) month_income
     FROM friends f WHERE f.blocked = 0 ${search ? "AND f.display_name LIKE ?" : ""}
     ORDER BY open_count DESC, f.last_message_at DESC LIMIT 300`,
    ...(search ? [`${month}%`, month, `%${search}%`] : [`${month}%`, month]),
  );
}

export async function studentDetail(friendId: number) {
  const [jobs, earnings, applies] = await Promise.all([
    all<Job>("SELECT * FROM coach_jobs WHERE friend_id = ? ORDER BY applied_on DESC, id DESC", friendId),
    all<Earning>("SELECT * FROM coach_earnings WHERE friend_id = ? ORDER BY month DESC, id DESC", friendId),
    all<{ month: string; n: number }>(
      "SELECT substr(date, 1, 7) month, SUM(count) n FROM apply_logs WHERE friend_id = ? GROUP BY month ORDER BY month DESC LIMIT 12",
      friendId,
    ),
  ]);
  return { jobs, earnings, applies };
}
