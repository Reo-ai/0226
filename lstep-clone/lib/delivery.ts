import { all, batch, run } from "./db";
import { isPersonalized, render, type Rendered } from "./content";
import { MAX_BUBBLES, multicast, push, reply } from "./line";
import { assertPushQuota } from "./quota";
import type { Channel, Friend, MessageSource } from "./types";
import { currentWorkspace } from "./workspace";
import { fieldValuesOf } from "./fields";

const PENDING_TTL = 14 * 86_400_000;

function logStmt(
  friendId: number,
  direction: "in" | "out",
  content: string,
  source: MessageSource,
  channel: Channel,
  refId: number | null,
  at = Date.now(),
) {
  return {
    sql: "INSERT INTO messages (friend_id, direction, content, source, channel, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [friendId, direction, content, source, channel, refId, at],
  };
}

export async function logIncoming(friendId: number, content: string) {
  const now = Date.now();
  await batch([
    logStmt(friendId, "in", content, "user", "none", null, now),
    { sql: "UPDATE friends SET last_message_at = ? WHERE id = ?", args: [now, friendId] },
  ]);
}

interface OutItem {
  rendered: Rendered;
  content: string;
  source: MessageSource;
  refId: number | null;
}

/**
 * Webhook処理中の送信キュー。
 * 最後に replyToken で「応答メッセージ（無料）」としてまとめて返す。
 * 5吹き出しに収まらない分は「保留」にして、次に相手から反応があった時に無料で届ける。
 */
export class Outbox {
  private items: OutItem[] = [];
  constructor(
    readonly friend: Friend,
    private readonly replyToken?: string,
    /** どのワークスペースの友だちか（公開ページの URL に ?w= を付ける） */
    private readonly ws = "main",
    /** 友だち情報欄（{{field:項目名}} 用） */
    private readonly fields: Record<string, string> = {},
  ) {}

  add(content: string, source: MessageSource, refId: number | null = null) {
    this.items.push({ rendered: render(content, this.friend, source, this.ws, this.fields, refId), content, source, refId });
  }

  get size() {
    return this.items.length;
  }

  async flush() {
    const fit: OutItem[] = [];
    const rest: OutItem[] = [];
    let bubbles = 0;
    for (const item of this.items) {
      const n = item.rendered.messages.length;
      if (this.replyToken && rest.length === 0 && bubbles + n <= MAX_BUBBLES) {
        fit.push(item);
        bubbles += n;
      } else {
        rest.push(item);
      }
    }
    this.items = [];
    if (fit.length > 0 && this.replyToken) {
      try {
        await reply(
          this.replyToken,
          fit.flatMap((i) => i.rendered.messages),
        );
        await batch(fit.map((i) => logStmt(this.friend.id, "out", i.rendered.text, i.source, "reply", i.refId)));
      } catch (e) {
        // 応答トークン期限切れ等: 失わずに次の反応時へ回す
        console.error("reply failed, queued for next interaction", e);
        rest.unshift(...fit);
      }
    }
    if (rest.length > 0) {
      await queuePending([this.friend.id], rest.map((i) => ({ content: i.content, source: i.source, refId: i.refId })));
    }
  }
}

/** 次に相手から反応があった時に無料で届けるメッセージを登録 */
export async function queuePending(
  friendIds: number[],
  items: { content: string; source: MessageSource; refId: number | null }[],
  ttl = PENDING_TTL,
) {
  const now = Date.now();
  const stmts = friendIds.flatMap((fid) =>
    items.map((i) => ({
      sql: "INSERT INTO pending_messages (friend_id, content, source, ref_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [fid, i.content, i.source, i.refId, now, now + ttl],
    })),
  );
  for (let i = 0; i < stmts.length; i += 200) await batch(stmts.slice(i, i + 200));
}

/** 保留中メッセージを Outbox に積む */
export async function collectPending(box: Outbox) {
  const now = Date.now();
  const rows = await all<{ id: number; content: string; source: MessageSource; ref_id: number | null }>(
    "SELECT id, content, source, ref_id FROM pending_messages WHERE friend_id = ? AND expires_at > ? ORDER BY id",
    box.friend.id,
    now,
  );
  for (const r of rows) box.add(r.content, r.source, r.ref_id);
  await run("DELETE FROM pending_messages WHERE friend_id = ?", box.friend.id);
}

/** 1人にプッシュ送信（1通消費） */
export async function pushToFriend(
  friend: Friend,
  content: string,
  source: MessageSource,
  refId: number | null = null,
) {
  await assertPushQuota(1);
  const r = render(content, friend, source, await currentWorkspace(), await fieldValuesOf(friend.id), refId);
  await push(friend.line_user_id, r.messages);
  await batch([logStmt(friend.id, "out", r.text, source, "push", refId)]);
}

/** 複数人へプッシュ送信（人数分消費）。個別変数が無ければ multicast でまとめて送る */
export async function pushToMany(
  friends: Friend[],
  content: string,
  source: MessageSource,
  refId: number | null = null,
) {
  if (friends.length === 0) return;
  await assertPushQuota(friends.length);
  const ws = await currentWorkspace();
  if (isPersonalized(content)) {
    for (const f of friends) {
      try {
        const r = render(content, f, source, ws, await fieldValuesOf(f.id), refId);
        await push(f.line_user_id, r.messages);
        await batch([logStmt(f.id, "out", r.text, source, "push", refId)]);
      } catch (e) {
        console.error(`push to friend ${f.id} failed`, e);
      }
    }
    return;
  }
  const r = render(content, null, source, ws, {}, refId);
  await multicast(
    friends.map((f) => f.line_user_id),
    r.messages,
  );
  const stmts = friends.map((f) => logStmt(f.id, "out", r.text, source, "push", refId));
  for (let i = 0; i < stmts.length; i += 200) await batch(stmts.slice(i, i + 200));
}
