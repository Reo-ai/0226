// 応募カウンター：1日の応募目標（初期値20件）に向けて、LINEのトークだけで件数を記録し、届いていない日はリマインドする
//   「応募スタート」で始める →「応募 3」「3件応募」で今日の件数に足す → 目標に届くと達成と連続日数
//   毎日12時と20時（日本時間）に、目標に届いていない人へ「今日はあと○件」をプッシュ
//   「応募記録」「応募目標 10」「応募リマインド オフ／オン」
import { all, get, run } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { jstDateKey } from "./format";
import { QuotaError } from "./quota";
import type { Outbox } from "./delivery";
import type { Friend } from "./types";

const DEFAULT_GOAL = 20;
/** リマインドの時刻（日本時間・時）。その時を過ぎて最初の定期実行で1回だけ送る */
const REMIND_HOURS = [12, 20];

interface ApplyGoal {
  friend_id: number;
  goal: number;
  remind_enabled: number;
  streak: number;
  best_streak: number;
  last_hit_date: string | null;
  last_noon_date: string | null;
  last_night_date: string | null;
}

const today = (now = Date.now()) => jstDateKey(now);
const yesterday = (now = Date.now()) => jstDateKey(now - 86400_000);
const jstHour = (ms: number) => new Date(ms + 9 * 3600_000).getUTCHours();

function bar(n: number, goal: number) {
  const filled = Math.min(10, Math.round((n / goal) * 10));
  return "■".repeat(filled) + "□".repeat(10 - filled);
}

async function getGoal(friendId: number) {
  return get<ApplyGoal>("SELECT * FROM apply_goals WHERE friend_id = ?", friendId);
}

async function todayCount(friendId: number, now = Date.now()) {
  return (await get<{ count: number }>("SELECT count FROM apply_logs WHERE friend_id = ? AND date = ?", friendId, today(now)))?.count ?? 0;
}

const HELP = `📮 応募カウンターの使い方
・応募したら「応募 3」（3件の場合）と送る
・「応募記録」… 今日と直近7日
・「応募目標 10」… 1日の目標を変える
・「応募リマインド オフ」… 12時・20時のお知らせを止める`;

/** 「応募」まわりの言葉を扱う。扱ったら true */
export async function handleApplyText(box: Outbox, friend: Friend, raw: string): Promise<boolean> {
  const text = raw.normalize("NFKC").trim();
  if (!/応募/.test(text)) return false;
  const now = Date.now();
  let goal = await getGoal(friend.id);

  // 始める
  if (/^応募(スタート|リマインド|カウンター|を始める)$/.test(text)) {
    if (!goal) {
      await run("INSERT INTO apply_goals (friend_id, goal, remind_enabled, created_at) VALUES (?, ?, 1, ?)", friend.id, DEFAULT_GOAL, now);
      goal = await getGoal(friend.id);
    }
    const n = await todayCount(friend.id, now);
    box.add(
      `⚔ 応募の修行、開始！

「{{name}}さん、1日の目標は ${goal!.goal}件 です。
数をこなした冒険者から、依頼は舞い込んできます」
今日の応募：${n}/${goal!.goal}件
---
${HELP}

毎日12時と20時に、目標に届いていなければお知らせします。
選択肢: 応募 1 / 応募 5 / 応募記録`,
      "auto",
    );
    return true;
  }

  // 目標を変える
  const g = text.match(/^応募目標\s*(\d{1,3})/);
  if (g) {
    const v = Math.max(1, Math.min(200, Number(g[1])));
    if (goal) await run("UPDATE apply_goals SET goal = ? WHERE friend_id = ?", v, friend.id);
    else await run("INSERT INTO apply_goals (friend_id, goal, remind_enabled, created_at) VALUES (?, ?, 1, ?)", friend.id, v, now);
    const n = await todayCount(friend.id, now);
    box.add(`1日の応募目標を ${v}件 にしました✍️\n今日の応募：${n}/${v}件\n${bar(n, v)}`, "auto");
    return true;
  }

  // リマインドのオン・オフ
  const r = text.match(/^応募リマインド\s*(オフ|off|OFF|停止|オン|on|ON|再開)$/);
  if (r) {
    const on = /オン|on|ON|再開/.test(r[1]);
    if (!goal) await run("INSERT INTO apply_goals (friend_id, goal, remind_enabled, created_at) VALUES (?, ?, ?, ?)", friend.id, DEFAULT_GOAL, on ? 1 : 0, now);
    else await run("UPDATE apply_goals SET remind_enabled = ? WHERE friend_id = ?", on ? 1 : 0, friend.id);
    box.add(on ? "応募リマインドを再開しました。毎日12時と20時にお知らせします⏰" : "応募リマインドを止めました。再開するときは「応募リマインド オン」と送ってください。", "auto");
    return true;
  }

  // 記録を見る
  if (/^応募(記録|履歴|状況)$/.test(text)) {
    const v = goal?.goal ?? DEFAULT_GOAL;
    const rows = await all<{ date: string; count: number }>(
      "SELECT date, count FROM apply_logs WHERE friend_id = ? AND date >= ? ORDER BY date DESC",
      friend.id,
      jstDateKey(now - 6 * 86400_000),
    );
    const n = await todayCount(friend.id, now);
    const lines = rows.map((x) => `${x.date.slice(5).replace("-", "/")}　${x.count}件${x.count >= v ? " 🏆" : ""}`);
    box.add(
      `📮 応募の記録
今日：${n}/${v}件
${bar(n, v)}
${goal?.streak ? `🔥 目標達成の連続：${goal.streak}日（最高 ${goal.best_streak}日）\n` : ""}
直近7日
${lines.length ? lines.join("\n") : "まだ記録がありません"}`,
      "auto",
    );
    return true;
  }

  // 件数を足す：「応募 3」「応募3件」「3件応募」「応募+3」
  const m = text.match(/^応募\s*\+?\s*(\d{1,3})\s*件?$/) || text.match(/^(\d{1,3})\s*件\s*応募(した|しました)?$/);
  if (!m) return false;
  const add = Number(m[1]);
  if (add < 1) return false;
  if (!goal) {
    await run("INSERT INTO apply_goals (friend_id, goal, remind_enabled, created_at) VALUES (?, ?, 1, ?)", friend.id, DEFAULT_GOAL, now);
    goal = await getGoal(friend.id);
  }
  const d = today(now);
  const before = await todayCount(friend.id, now);
  await run(
    `INSERT INTO apply_logs (friend_id, date, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(friend_id, date) DO UPDATE SET count = count + excluded.count, updated_at = excluded.updated_at`,
    friend.id,
    d,
    add,
    now,
  );
  const n = before + add;
  const v = goal!.goal;
  if (before < v && n >= v) {
    // 今日はじめて目標に届いた
    const streak = goal!.last_hit_date === yesterday(now) ? goal!.streak + 1 : 1;
    const best = Math.max(goal!.best_streak, streak);
    await run("UPDATE apply_goals SET streak = ?, best_streak = ?, last_hit_date = ? WHERE friend_id = ?", streak, best, d, friend.id);
    box.add(
      `🏆 今日の応募 ${n}件、目標達成！
${bar(n, v)}
🔥 目標達成の連続：${streak}日${streak === best && streak > 1 ? "（自己ベスト！）" : ""}

「見事です、{{name}}さん。今日まいた種は、必ずどこかで芽を出します。
返信が来たら、焦らず1件ずつ。提案文は案件ごとに整えていきましょう」`,
      "auto",
    );
    return true;
  }
  box.add(
    n >= v
      ? `📮 今日の応募 ${n}件（目標 ${v}件 達成済み）\n${bar(n, v)}\nすごいペースです🔥`
      : `📮 今日の応募 ${n}/${v}件\n${bar(n, v)}\nあと ${v - n}件！\n選択肢: 応募 1 / 応募 5 / 応募記録`,
    "auto",
  );
  return true;
}

/** 定期実行から呼ぶ：12時・20時に、目標に届いていない人へリマインド（各1回） */
export async function sendApplyReminders(now = Date.now()) {
  const h = jstHour(now);
  const slot = h >= REMIND_HOURS[1] ? "night" : h >= REMIND_HOURS[0] ? "noon" : null;
  if (!slot) return;
  const d = today(now);
  const col = slot === "noon" ? "last_noon_date" : "last_night_date";
  const due = await all<ApplyGoal & Friend & { today_count: number | null }>(
    `SELECT g.*, f.*, (SELECT count FROM apply_logs l WHERE l.friend_id = g.friend_id AND l.date = ?) AS today_count
     FROM apply_goals g JOIN friends f ON f.id = g.friend_id
     WHERE g.remind_enabled = 1 AND f.blocked = 0 AND (g.${col} IS NULL OR g.${col} != ?)`,
    d,
    d,
  );
  for (const row of due) {
    await run(`UPDATE apply_goals SET ${col} = ? WHERE friend_id = ?`, d, row.friend_id);
    const n = row.today_count ?? 0;
    if (n >= row.goal) continue;
    const friend = { ...row, id: row.friend_id } as unknown as Friend;
    const msg =
      slot === "noon"
        ? `☀️ 応募の修行、昼の便り

今日の応募：${n}/${row.goal}件
${bar(n, row.goal)}
あと ${row.goal - n}件。午後のうちに、まず5件いきましょう⚔

応募したら「応募 5」のように送ってください。
選択肢: 応募 1 / 応募 5 / 応募記録`
        : `🌙 今日の応募、あと ${row.goal - n}件

今日の応募：${n}/${row.goal}件
${bar(n, row.goal)}
${n === 0 ? "1件だけでも大丈夫。今日の1件が、明日の返信につながります。" : "あと少し。寝る前のひと踏ん張りで、目標に届きます🔥"}

選択肢: 応募 1 / 応募 5 / 応募記録`;
    try {
      await pushToFriend(friend, msg, "step");
    } catch (e) {
      if (e instanceof QuotaError) await queuePending([row.friend_id], [{ content: msg, source: "step", refId: null }]);
      else console.error("応募リマインドの送信に失敗", e);
    }
  }
}
