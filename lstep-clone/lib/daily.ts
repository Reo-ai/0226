// 日替わりで受け取る：リッチメニューのボタンなどで決めた言葉（例「今日のクエスト」）が送られたら、
// その人の「何日目か」に合わせた内容を返す。返事なので配信数を使わない
import { all, get } from "./db";
import type { Outbox } from "./delivery";
import { jstDayStart } from "./format";
import type { Friend } from "./types";

export interface DailySet {
  id: number;
  name: string;
  keyword: string;
  /** follow＝友だち追加の日が1日目／tag＝そのタグが付いた日が1日目 */
  start_type: "follow" | "tag";
  start_tag_id: number | null;
  /** 最後の日を過ぎた人に返す文（空なら最後の日の内容をもう一度） */
  end_message: string;
  enabled: number;
  created_at: number;
}

export interface DailyItem {
  id: number;
  set_id: number;
  day: number;
  content: string;
}

const norm = (t: string) => t.trim().replace(/\s+/g, "").toLowerCase();

/** その人の今日が「何日目」か（始まっていなければ null） */
export async function dayOf(set: DailySet, friend: Friend, now = Date.now()): Promise<number | null> {
  let base: number | null = friend.followed_at;
  if (set.start_type === "tag") {
    const t = await get<{ created_at: number }>(
      "SELECT created_at FROM friend_tags WHERE friend_id = ? AND tag_id = ?",
      friend.id,
      set.start_tag_id,
    );
    base = t?.created_at ?? null;
  }
  if (!base) return null;
  return Math.floor((jstDayStart(now) - jstDayStart(base)) / 86_400_000) + 1;
}

/** その日に返す内容。その日の分が無ければ直前の日の分。最後の日を過ぎたら終わりの文 */
export async function contentFor(set: DailySet, day: number): Promise<string | null> {
  const items = await all<DailyItem>("SELECT * FROM daily_items WHERE set_id = ? ORDER BY day", set.id);
  if (!items.length) return null;
  const last = items[items.length - 1];
  if (day > last.day && set.end_message.trim()) return set.end_message;
  const hit = [...items].reverse().find((i) => i.day <= day);
  return (hit ?? items[0]).content;
}

/** 決めた言葉が送られたら、その人の今日の分を返す */
export async function handleDailyKeyword(box: Outbox, text: string): Promise<boolean> {
  const t = norm(text);
  const sets = await all<DailySet>("SELECT * FROM daily_sets WHERE enabled = 1");
  const set = sets.find((s) => norm(s.keyword) === t);
  if (!set) return false;
  const day = await dayOf(set, box.friend);
  if (day === null) {
    box.add("まだ始まっていません。案内が届くまで、もう少しお待ちください。", "auto");
    return true;
  }
  const content = await contentFor(set, day);
  if (!content) return false;
  box.add(content, "auto", set.id);
  return true;
}
