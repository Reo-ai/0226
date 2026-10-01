import crypto from "node:crypto";
import { db } from "./db";
import { getProfile } from "./line";
import type { Friend, Tag } from "./types";

export function getFriend(id: number): Friend | undefined {
  return db().prepare("SELECT * FROM friends WHERE id = ?").get(id) as Friend | undefined;
}

export function getFriendByLineId(lineUserId: string): Friend | undefined {
  return db().prepare("SELECT * FROM friends WHERE line_user_id = ?").get(lineUserId) as
    | Friend
    | undefined;
}

export function getFriendByToken(token: string): Friend | undefined {
  return db().prepare("SELECT * FROM friends WHERE token = ?").get(token) as Friend | undefined;
}

/** 友だち追加（再追加時はブロック解除扱い）。新規なら isNew = true */
export async function upsertFriend(lineUserId: string, refollow: boolean) {
  const profile = await getProfile(lineUserId);
  const existing = getFriendByLineId(lineUserId);
  const now = Date.now();
  if (existing) {
    db()
      .prepare(
        `UPDATE friends SET
           display_name = COALESCE(?, display_name),
           picture_url = COALESCE(?, picture_url),
           status_message = COALESCE(?, status_message),
           blocked = CASE WHEN ? THEN 0 ELSE blocked END,
           unfollowed_at = CASE WHEN ? THEN NULL ELSE unfollowed_at END
         WHERE id = ?`,
      )
      .run(
        profile?.displayName ?? null,
        profile?.pictureUrl ?? null,
        profile?.statusMessage ?? null,
        refollow ? 1 : 0,
        refollow ? 1 : 0,
        existing.id,
      );
    return { friend: getFriend(existing.id)!, isNew: false };
  }
  const info = db()
    .prepare(
      `INSERT INTO friends (line_user_id, token, display_name, picture_url, status_message, followed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      lineUserId,
      crypto.randomBytes(12).toString("base64url"),
      profile?.displayName ?? "",
      profile?.pictureUrl ?? null,
      profile?.statusMessage ?? null,
      now,
    );
  return { friend: getFriend(Number(info.lastInsertRowid))!, isNew: true };
}

export function markUnfollowed(lineUserId: string) {
  const f = getFriendByLineId(lineUserId);
  if (!f) return;
  db().prepare("UPDATE friends SET blocked = 1, unfollowed_at = ? WHERE id = ?").run(Date.now(), f.id);
  db()
    .prepare("UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE friend_id = ? AND status = 'active'")
    .run(f.id);
}

export function friendTags(friendId: number): Tag[] {
  return db()
    .prepare(
      "SELECT t.* FROM tags t JOIN friend_tags ft ON ft.tag_id = t.id WHERE ft.friend_id = ? ORDER BY t.name",
    )
    .all(friendId) as Tag[];
}

/** 配信対象: ブロックしていない友だち。tagIds 指定時はいずれかのタグを持つ人 */
export function targetFriends(tagIds: number[]): Friend[] {
  if (tagIds.length === 0) {
    return db().prepare("SELECT * FROM friends WHERE blocked = 0").all() as Friend[];
  }
  const ph = tagIds.map(() => "?").join(",");
  return db()
    .prepare(
      `SELECT * FROM friends WHERE blocked = 0 AND id IN
         (SELECT friend_id FROM friend_tags WHERE tag_id IN (${ph}))`,
    )
    .all(...tagIds) as Friend[];
}
