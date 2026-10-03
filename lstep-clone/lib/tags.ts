import { run } from "./db";
import { syncRichMenu } from "./richmenu";
import { enrollByTag, stopByTag } from "./scenarios";
import { addScore } from "./score";

/** タグ付与。新たに付いた場合は停止条件のシナリオを止め、タグ起点シナリオ開始・リッチメニュー切替 */
export async function addTag(friendId: number, tagId: number): Promise<boolean> {
  const { changes } = await run(
    "INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, created_at) VALUES (?, ?, ?)",
    friendId,
    tagId,
    Date.now(),
  );
  if (changes === 0) return false;
  await stopByTag(friendId, tagId);
  await enrollByTag(friendId, tagId);
  await syncRichMenu(friendId);
  await addScore(friendId, "tag", tagId);
  return true;
}

export async function removeTag(friendId: number, tagId: number) {
  await run("DELETE FROM friend_tags WHERE friend_id = ? AND tag_id = ?", friendId, tagId);
  await syncRichMenu(friendId);
}
