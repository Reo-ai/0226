// 予約の受付（カレンダー予約）
// - 管理画面で「予約できる枠（日時・時間・定員）」を作る
// - 友だちは本文の {{booking}} から開く予約ページで枠を選ぶ → 確認メッセージ・タグ付け・運用者への通知
// - 開始の○時間前にリマインドを送る（定期実行）
import { all, get, getSetting, run } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { notifyTargets } from "./inbox";
import { QuotaError } from "./quota";
import { addScore } from "./score";
import { addTag } from "./tags";
import type { Friend } from "./types";

export interface Slot {
  id: number;
  starts_at: number;
  minutes: number;
  capacity: number;
  booked: number;
}

export interface Booking {
  id: number;
  slot_id: number;
  friend_id: number | null;
  name: string;
  note: string;
  status: "booked" | "canceled";
  reminded: number;
  created_at: number;
}

export const BOOKING_SETTINGS = {
  title: "booking.title",
  tagId: "booking.tag_id",
  remindHours: "booking.remind_hours",
  confirm: "booking.confirm_message",
} as const;

export async function bookingSettings() {
  return {
    title: (await getSetting(BOOKING_SETTINGS.title)) || "ご予約",
    tagId: Number(await getSetting(BOOKING_SETTINGS.tagId)) || null,
    remindHours: Number(await getSetting(BOOKING_SETTINGS.remindHours, "24")) || 0,
    confirm: await getSetting(BOOKING_SETTINGS.confirm),
  };
}

const BOOKED = "(SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'booked')";

/** これからの枠（予約済みの数つき） */
export function upcomingSlots(now = Date.now()): Promise<Slot[]> {
  return all<Slot>(`SELECT s.*, ${BOOKED} booked FROM booking_slots s WHERE s.starts_at > ? ORDER BY s.starts_at`, now);
}

/** 終わった枠も含めて（管理画面用。直近30日前から） */
export function slotsForAdmin(now = Date.now()): Promise<Slot[]> {
  return all<Slot>(
    `SELECT s.*, ${BOOKED} booked FROM booking_slots s WHERE s.starts_at > ? ORDER BY s.starts_at`,
    now - 30 * 86400_000,
  );
}

export function bookingsOfSlots(slotIds: number[]) {
  if (!slotIds.length) return Promise.resolve([]);
  return all<Booking & { display_name: string | null }>(
    `SELECT b.*, f.display_name FROM bookings b LEFT JOIN friends f ON f.id = b.friend_id
     WHERE b.slot_id IN (${slotIds.map(() => "?").join(",")}) ORDER BY b.created_at`,
    ...slotIds,
  );
}

/** その友だちのこれからの予約 */
export function upcomingBookingsOf(friendId: number, now = Date.now()) {
  return all<Booking & { starts_at: number; minutes: number }>(
    `SELECT b.*, s.starts_at, s.minutes FROM bookings b JOIN booking_slots s ON s.id = b.slot_id
     WHERE b.friend_id = ? AND b.status = 'booked' AND s.starts_at > ? ORDER BY s.starts_at`,
    friendId,
    now,
  );
}

export const slotLabel = (s: { starts_at: number; minutes: number }) => {
  const end = new Date(s.starts_at + s.minutes * 60_000).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });
  const start = new Date(s.starts_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start}〜${end}`;
};

/** 運用者の LINE（通知登録した人）へお知らせ。配信数が尽きていたら送らない */
async function notifyOperators(text: string) {
  for (const id of await notifyTargets()) {
    const to = await get<Friend>("SELECT * FROM friends WHERE id = ? AND blocked = 0", id);
    if (!to) continue;
    try {
      await pushToFriend(to, text, "manual");
    } catch (e) {
      console.error("予約の通知を送れませんでした", e);
    }
  }
}

async function safePush(friend: Friend, text: string) {
  try {
    await pushToFriend(friend, text, "auto");
  } catch (e) {
    // 無料の配信数を使い切ったら、次に相手が話しかけた時に無料で届ける
    if (e instanceof QuotaError) await queuePending([friend.id], [{ content: text, source: "auto", refId: null }]);
    else console.error("予約のメッセージを送れませんでした", e);
  }
}

export class BookingError extends Error {}

/** 予約する。定員を超えないよう、空きがある時だけ入れる */
export async function book(slotId: number, friend: Friend | undefined, name: string, note: string): Promise<Booking> {
  const slot = await get<Slot>(`SELECT s.*, ${BOOKED} booked FROM booking_slots s WHERE s.id = ?`, slotId);
  if (!slot || slot.starts_at <= Date.now()) throw new BookingError("この枠は予約できません。別の日時を選んでください。");
  if (friend) {
    const dup = await get("SELECT id FROM bookings WHERE slot_id = ? AND friend_id = ? AND status = 'booked'", slotId, friend.id);
    if (dup) throw new BookingError("この枠はすでに予約済みです。");
  }
  const { changes, lastId } = await run(
    `INSERT INTO bookings (slot_id, friend_id, name, note, created_at)
     SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM bookings WHERE slot_id = ? AND status = 'booked') <
                               (SELECT capacity FROM booking_slots WHERE id = ?)`,
    slotId,
    friend?.id ?? null,
    name.slice(0, 50),
    note.slice(0, 1000),
    Date.now(),
    slotId,
    slotId,
  );
  if (changes === 0) throw new BookingError("ちょうど満席になりました。別の日時を選んでください。");
  const cfg = await bookingSettings();
  const label = slotLabel(slot);
  if (friend) {
    if (cfg.tagId) await addTag(friend.id, cfg.tagId);
    await addScore(friend.id, "booking");
    await safePush(
      friend,
      `📅 ${cfg.title}を受け付けました\n日時：${label}${cfg.confirm ? `\n\n${cfg.confirm}` : ""}\n\n変更・キャンセルは、予約したページからできます。`,
    );
  }
  await notifyOperators(`📅 新しい予約\n${friend?.display_name || name || "お客さま"}：${label}${note ? `\nメモ：${note.slice(0, 100)}` : ""}`);
  return (await get<Booking>("SELECT * FROM bookings WHERE id = ?", lastId))!;
}

/** 予約を取り消す。friendId を渡すと、その人の予約だけ取り消せる（友だちが自分で取り消す時） */
export async function cancelBooking(id: number, friendId?: number): Promise<boolean> {
  const b = await get<Booking & { starts_at: number; minutes: number }>(
    "SELECT b.*, s.starts_at, s.minutes FROM bookings b JOIN booking_slots s ON s.id = b.slot_id WHERE b.id = ? AND b.status = 'booked'",
    id,
  );
  if (!b || (friendId !== undefined && b.friend_id !== friendId)) return false;
  await run("UPDATE bookings SET status = 'canceled' WHERE id = ?", id);
  if (friendId !== undefined) {
    const friend = await get<Friend>("SELECT * FROM friends WHERE id = ?", friendId);
    await notifyOperators(`🗓 予約のキャンセル\n${friend?.display_name || b.name || "お客さま"}：${slotLabel(b)}`);
  }
  return true;
}

/** 開始の○時間前のリマインド（定期実行から呼ぶ） */
export async function sendBookingReminders(now = Date.now()) {
  const { remindHours, title } = await bookingSettings();
  if (!remindHours) return;
  const due = await all<Booking & { starts_at: number; minutes: number }>(
    `SELECT b.*, s.starts_at, s.minutes FROM bookings b JOIN booking_slots s ON s.id = b.slot_id
     WHERE b.status = 'booked' AND b.reminded = 0 AND b.friend_id IS NOT NULL AND s.starts_at > ? AND s.starts_at <= ?`,
    now,
    now + remindHours * 3600_000,
  );
  for (const b of due) {
    await run("UPDATE bookings SET reminded = 1 WHERE id = ?", b.id);
    const friend = await get<Friend>("SELECT * FROM friends WHERE id = ? AND blocked = 0", b.friend_id);
    if (friend) await safePush(friend, `⏰ ${title}のお知らせ\n日時：${slotLabel(b)}\nお待ちしています！`);
  }
}

/** 管理画面：枠をまとめて作る（日付 × 時刻のすべての組み合わせ） */
export async function createSlots(dates: string[], times: string[], minutes: number, capacity: number): Promise<number> {
  let n = 0;
  for (const d of dates) {
    for (const t of times) {
      const ms = new Date(`${d}T${t}:00+09:00`).getTime();
      if (!Number.isFinite(ms) || ms <= Date.now()) continue;
      const exists = await get("SELECT id FROM booking_slots WHERE starts_at = ?", ms);
      if (exists) continue;
      await run("INSERT INTO booking_slots (starts_at, minutes, capacity, created_at) VALUES (?, ?, ?, ?)", ms, minutes, capacity, Date.now());
      n++;
    }
  }
  return n;
}
