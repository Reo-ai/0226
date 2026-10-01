import { db } from "./db";
import { multicast, push, reply, textMessage } from "./line";
import type { Friend, MessageSource } from "./types";

const PER_FRIEND_VAR = /\{\{\s*(name|link:[\w-]+)\s*\}\}/;

/** 本文中の変数を展開する: {{name}} / {{link:CODE}} */
export function renderContent(content: string, friend: Friend | null, source: MessageSource): string {
  const base = process.env.BASE_URL || "http://localhost:3000";
  return content
    .replace(/\{\{\s*name\s*\}\}/g, friend?.display_name || "")
    .replace(/\{\{\s*link:([\w-]+)\s*\}\}/g, (_, code: string) => {
      const params = new URLSearchParams({ s: source });
      if (friend) params.set("f", friend.token);
      return `${base}/r/${code}?${params}`;
    });
}

export function logMessage(
  friendId: number,
  direction: "in" | "out",
  content: string,
  source: MessageSource,
  refId: number | null = null,
) {
  const now = Date.now();
  db()
    .prepare(
      "INSERT INTO messages (friend_id, direction, content, source, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(friendId, direction, content, source, refId, now);
  if (direction === "in") {
    db().prepare("UPDATE friends SET last_message_at = ? WHERE id = ?").run(now, friendId);
  }
}

export async function sendToFriend(
  friend: Friend,
  content: string,
  source: MessageSource,
  refId: number | null = null,
) {
  const text = renderContent(content, friend, source);
  await push(friend.line_user_id, [textMessage(text)]);
  logMessage(friend.id, "out", text, source, refId);
}

export async function replyToFriend(
  friend: Friend,
  replyToken: string,
  content: string,
  source: MessageSource,
) {
  const text = renderContent(content, friend, source);
  await reply(replyToken, [textMessage(text)]);
  logMessage(friend.id, "out", text, source);
}

/** 複数人へ送信。個別変数が無ければ multicast でまとめて送る */
export async function sendToMany(
  friends: Friend[],
  content: string,
  source: MessageSource,
  refId: number | null = null,
) {
  if (friends.length === 0) return;
  if (PER_FRIEND_VAR.test(content)) {
    for (const f of friends) {
      try {
        await sendToFriend(f, content, source, refId);
      } catch (e) {
        console.error(`send to friend ${f.id} failed`, e);
      }
    }
    return;
  }
  const text = renderContent(content, null, source);
  await multicast(
    friends.map((f) => f.line_user_id),
    [textMessage(text)],
  );
  const log = db().transaction(() => {
    for (const f of friends) logMessage(f.id, "out", text, source, refId);
  });
  log();
}
