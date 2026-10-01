import { db } from "./db";
import { targetFriends } from "./friends";
import { sendToMany } from "./messaging";
import type { Broadcast } from "./types";

export async function sendBroadcast(b: Broadcast) {
  const claimed = db()
    .prepare("UPDATE broadcasts SET status = 'sending' WHERE id = ? AND status = 'scheduled'")
    .run(b.id);
  if (claimed.changes === 0) return; // 他プロセスが処理中
  const friends = targetFriends(JSON.parse(b.tag_ids) as number[]);
  try {
    await sendToMany(friends, b.content, "broadcast", b.id);
    db()
      .prepare("UPDATE broadcasts SET status = 'sent', sent_at = ?, recipient_count = ? WHERE id = ?")
      .run(Date.now(), friends.length, b.id);
  } catch (e) {
    console.error(`broadcast ${b.id} failed`, e);
    db().prepare("UPDATE broadcasts SET status = 'failed' WHERE id = ?").run(b.id);
  }
}

export async function processDueBroadcasts(now = Date.now()) {
  const due = db()
    .prepare("SELECT * FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= ?")
    .all(now) as Broadcast[];
  for (const b of due) await sendBroadcast(b);
}
