import { all, run } from "./db";
import { pushToMany, queuePending } from "./delivery";
import { parseSegment, segmentFriends } from "./segment";
import { QuotaError } from "./quota";
import type { Broadcast } from "./types";

export async function sendBroadcast(b: Broadcast) {
  const claimed = await run("UPDATE broadcasts SET status = 'sending' WHERE id = ? AND status = 'scheduled'", b.id);
  if (claimed.changes === 0) return; // 他プロセスが処理中
  const friends = await segmentFriends(parseSegment(b.tag_ids));
  try {
    if (b.delivery === "reply") {
      // 無料配信: 次に反応があった時に応答メッセージで届ける
      await queuePending(
        friends.map((f) => f.id),
        [{ content: b.content, source: "broadcast", refId: b.id }],
      );
    } else {
      await pushToMany(friends, b.content, "broadcast", b.id);
    }
    await run(
      "UPDATE broadcasts SET status = 'sent', sent_at = ?, recipient_count = ? WHERE id = ?",
      Date.now(),
      friends.length,
      b.id,
    );
  } catch (e) {
    console.error(`broadcast ${b.id} failed`, e);
    await run(
      "UPDATE broadcasts SET status = 'failed', error = ? WHERE id = ?",
      e instanceof QuotaError ? e.message : String(e),
      b.id,
    );
  }
}

export async function processDueBroadcasts(now = Date.now()) {
  const due = await all<Broadcast>("SELECT * FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= ?", now);
  for (const b of due) await sendBroadcast(b);
}
