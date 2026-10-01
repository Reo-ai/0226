import { get, run } from "./db";
import { addTag } from "./tags";
import type { Friend, Source } from "./types";

const ATTRIBUTION_WINDOW = 7 * 86_400_000;

/** 流入経路の訪問を記録。既に友だちなら（経路未設定の場合）その場で紐付け */
export async function recordVisit(source: Source, lineUserId: string | null) {
  const friend = lineUserId
    ? await get<Friend>("SELECT * FROM friends WHERE line_user_id = ?", lineUserId)
    : undefined;
  const attributed = friend && !friend.blocked && friend.source_id == null;
  await run(
    "INSERT INTO source_visits (source_id, line_user_id, attributed, created_at) VALUES (?, ?, ?, ?)",
    source.id,
    lineUserId,
    attributed ? 1 : 0,
    Date.now(),
  );
  if (friend && attributed) await attribute(friend.id, source);
}

async function attribute(friendId: number, source: Source) {
  await run("UPDATE friends SET source_id = ? WHERE id = ? AND source_id IS NULL", source.id, friendId);
  if (source.add_tag_id) await addTag(friendId, source.add_tag_id);
}

/** 友だち追加時: 直近の訪問履歴から流入経路を確定する */
export async function attributeOnFollow(friend: Friend) {
  if (friend.source_id != null) return;
  const visit = await get<{ id: number; source_id: number }>(
    `SELECT id, source_id FROM source_visits
     WHERE line_user_id = ? AND attributed = 0 AND created_at >= ?
     ORDER BY created_at DESC LIMIT 1`,
    friend.line_user_id,
    Date.now() - ATTRIBUTION_WINDOW,
  );
  if (!visit) return;
  const source = await get<Source>("SELECT * FROM sources WHERE id = ?", visit.source_id);
  if (!source) return;
  await run("UPDATE source_visits SET attributed = 1 WHERE id = ?", visit.id);
  await attribute(friend.id, source);
}
