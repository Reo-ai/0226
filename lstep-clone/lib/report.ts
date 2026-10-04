// 毎朝の数字レポート：通知を登録した運用者の LINE に、昨日の数字と今日の予定を届ける（1人1日1通）
import { all, get, getSetting, setSetting } from "./db";
import { pushToFriend } from "./delivery";
import { jstDateKey, jstDayStart } from "./format";
import { notifyTargets, unrepliedCount } from "./inbox";
import { pushLimit, pushUsed } from "./quota";
import { slotLabel } from "./bookings";
import type { Friend } from "./types";
import { baseUrl } from "./env";

export const REPORT_ENABLED = "report.enabled";
export const REPORT_TIME = "report.time";
const REPORT_LAST = "report.last_date";

export async function buildReport(now = Date.now()): Promise<string> {
  const today = jstDayStart(now);
  const yesterday = today - 86400_000;
  const n = async (sql: string, ...args: number[]) => (await get<{ n: number }>(sql, ...args))?.n ?? 0;
  const added = await n("SELECT COUNT(*) n FROM friends WHERE followed_at >= ? AND followed_at < ?", yesterday, today);
  const blocked = await n("SELECT COUNT(*) n FROM friends WHERE unfollowed_at >= ? AND unfollowed_at < ?", yesterday, today);
  const active = await n("SELECT COUNT(*) n FROM friends WHERE blocked = 0");
  const clicks = await n("SELECT COUNT(DISTINCT friend_id) n FROM link_clicks WHERE created_at >= ? AND created_at < ?", yesterday, today);
  const unreplied = await unrepliedCount();
  const bookings = await all<{ starts_at: number; minutes: number; name: string; display_name: string | null }>(
    `SELECT s.starts_at, s.minutes, b.name, f.display_name FROM bookings b JOIN booking_slots s ON s.id = b.slot_id
     LEFT JOIN friends f ON f.id = b.friend_id
     WHERE b.status = 'booked' AND s.starts_at >= ? AND s.starts_at < ? ORDER BY s.starts_at`,
    today,
    today + 86400_000,
  );
  const limit = await pushLimit();
  const used = await pushUsed();
  const lines = [
    `☀️ おはようございます（${jstDateKey(now).slice(5).replace("-", "/")}）`,
    "",
    `友だち：${active}人（昨日 +${added}${blocked ? ` / ブロック ${blocked}` : ""}）`,
    `昨日リンクを押した人：${clicks}人`,
    `未返信：${unreplied}件${unreplied ? " ⚠️" : ""}`,
    `今月の配信数：${used}${Number.isFinite(limit) ? ` / ${limit}` : ""}通`,
  ];
  if (bookings.length) {
    lines.push("", `📅 今日の予約 ${bookings.length}件`);
    for (const b of bookings.slice(0, 5)) lines.push(`・${slotLabel(b).split(" ").pop()} ${b.display_name || b.name || "お客さま"}`);
  }
  if (unreplied) lines.push("", `返信する → ${baseUrl()}/inbox`);
  return lines.join("\n");
}

/** 定期実行から呼ぶ：設定した時刻を過ぎたら、その日まだなら送る */
export async function sendDailyReport(now = Date.now()) {
  if ((await getSetting(REPORT_ENABLED)) !== "1") return;
  const time = (await getSetting(REPORT_TIME)) || "08:00";
  const hhmm = new Date(now + 9 * 3600_000).toISOString().slice(11, 16);
  const today = jstDateKey(now);
  if (hhmm < time || (await getSetting(REPORT_LAST)) === today) return;
  const targets = await notifyTargets();
  if (!targets.length) return;
  // 先に「送った」にして、5分おきの実行で二重に送らない
  await setSetting(REPORT_LAST, today);
  const text = await buildReport(now);
  for (const id of targets) {
    const to = await get<Friend>("SELECT * FROM friends WHERE id = ? AND blocked = 0", id);
    if (!to) continue;
    try {
      await pushToFriend(to, text, "manual");
    } catch (e) {
      console.error("朝のレポートを送れませんでした", e);
    }
  }
}
