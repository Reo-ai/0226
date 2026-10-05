// 止まっている人への声かけ（講座の購入者と、習慣トラッカーを使っている人）
//   毎晩20時台に判定し、その日に何も進めていない人へ1通送る（毎日。文面は止まった日数に応じて日替わり）。
//   進めた＝メッセージ・リンク・フォーム・習慣の「できた」・章クリア・講座サイトの済ミッションが前より増えた。進めた日は送らず、日数も数え直す。
//   習慣だけ使っていて毎日のリマインドを設定している人には送らない（二重送信を避ける）。
//   章クリアは、LINEで「第3章クリア」と送る報告と、講座サイトからの進捗通知（/api/progress）の両方で記録する
import { all, get, run } from "./db";
import { pushToFriend } from "./delivery";
import { jstDateKey, jstDayStart } from "./format";
import { QuotaError } from "./quota";
import type { Outbox } from "./delivery";
import type { Friend } from "./types";

const DAY = 86400_000;
/** 送る時間帯（日本時間）。毎日この時間に1回だけ判定する */
const SEND_HOURS = [20];
const PURCHASE_TAG = process.env.PURCHASE_TAG_NAME || "購入済み";

const jstHour = (ms: number) => new Date(ms + 9 * 3600_000).getUTCHours();

/** 講座サイトの済ミッション数を記録する。前より増えた時だけ「進めた」として時刻を更新し true */
export async function recordMissions(friendId: number, course: string, quest: number, done: number) {
  const r = await run(
    `INSERT INTO mission_progress (friend_id, course, quest, done, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(friend_id, course, quest) DO UPDATE SET done = excluded.done, updated_at = excluded.updated_at
     WHERE excluded.done > mission_progress.done`,
    friendId,
    course,
    quest,
    done,
    Date.now(),
  );
  return r.changes > 0;
}

/** 章クリアを記録する（同じ章は1回だけ）。新しく記録できたら true */
export async function recordChapter(friendId: number, chapter: number, source: "report" | "site", course = "") {
  const r = await run(
    "INSERT OR IGNORE INTO course_progress (friend_id, course, chapter, source, created_at) VALUES (?, ?, ?, ?, ?)",
    friendId,
    course,
    chapter,
    source,
    Date.now(),
  );
  return r.changes > 0;
}

const CHAPTER_RE = /^第?\s*(\d{1,2})\s*章\s*(?:を)?\s*(?:クリア|完了|終わった|おわった|できた|達成)/;

/** 「第3章クリア」などの報告。章クリアとして記録して称える。扱ったら true */
export async function handleChapterReport(box: Outbox, friend: Friend, raw: string): Promise<boolean> {
  const m = raw.normalize("NFKC").trim().match(CHAPTER_RE);
  if (!m) return false;
  const chapter = Number(m[1]);
  const fresh = await recordChapter(friend.id, chapter, "report");
  const cleared = (await get<{ n: number }>("SELECT COUNT(*) n FROM course_progress WHERE friend_id = ?", friend.id))?.n ?? 1;
  box.add(
    `✨ CHAPTER CLEAR ✨
第${chapter}章 クリア！${fresh ? "" : "（記録済みです）"}
これまでに ${cleared}章 を踏破しました。

「見事です、{{name}}さん。一歩ずつ進んだ分だけ、冒険の書は確かに厚くなっています」
---
📜【次のクエスト】
第${chapter + 1}章へ。続きはここから👇
{{link:lp}}

つまずいたら「質問」と送ってください。`,
    "auto",
  );
  return true;
}

interface Target extends Friend {
  nudge_stage: number;
  nudged_at: number | null;
  last_progress: number;
  purchased: number;
  habit_action: string | null;
  habit_remind: number | null;
  chapters: number;
}

/** 声かけの対象と「最後に進めた時」をまとめて読む */
function targets() {
  return all<Target>(
    `SELECT f.*,
       (SELECT h.action FROM habits h WHERE h.friend_id = f.id AND h.action != '') AS habit_action,
       (SELECT h.remind_enabled FROM habits h WHERE h.friend_id = f.id AND h.action != '') AS habit_remind,
       (SELECT COUNT(*) FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = f.id AND t.name = ?) AS purchased,
       (SELECT COUNT(*) FROM course_progress p WHERE p.friend_id = f.id) AS chapters,
       MAX(
         f.followed_at,
         COALESCE((SELECT MAX(ft.created_at) FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = f.id AND t.name = ?), 0),
         COALESCE((SELECT MAX(m.created_at) FROM messages m WHERE m.friend_id = f.id AND m.direction = 'in'), 0),
         COALESCE((SELECT MAX(c.created_at) FROM link_clicks c WHERE c.friend_id = f.id), 0),
         COALESCE((SELECT MAX(r.created_at) FROM form_responses r WHERE r.friend_id = f.id), 0),
         COALESCE((SELECT MAX(l.created_at) FROM habit_logs l WHERE l.friend_id = f.id), 0),
         COALESCE((SELECT MAX(p.created_at) FROM course_progress p WHERE p.friend_id = f.id), 0),
         COALESCE((SELECT MAX(mp.updated_at) FROM mission_progress mp WHERE mp.friend_id = f.id), 0)
       ) AS last_progress
     FROM friends f
     WHERE f.blocked = 0
       AND (EXISTS (SELECT 1 FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = f.id AND t.name = ?)
            OR EXISTS (SELECT 1 FROM habits h WHERE h.friend_id = f.id AND h.action != ''))`,
    PURCHASE_TAG,
    PURCHASE_TAG,
    PURCHASE_TAG,
  );
}

/** 止まった日数（1日目=0）に応じた日替わりの文面。購入者は講座、習慣だけの人は習慣について声をかける */
export function nudgeMessage(t: Pick<Target, "purchased" | "habit_action" | "chapters">, idleIndex: number): string {
  if (t.purchased) {
    const done = t.chapters > 0 ? `これまでに ${t.chapters}章 を踏破しています。` : "";
    const messages = [
      `📖 今日の冒険の書は、まだ白紙のままです。

「{{name}}さん、今日は忙しかったですか？${done}
寝る前に5分だけ、続きの1操作を進めてみましょう。それだけで、今日の1ページが埋まります」
{{link:lp}}

進んだら「第◯章クリア」と送ってください。`,
      `🕯 2日、旅が止まっています。

「{{name}}さん。止まった日があるのは、冒険者なら誰でも同じです。
大事なのは、今日もう一度、書を開くことです」
📜 今日の小さなクエスト：講座を開いて、1操作だけ進める
{{link:lp}}`,
      `🗝 守護者より

「{{name}}さん、どこかで道に迷っていませんか？
止まっている場所を一言だけ教えてください（例：アプリの導入で止まった）。講師と一緒に、次の一歩を探します」`,
      `⚔ 今日のクエスト

「{{name}}さん、今日は"続きの1操作だけ"で十分です。
完璧に理解するより、手を動かした冒険者が先に進みます」
{{link:lp}}`,
      `🔥 冒険の火を絶やさないで

「{{name}}さん、相棒（AI）はいつでもあなたの指示を待っています。
今日5分、話しかけてみませんか」
{{link:lp}}

分からなくなったら「質問」と送ってください。`,
      `📜 守護者より

「{{name}}さん、1週間、書が開かれていません。
最初の章から読み直しても大丈夫。歩き出した日が、また最初の一歩です」
{{link:lp}}`,
    ];
    return messages[Math.min(idleIndex, messages.length - 1)];
  }
  const action = t.habit_action ?? "決めた行動";
  const messages = [
    `🔥 今日の「${action}」は、まだ記録されていません。

やったら「できた」と送ってください。1回でも記録すれば、連続日数がつながります。`,
    `🕯 「${action}」、2日記録が止まっています。

今日1回だけでもやったら「できた」と送ってください。連続はまたここから積み上がります。`,
    `🗝 「${action}」が今の自分に合っていなければ、もっと小さな行動に変えても大丈夫です。
「習慣を変える」と送ると、行動を決め直せます。`,
    `📜 「${action}」の記録帳は、いつでもここにあります。

累計とバッジは消えません。今日やったら「できた」と送るだけです。`,
  ];
  return messages[Math.min(idleIndex, messages.length - 1)];
}

/** 定期実行から呼ぶ：その日に何も進めていない人に、夜1通声をかける（毎日） */
export async function sendNudges(now = Date.now()) {
  if (!SEND_HOURS.includes(jstHour(now))) return;
  const today = jstDateKey(now);
  const todayStart = jstDayStart(now);
  for (const t of await targets()) {
    // 習慣だけの人で、毎日のリマインドを設定している人はリマインドに任せる
    if (!t.purchased && t.habit_remind) continue;
    if (t.nudged_at && jstDateKey(t.nudged_at) === today) continue;
    // 今日進めていたら送らない。止まった日数も数え直す
    if (t.last_progress >= todayStart) {
      if (t.nudge_stage) await run("UPDATE friends SET nudge_stage = 0 WHERE id = ?", t.id);
      continue;
    }
    // 止まった日数（今日を1日目として0から）：前回の声かけ以降に進めていなければ続きから
    const continuing = t.nudged_at && t.last_progress < t.nudged_at;
    const idleIndex = continuing ? (t.nudge_stage ?? 0) : 0;
    try {
      await pushToFriend(t, nudgeMessage(t, idleIndex), "auto");
      await run("UPDATE friends SET nudge_stage = ?, nudged_at = ? WHERE id = ?", idleIndex + 1, now, t.id);
    } catch (e) {
      if (e instanceof QuotaError) return; // 今月の通数を使い切ったら止める
      console.error("声かけを送れませんでした", e);
    }
  }
}
