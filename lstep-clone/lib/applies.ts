// 応募リマインド：毎日お昼に「今日の20件を応募しましょう」、毎晩「今日は20件応募できましたか？」を送る
//   「応募スタート」で始める（「応募リマインド オン」でも可）／「応募リマインド オフ」で止める
//   夜の問いかけには「はい／いいえ」のボタンを付け、「いいえ」なら何件だったかを選んでもらい apply_logs に記録する
import { all, get, run } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { jstDateKey } from "./format";
import { getImageContent } from "./line";
import { QuotaError } from "./quota";
import { currentWorkspace, MAIN } from "./workspace";
import type { Outbox } from "./delivery";
import type { Friend } from "./types";

/** 送る時刻（日本時間・時）。その時を過ぎて最初の定期実行で1回だけ送る */
const MORNING_HOUR = 12;
const NIGHT_HOUR = 20;
const MORNING = "今日の20件を応募しましょう";
const NIGHT = "今日は20件応募できましたか？";
/** 夜に送る文（「はい／いいえ」のボタン付き） */
const NIGHT_MSG = `${NIGHT}\n選択肢: はい / いいえ`;
const GOAL = 20;
/** 写真1枚の上限（これより大きい時は縮小版を保存する） */
const PROOF_MAX_BYTES = 3 * 1024 * 1024;
const PROOF_ASK =
  "📸 最後にひとつ。応募を送ったページの写真（スクショ）を、このトークに送ってください。\n1枚で大丈夫です。パスワードや住所などは写さないようにしてください。";
/** 「いいえ」の後に出す件数ボタン（ボタンは最大13個。13件以上は数字で送ってもらう） */
const COUNT_CHOICES = Array.from({ length: 13 }, (_, i) => `${i}件`).join(" / ");

interface ApplyGoal {
  friend_id: number;
  remind_enabled: number;
  last_noon_date: string | null;
  last_night_date: string | null;
  proof_date: string | null;
}

const jstHour = (ms: number) => new Date(ms + 9 * 3600_000).getUTCHours();

/**
 * 夜の問いかけへの返事を受け付ける日。今日の夜に送っていればその日、
 * 日付が変わっても翌日のお昼の問いかけまでは前日の分として受け付ける。受け付けない時は null
 */
function answerDate(goal: ApplyGoal | undefined, now: number): string | null {
  if (!goal?.last_night_date) return null;
  const today = jstDateKey(now);
  if (goal.last_night_date === today) return today;
  const yesterday = jstDateKey(now - 86_400_000);
  if (goal.last_night_date === yesterday && jstHour(now) < MORNING_HOUR) return yesterday;
  return null;
}

async function recordApplies(friendId: number, date: string, count: number) {
  await run(
    `INSERT INTO apply_logs (friend_id, date, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(friend_id, date) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    friendId,
    date,
    count,
    Date.now(),
  );
}

function countReply(n: number): string {
  if (n >= GOAL) return `🎉 ${n}件、達成です！\n今日もよくやり切りました。この積み重ねが案件につながります。\n明日もお昼にお知らせします。`;
  if (n === 0) return "📮 0件で記録しました。\n正直に記録できたことが、もう一歩です。明日は1件だけでも応募してみましょう。";
  return `📮 ${n}件、記録しました。目標まであと${GOAL - n}件でした。\n0件の日より確実に前に進んでいます。明日のお昼にまたお知らせします。`;
}

/** 夜の問いかけへの返事（はい／いいえ／○件）。扱ったら true */
async function handleNightAnswer(box: Outbox, friend: Friend, text: string): Promise<boolean> {
  const yes = /^はい$/.test(text); // 「できた」は習慣トラッカーの言葉なので使わない
  const no = /^いいえ$/.test(text);
  const num = text.match(/^(\d{1,3})\s*件?$/);
  if (!yes && !no && !num) return false;
  const goal = await get<ApplyGoal>("SELECT * FROM apply_goals WHERE friend_id = ?", friend.id);
  const date = answerDate(goal, Date.now());
  if (!date) return false; // 夜の問いかけの後でなければ、ほかの機能（習慣・キーワード応答）に回す
  if (no) {
    box.add(`教えてくれてありがとうございます。\n今日は何件応募できましたか？\n13件以上なら「15件」のように送ってください。\n選択肢: ${COUNT_CHOICES}`, "auto");
    return true;
  }
  const n = yes ? GOAL : Number(num![1]);
  await recordApplies(friend.id, date, n);
  box.add(countReply(n), "auto");
  // スキルクエスト２だけ：応募した証拠の写真をお願いする（0件の日は聞かない）
  if (n > 0 && (await currentWorkspace()) !== MAIN) {
    await run("UPDATE apply_goals SET proof_date = ? WHERE friend_id = ?", date, friend.id);
    box.add(PROOF_ASK, "auto");
  }
  return true;
}

/** 写真をお願いした後に届いた画像を、応募の証拠として残す。扱ったら true（それ以外の画像は今までどおり） */
export async function handleProofImage(box: Outbox, friend: Friend, messageId: string): Promise<boolean> {
  const goal = await get<ApplyGoal>("SELECT * FROM apply_goals WHERE friend_id = ?", friend.id);
  const date = answerDate(goal, Date.now());
  if (!goal?.proof_date || goal.proof_date !== date) return false;
  try {
    const img = await getImageContent(messageId, PROOF_MAX_BYTES);
    if (!img) throw new Error("画像を取得できません");
    // 続けて複数枚送られた時に返事を重ねない（1分以内の2枚目以降は黙って受け取る）
    const recent = await get<{ n: number }>(
      "SELECT COUNT(*) n FROM coach_proofs WHERE friend_id = ? AND created_at > ?",
      friend.id,
      Date.now() - 60_000,
    );
    await run(
      "INSERT INTO coach_proofs (friend_id, date, mime, data, created_at) VALUES (?, ?, ?, ?, ?)",
      friend.id,
      date,
      img.mime,
      img.data.toString("base64"),
      Date.now(),
    );
    if (!recent?.n) box.add("📸 受け取りました。今日もおつかれさまでした！\nほかにもあれば、続けて送ってください。", "auto");
  } catch (e) {
    console.error("応募の写真を保存できませんでした", e);
    box.add("写真をうまく受け取れませんでした。すみませんが、もう一度送ってください。", "auto");
  }
  return true;
}

/** 「応募スタート」「応募リマインド オン／オフ」と、夜の問いかけへの返事を扱う。扱ったら true */
export async function handleApplyText(box: Outbox, friend: Friend, raw: string): Promise<boolean> {
  const text = raw.normalize("NFKC").trim();
  if (await handleNightAnswer(box, friend, text)) return true;
  const on = /^応募(スタート|リマインド|リマインド\s*(オン|on|ON|再開))$/.test(text);
  const off = /^応募リマインド\s*(オフ|off|OFF|停止)$/.test(text);
  if (!on && !off) return false;
  const exists = await get<ApplyGoal>("SELECT * FROM apply_goals WHERE friend_id = ?", friend.id);
  if (exists) await run("UPDATE apply_goals SET remind_enabled = ? WHERE friend_id = ?", on ? 1 : 0, friend.id);
  else await run("INSERT INTO apply_goals (friend_id, remind_enabled, created_at) VALUES (?, ?, ?)", friend.id, on ? 1 : 0, Date.now());
  box.add(
    on
      ? `📮 応募リマインドを始めます。\n毎日${MORNING_HOUR}時（お昼）に「${MORNING}」、夜${NIGHT_HOUR}時に「${NIGHT}」とお送りします。\n止めるときは「応募リマインド オフ」と送ってください。`
      : "応募リマインドを止めました。再開するときは「応募スタート」と送ってください。",
    "auto",
  );
  return true;
}

/** 定期実行から呼ぶ：昼と夜に1回ずつ送る */
export async function sendApplyReminders(now = Date.now()) {
  const h = jstHour(now);
  const slot = h >= NIGHT_HOUR ? "night" : h >= MORNING_HOUR ? "morning" : null;
  if (!slot) return;
  const d = jstDateKey(now);
  // 昼の送信日は last_noon_date 列に記録する（列名は最初の版のまま）
  const col = slot === "morning" ? "last_noon_date" : "last_night_date";
  const due = await all<ApplyGoal & Friend>(
    `SELECT g.*, f.* FROM apply_goals g JOIN friends f ON f.id = g.friend_id
     WHERE g.remind_enabled = 1 AND f.blocked = 0 AND (g.${col} IS NULL OR g.${col} != ?)`,
    d,
  );
  const msg = slot === "morning" ? MORNING : NIGHT_MSG;
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
