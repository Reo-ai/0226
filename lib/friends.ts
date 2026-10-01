import crypto from "node:crypto";
import { all, get, run } from "./db";
import { getProfile } from "./line";
import type { Friend, Tag } from "./types";

export function getFriend(id: number) {
  return get<Friend>("SELECT * FROM friends WHERE id = ?", id);
}

export function getFriendByLineId(lineUserId: string) {
  return get<Friend>("SELECT * FROM friends WHERE line_user_id = ?", lineUserId);
}

export function getFriendByToken(token: string) {
  return get<Friend>("SELECT * FROM friends WHERE token = ?", token);
}

/** 友だち登録・更新。refollow=true なら再追加（ブロック解除）扱い */
export async function upsertFriend(lineUserId: string, refollow: boolean) {
  const profile = await getProfile(lineUserId);
  const existing = await getFriendByLineId(lineUserId);
  if (existing) {
    await run(
      `UPDATE friends SET
         display_name = COALESCE(?, display_name),
         picture_url = COALESCE(?, picture_url),
         status_message = COALESCE(?, status_message),
         blocked = CASE WHEN ? THEN 0 ELSE blocked END,
         unfollowed_at = CASE WHEN ? THEN NULL ELSE unfollowed_at END
       WHERE id = ?`,
      profile?.displayName ?? null,
      profile?.pictureUrl ?? null,
      profile?.statusMessage ?? null,
      refollow ? 1 : 0,
      refollow ? 1 : 0,
      existing.id,
    );
    return { friend: (await getFriend(existing.id))!, isNew: false };
  }
  const { lastId } = await run(
    `INSERT INTO friends (line_user_id, token, display_name, picture_url, status_message, followed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    lineUserId,
    crypto.randomBytes(12).toString("base64url"),
    profile?.displayName ?? "",
    profile?.pictureUrl ?? null,
    profile?.statusMessage ?? null,
    Date.now(),
  );
  return { friend: (await getFriend(lastId))!, isNew: true };
}

export async function markUnfollowed(lineUserId: string) {
  const f = await getFriendByLineId(lineUserId);
  if (!f) return;
  await run("UPDATE friends SET blocked = 1, unfollowed_at = ? WHERE id = ?", Date.now(), f.id);
  await run(
    "UPDATE enrollments SET status = 'stopped', next_run_at = NULL WHERE friend_id = ? AND status = 'active'",
    f.id,
  );
  await run("DELETE FROM pending_messages WHERE friend_id = ?", f.id);
}

export function friendTags(friendId: number) {
  return all<Tag & { tagged_at: number }>(
    `SELECT t.*, ft.created_at tagged_at FROM tags t JOIN friend_tags ft ON ft.tag_id = t.id
     WHERE ft.friend_id = ? ORDER BY t.name`,
    friendId,
  );
}

/** 配信対象: ブロックしていない友だち。tagIds 指定時はいずれかのタグを持つ人 */
export function targetFriends(tagIds: number[]) {
  if (tagIds.length === 0) {
    return all<Friend>("SELECT * FROM friends WHERE blocked = 0");
  }
  const ph = tagIds.map(() => "?").join(",");
  return all<Friend>(
    `SELECT * FROM friends WHERE blocked = 0 AND id IN
       (SELECT friend_id FROM friend_tags WHERE tag_id IN (${ph}))`,
    ...tagIds,
  );
}
