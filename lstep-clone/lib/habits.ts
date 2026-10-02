// 習慣トラッカー（「継続する技術」を参考にした、公式LINEのトークだけで完結する継続支援）
//   続ける行動を1つ決める → 「できた」で記録 → 連続日数・累計・バッジ → 決めた時刻にリマインド
// 返信はすべて応答メッセージ（無料）。リマインドだけがプッシュ（1人1日1通）になる
import { all, get, run } from "./db";
import type { Outbox } from "./delivery";
import { pushToFriend, queuePending } from "./delivery";
import { jstDateKey } from "./format";
import { QuotaError } from "./quota";
import type { Friend } from "./types";

export interface Habit {
  friend_id: number;
  action: string;
  remind_time: string | null;
  remind_enabled: number;
  streak: number;
  best_streak: number;
  total: number;
  last_done_date: string | null;
  last_reminded_date: string | null;
  state: string | null;
  badges: string;
  created_at: number;
}

const START_WORDS = ["習慣", "習慣をはじめる", "習慣を始める"];
const DONE_WORDS = ["できた", "やった", "完了", "達成"];

/** 連続日数のバッジ（[日数, 名前]） */
const STREAK_BADGES: [number, string][] = [
  [1, "🌱 はじめの一歩"],
  [3, "🔥 三日坊主突破"],
  [7, "⭐ 1週間継続"],
  [14, "🌙 2週間継続"],
  [21, "💎 習慣化の21日"],
  [30, "🏆 1か月継続"],
  [50, "👑 50日継続"],
  [100, "🌈 100日継続"],
];
/** 累計日数のバッジ（途切れても積み上がる） */
const TOTAL_BADGES: [number, string][] = [
  [10, "📗 累計10日"],
  [30, "📘 累計30日"],
  [100, "📕 累計100日"],
];

function today(now = Date.now()) {
  return jstDateKey(now);
}
function yesterday(now = Date.now()) {
  return jstDateKey(now - 86400_000);
}

async function getHabit(friendId: number): Promise<Habit | undefined> {
  return get<Habit>("SELECT * FROM habits WHERE friend_id = ?", friendId);
}

function parseTime(text: string): string | null {
  const m = text.replace(/[：]/g, ":").replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).match(/^(\d{1,2})(?::(\d{2}))?(?:時)?(?:(\d{1,2})分)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? m[3] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 次のバッジまでの進み具合を ■□ で見せる（0日目から数える） */
function nextBadgeLine(streak: number): string {
  const next = STREAK_BADGES.find(([d]) => d > streak);
  if (!next) return "すべての連続バッジを獲得しました！";
  const cells = Math.min(10, next[0]);
  const filled = Math.min(cells - 1, Math.max(1, Math.floor((streak / next[0]) * cells)));
  return `次のバッジ「${next[1]}」まであと${next[0] - streak}日\n${"■".repeat(filled)}${"□".repeat(cells - filled)}`;
}

function earned(h: Habit): string[] {
  return h.badges ? h.badges.split(",") : [];
}

function statusText(h: Habit): string {
  const badges = earned(h);
  return [
    `📒 あなたの習慣：${h.action}`,
    `🔥 連続 ${h.streak}日（最高 ${h.best_streak}日）`,
    `📅 累計 ${h.total}日`,
    `🏅 バッジ ${badges.length}個${badges.length ? `\n${badges.join(" / ")}` : ""}`,
    `⏰ リマインド：${h.remind_enabled && h.remind_time ? `毎日 ${h.remind_time}` : "オフ"}`,
  ].join("\n");
}

const HELP = `【使い方】
・できた … 今日の記録
・記録 … 連続日数・累計・バッジを見る
・通知 21:00 … リマインドの時刻を変える
・通知オフ ／ 通知オン … リマインドを止める・再開する
・習慣を変える … 続ける行動を決め直す（累計とバッジは残ります）`;

/**
 * 習慣に関するメッセージなら返信を積んで true を返す。関係なければ false（通常のキーワード応答へ）
 */
export async function handleHabitText(box: Outbox, friend: Friend, raw: string): Promise<boolean> {
  const text = raw.trim();
  const habit = await getHabit(friend.id);
  const now = Date.now();

  // 始める・決め直す
  if (START_WORDS.includes(text) || text === "習慣を変える") {
    if (habit && text !== "習慣を変える") {
      box.add(`${statusText(habit)}\n---\n${HELP}`, "auto");
      return true;
    }
    if (habit) {
      await run("UPDATE habits SET state = 'await_action' WHERE friend_id = ?", friend.id);
    } else {
      await run(
        "INSERT INTO habits (friend_id, action, state, created_at) VALUES (?, '', 'await_action', ?)",
        friend.id,
        now,
      );
    }
    box.add(
      `続けたい行動を【1つだけ】送ってください✍️\n\n例）\n・腕立て10回\n・SNS投稿1本\n・英単語を5個覚える\n\nコツは「小さすぎるかな？」くらいにすることです。`,
      "auto",
    );
    return true;
  }
  if (!habit) return false;

  // 行動を決める
  if (habit.state === "await_action") {
    const action = text.slice(0, 60);
    await run("UPDATE habits SET action = ?, state = 'await_time' WHERE friend_id = ?", action, friend.id);
    box.add(
      `「${action}」ですね！いい選択です👍\n---\n毎日、何時にリマインドしましょうか？\n「21:00」のように送ってください。\nリマインドがいらなければ「なし」と送ってください。`,
      "auto",
    );
    return true;
  }

  // 時刻を決める
  if (habit.state === "await_time") {
    if (text === "なし") {
      await run("UPDATE habits SET remind_enabled = 0, state = NULL WHERE friend_id = ?", friend.id);
    } else {
      const t = parseTime(text);
      if (!t) {
        box.add("時刻は「21:00」のように送ってください（いらなければ「なし」）。", "auto");
        return true;
      }
      await run("UPDATE habits SET remind_time = ?, remind_enabled = 1, state = NULL WHERE friend_id = ?", t, friend.id);
    }
    const h = (await getHabit(friend.id))!;
    box.add(
      `準備完了です🎉\n\n📒 続ける行動：${h.action}\n⏰ リマインド：${h.remind_enabled && h.remind_time ? `毎日 ${h.remind_time}` : "なし"}\n\nやったら「できた」と送るだけで記録できます。\nさっそく今日の1回目、やってみましょう！`,
      "auto",
    );
    return true;
  }

  // 記録する
  if (DONE_WORDS.includes(text)) {
    if (!habit.action) return false;
    if (habit.last_done_date === today(now)) {
      box.add(`今日はもう記録済みです✅\n🔥 連続 ${habit.streak}日 ／ 📅 累計 ${habit.total}日\nまた明日もよろしくお願いします！`, "auto");
      return true;
    }
    const continued = habit.last_done_date === yesterday(now);
    const restarted = Boolean(habit.last_done_date) && !continued;
    const streak = continued ? habit.streak + 1 : 1;
    const total = habit.total + 1;
    const best = Math.max(habit.best_streak, streak);
    const have = new Set(earned(habit));
    const fresh = [
      ...STREAK_BADGES.filter(([d]) => streak >= d),
      ...TOTAL_BADGES.filter(([d]) => total >= d),
    ]
      .map(([, name]) => name)
      .filter((name) => !have.has(name));
    const badges = [...have, ...fresh].join(",");
    await run(
      "UPDATE habits SET streak = ?, best_streak = ?, total = ?, last_done_date = ?, badges = ? WHERE friend_id = ?",
      streak,
      best,
      total,
      today(now),
      badges,
      friend.id,
    );

    const head = restarted
      ? `おかえりなさい！🌱\nまた始めたこと自体がすごいことです。\n今日から新しい連続1日目、累計は ${total}日 に増えました。`
      : streak === 1
        ? `記念すべき1日目、達成です！🎉`
        : `ナイス！今日も達成です🎉`;
    const parts = [`${head}\n\n🔥 連続 ${streak}日\n📅 累計 ${total}日`];
    if (fresh.length) parts.push(`🏅 新しいバッジを獲得しました！\n${fresh.join("\n")}`);
    parts.push(nextBadgeLine(streak));
    box.add(parts.join("\n---\n"), "auto");
    return true;
  }

  if (text === "記録") {
    box.add(statusText(habit), "auto");
    return true;
  }
  if (text === "通知オフ" || text === "通知停止") {
    await run("UPDATE habits SET remind_enabled = 0 WHERE friend_id = ?", friend.id);
    box.add("リマインドを止めました。再開するときは「通知オン」と送ってください。", "auto");
    return true;
  }
  if (text === "通知オン") {
    if (!habit.remind_time) {
      box.add("時刻が未設定です。「通知 21:00」のように送ってください。", "auto");
      return true;
    }
    await run("UPDATE habits SET remind_enabled = 1 WHERE friend_id = ?", friend.id);
    box.add(`リマインドを再開しました。毎日 ${habit.remind_time} にお知らせします⏰`, "auto");
    return true;
  }
  const change = text.match(/^通知\s*(.+)$/);
  if (change) {
    const t = parseTime(change[1].trim());
    if (!t) {
      box.add("時刻は「通知 21:00」のように送ってください。", "auto");
      return true;
    }
    await run("UPDATE habits SET remind_time = ?, remind_enabled = 1 WHERE friend_id = ?", t, friend.id);
    box.add(`リマインドを毎日 ${t} に変更しました⏰`, "auto");
    return true;
  }
  return false;
}

/** 決めた時刻を過ぎていて、今日まだ記録もリマインドもしていない人にリマインドを送る（定期実行から呼ぶ） */
export async function sendHabitReminders(now = Date.now()) {
  const d = today(now);
  const hhmm = new Date(now + 9 * 3600_000).toISOString().slice(11, 16);
  const due = await all<Habit & Friend>(
    `SELECT h.*, f.* FROM habits h JOIN friends f ON f.id = h.friend_id
     WHERE h.remind_enabled = 1 AND h.remind_time IS NOT NULL AND h.remind_time <= ? AND h.action != ''
       AND (h.last_done_date IS NULL OR h.last_done_date != ?)
       AND (h.last_reminded_date IS NULL OR h.last_reminded_date != ?)
       AND f.blocked = 0`,
    hhmm,
    d,
    d,
  );
  for (const row of due) {
    const friend = { ...row, id: row.friend_id } as unknown as Friend;
    const msg = `⏰ 「${row.action}」の時間です！\n終わったら「できた」と送ってください。${row.streak > 0 && row.last_done_date === yesterday(now) ? `\n🔥 いま連続 ${row.streak}日。今日で ${row.streak + 1}日目です！` : ""}`;
    await run("UPDATE habits SET last_reminded_date = ? WHERE friend_id = ?", d, row.friend_id);
    try {
      await pushToFriend(friend, msg, "step");
    } catch (e) {
      // 無料の配信数を使い切ったら、次に相手が話しかけた時に無料で届ける
      if (e instanceof QuotaError) await queuePending([row.friend_id], [{ content: msg, source: "step", refId: null }]);
      else console.error("習慣リマインドの送信に失敗", e);
    }
  }
}
