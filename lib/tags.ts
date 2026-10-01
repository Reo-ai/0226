import { db } from "./db";
import { enrollByTag } from "./scenarios";

/** タグ付与。新たに付いた場合はタグトリガーのシナリオを開始する */
export function addTag(friendId: number, tagId: number): boolean {
  const info = db()
    .prepare("INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, created_at) VALUES (?, ?, ?)")
    .run(friendId, tagId, Date.now());
  if (info.changes > 0) {
    enrollByTag(friendId, tagId);
    return true;
  }
  return false;
}

export function removeTag(friendId: number, tagId: number) {
  db().prepare("DELETE FROM friend_tags WHERE friend_id = ? AND tag_id = ?").run(friendId, tagId);
}
