// 応募リマインド：毎朝「今日20件応募しましょう」、毎晩「今日は20件応募できましたか？」を送る
//   「応募スタート」で始める（「応募リマインド オン」でも可）／「応募リマインド オフ」で止める
import { all, get, run } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { jstDateKey } from "./format";
import { QuotaError } from "./quota";
import type { Outbox } from "./delivery";
import type { Friend } from "./types";

/** 送る時刻（日本時間・時）。その時を過ぎて最初の定期実行で1回だけ送る */
const MORNING_HOUR = 9;
const NIGHT_HOUR = 20;
const MORNING = "今日20件応募しましょう";
const NIGHT = "今日は20件応募できましたか？";

interface ApplyGoal {
  friend_id: number;
  remind_enabled: number;
  last_noon_date: string | null;
  last_night_date: string | null;
}

const jstHour = (ms: number) => new Date(ms + 9 * 3600_000).getUTCHours();

/** 「応募スタート」「応募リマインド オン／オフ」を扱う。扱ったら true */
export async function handleApplyText(box: Outbox, friend: Friend, raw: string): Promise<boolean> {
  const text = raw.normalize("NFKC").trim();
  const on = /^応募(スタート|リマインド|リマインド\s*(オン|on|ON|再開))$/.test(text);
  const off = /^応募リマインド\s*(オフ|off|OFF|停止)$/.test(text);
  if (!on && !off) return false;
  const exists = await get<ApplyGoal>("SELECT * FROM apply_goals WHERE friend_id = ?", friend.id);
  if (exists) await run("UPDATE apply_goals SET remind_enabled = ? WHERE friend_id = ?", on ? 1 : 0, friend.id);
  else await run("INSERT INTO apply_goals (friend_id, remind_enabled, created_at) VALUES (?, ?, ?)", friend.id, on ? 1 : 0, Date.now());
  box.add(
    on
      ? `📮 応募リマインドを始めます。\n毎朝${MORNING_HOUR}時に「${MORNING}」、夜${NIGHT_HOUR}時に「${NIGHT}」とお送りします。\n止めるときは「応募リマインド オフ」と送ってください。`
      : "応募リマインドを止めました。再開するときは「応募スタート」と送ってください。",
    "auto",
  );
  return true;
}

/** 定期実行から呼ぶ：朝と夜に1回ずつ送る */
export async function sendApplyReminders(now = Date.now()) {
  const h = jstHour(now);
  const slot = h >= NIGHT_HOUR ? "night" : h >= MORNING_HOUR ? "morning" : null;
  if (!slot) return;
  const d = jstDateKey(now);
  // 朝の送信日は last_noon_date 列に記録する（列名は最初の版のまま）
  const col = slot === "morning" ? "last_noon_date" : "last_night_date";
  const due = await all<ApplyGoal & Friend>(
    `SELECT g.*, f.* FROM apply_goals g JOIN friends f ON f.id = g.friend_id
     WHERE g.remind_enabled = 1 AND f.blocked = 0 AND (g.${col} IS NULL OR g.${col} != ?)`,
    d,
  );
  const msg = slot === "morning" ? MORNING : NIGHT;
  for (const row of due) {
    await run(`UPDATE apply_goals SET ${col} = ? WHERE friend_id = ?`, d, row.friend_id);
    const friend = { ...row, id: row.friend_id } as unknown as Friend;
    try {
      await pushToFriend(friend, msg, "step");
    } catch (e) {
      if (e instanceof QuotaError) await queuePending([row.friend_id], [{ content: msg, source: "step", refId: null }]);
      else console.error("応募リマインドの送信に失敗", e);
    }
  }
}
