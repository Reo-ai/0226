// 未返信の管理と、運用者への新着通知
// - キーワード応答・習慣・AI で返事ができなかったメッセージは「要返信」にする（未返信の一覧に出る）
// - 通知を受け取る LINE（運用者）には、その公式LINEから新着をお知らせする（同じ友だちからは10分に1回まで）
import crypto from "node:crypto";
import { all, get, getSetting, run, setSetting } from "./db";
import type { Outbox } from "./delivery";
import { pushToFriend } from "./delivery";
import { baseUrl } from "./env";
import type { Friend } from "./types";

const TARGETS = "notify.friend_ids";
const CODE = "notify.register_code";
const COOLDOWN_MS = 10 * 60 * 1000;

export async function notifyTargets(): Promise<number[]> {
  return (await getSetting(TARGETS))
    .split(",")
    .map(Number)
    .filter((n) => n > 0);
}

/** 通知登録用の6桁コード（30分有効）を発行する */
export async function issueNotifyCode(): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await setSetting(CODE, `${code}.${Date.now() + 30 * 60 * 1000}`);
  return code;
}

export async function currentNotifyCode(): Promise<string | null> {
  const [code, exp] = (await getSetting(CODE)).split(".");
  return code && Date.now() < Number(exp) ? code : null;
}

export async function removeNotifyTarget(friendId: number) {
  const ids = (await notifyTargets()).filter((id) => id !== friendId);
  await setSetting(TARGETS, ids.join(","));
}

/** 「通知登録 123456」「通知解除」を処理する（運用者が自分の LINE から送る） */
export async function handleNotifyCommand(box: Outbox, friend: Friend, text: string): Promise<boolean> {
  const reg = text.match(/^通知登録\s*(\d{6})$/);
  if (reg) {
    const current = await currentNotifyCode();
    if (!current || current !== reg[1]) {
      box.add("コードが違うか、期限が切れています。管理画面の「設定・AI」で新しいコードを出してください。", "auto");
      return true;
    }
    const ids = await notifyTargets();
    if (!ids.includes(friend.id)) await setSetting(TARGETS, [...ids, friend.id].join(","));
    await setSetting(CODE, "");
    box.add("このLINEに、新しいメッセージの通知が届くようになりました🔔\n止めるときは「通知解除」と送ってください。", "auto");
    return true;
  }
  if (text === "通知解除" && (await notifyTargets()).includes(friend.id)) {
    await removeNotifyTarget(friend.id);
    box.add("新着の通知を止めました。", "auto");
    return true;
  }
  return false;
}

/** 返事ができなかったメッセージ：要返信にして、運用者に通知する */
export async function markNeedsReply(friend: Friend, text: string) {
  const targets = await notifyTargets();
  if (targets.includes(friend.id)) return; // 運用者自身のメッセージは対象外
  await run("UPDATE friends SET needs_reply = 1, needs_reply_at = ? WHERE id = ?", Date.now(), friend.id);
  if (targets.length === 0) return;
  const lastKey = `notify.last.${friend.id}`;
  if (Date.now() - Number(await getSetting(lastKey, "0")) < COOLDOWN_MS) return;
  await setSetting(lastKey, String(Date.now()));
  const msg = `💬 新しいメッセージ\n${friend.display_name || "友だち"}：${text.slice(0, 120)}\n\n返信する → ${baseUrl()}/friends/${friend.id}`;
  for (const id of targets) {
    const to = await get<Friend>("SELECT * FROM friends WHERE id = ? AND blocked = 0", id);
    if (!to) continue;
    try {
      await pushToFriend(to, msg, "manual");
    } catch (e) {
      // 配信数が尽きたら通知はしない（未返信の一覧には残る）
      console.error("新着通知を送れませんでした", e);
    }
  }
}

export async function clearNeedsReply(friendId: number) {
  await run("UPDATE friends SET needs_reply = 0 WHERE id = ?", friendId);
}

export async function unrepliedCount(): Promise<number> {
  return (await get<{ n: number }>("SELECT COUNT(*) n FROM friends WHERE needs_reply = 1 AND blocked = 0"))?.n ?? 0;
}

export async function unrepliedFriends() {
  return all<Friend & { needs_reply_at: number; last_text: string | null }>(
    `SELECT f.*, (SELECT content FROM messages m WHERE m.friend_id = f.id AND m.direction = 'in' ORDER BY m.id DESC LIMIT 1) AS last_text
     FROM friends f WHERE f.needs_reply = 1 AND f.blocked = 0 ORDER BY f.needs_reply_at DESC`,
  );
}
