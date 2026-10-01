import { aiAvailable, generateAiReply } from "./ai";
import { db } from "./db";
import { getFriendByLineId, markUnfollowed, upsertFriend } from "./friends";
import { logMessage, replyToFriend } from "./messaging";
import { enrollByFollow } from "./scenarios";
import { addTag } from "./tags";
import type { AutoReply, Friend } from "./types";

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
}

function matchAutoReply(text: string): AutoReply | undefined {
  const rules = db().prepare("SELECT * FROM auto_replies WHERE enabled = 1 ORDER BY id").all() as AutoReply[];
  const t = text.trim();
  return (
    rules.find((r) => r.match_type === "exact" && r.keyword === t) ??
    rules.find((r) => r.match_type === "contains" && t.includes(r.keyword))
  );
}

async function ensureFriend(userId: string): Promise<Friend> {
  return getFriendByLineId(userId) ?? (await upsertFriend(userId, false)).friend;
}

async function handleText(friend: Friend, text: string, replyToken?: string) {
  logMessage(friend.id, "in", text, "user");

  const rule = matchAutoReply(text);
  if (rule) {
    db().prepare("UPDATE auto_replies SET hit_count = hit_count + 1 WHERE id = ?").run(rule.id);
    if (rule.add_tag_id) addTag(friend.id, rule.add_tag_id);
    if (replyToken) await replyToFriend(friend, replyToken, rule.reply, "auto");
    return;
  }

  if (replyToken && friend.ai_enabled && aiAvailable()) {
    const answer = await generateAiReply(friend);
    if (answer) await replyToFriend(friend, replyToken, answer, "ai");
  }
}

export async function handleEvent(ev: LineEvent) {
  const userId = ev.source?.userId;
  if (!userId || ev.source?.type !== "user") return;

  switch (ev.type) {
    case "follow": {
      const { friend } = await upsertFriend(userId, true);
      enrollByFollow(friend.id);
      break;
    }
    case "unfollow":
      markUnfollowed(userId);
      break;
    case "message": {
      const friend = await ensureFriend(userId);
      if (ev.message?.type === "text" && ev.message.text) {
        await handleText(friend, ev.message.text, ev.replyToken);
      } else {
        logMessage(friend.id, "in", `[${ev.message?.type ?? "unknown"}]`, "user");
      }
      break;
    }
    case "postback": {
      // data 例: "tag=3"  → タグ付与
      const friend = await ensureFriend(userId);
      const params = new URLSearchParams(ev.postback?.data ?? "");
      const tagId = Number(params.get("tag"));
      if (tagId) addTag(friend.id, tagId);
      break;
    }
  }
}
