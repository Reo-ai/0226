import { aiAvailable, generateAiReply } from "./ai";
import { all, run } from "./db";
import { collectPending, logIncoming, Outbox } from "./delivery";
import { getFriendByLineId, markUnfollowed, upsertFriend } from "./friends";
import { createMagicUrl, isAdminLineUser, LOGIN_KEYWORD } from "./magicLogin";
import { syncRichMenu } from "./richmenu";
import { collectDueSteps, enrollByFollow } from "./scenarios";
import { attributeOnFollow } from "./sources";
import { addTag } from "./tags";
import type { AutoReply, Friend } from "./types";

export interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
  postback?: { data: string };
}

async function matchAutoReply(text: string): Promise<AutoReply | undefined> {
  const rules = await all<AutoReply>("SELECT * FROM auto_replies WHERE enabled = 1 ORDER BY id");
  const t = text.trim();
  return (
    rules.find((r) => r.match_type === "exact" && r.keyword === t) ??
    rules.find((r) => r.match_type === "contains" && t.includes(r.keyword))
  );
}

async function ensureFriend(userId: string): Promise<Friend> {
  return (await getFriendByLineId(userId)) ?? (await upsertFriend(userId, false)).friend;
}

async function handleText(box: Outbox, text: string) {
  const friend = box.friend;
  await logIncoming(friend.id, text);

  // 「公式LINEでログイン」: 管理者にだけ1回限りのログインURLを返す
  if (text.trim() === LOGIN_KEYWORD) {
    box.add(
      isAdminLineUser(friend.line_user_id)
        ? `スキルコーチの管理画面に入るリンクです（10分間・1回だけ有効）\n${createMagicUrl()}`
        : `このLINEアカウントは管理者として登録されていません。\n登録用ID: ${friend.line_user_id}`,
      "auto",
    );
    return;
  }

  const rule = await matchAutoReply(text);
  if (rule) {
    await run("UPDATE auto_replies SET hit_count = hit_count + 1 WHERE id = ?", rule.id);
    box.add(rule.reply, "auto");
    if (rule.add_tag_id) await addTag(friend.id, rule.add_tag_id);
    return;
  }
  if (friend.ai_enabled && (await aiAvailable())) {
    const answer = await generateAiReply(friend);
    if (answer) box.add(answer, "ai");
  }
}

async function handlePostback(box: Outbox, data: string) {
  const params = new URLSearchParams(data);
  const tagId = Number(params.get("tag"));
  if (tagId) await addTag(box.friend.id, tagId);
  const formId = Number(params.get("form"));
  if (formId) box.add(`こちらからご回答ください\n{{form:${formId}}}`, "form", formId);
}

/**
 * 1イベントを処理する。
 * 相手からの反応（友だち追加・メッセージ・ボタン）には必ず replyToken が付くので、
 * 返信・期限が来たステップ・保留中の配信をまとめて「応答メッセージ（無料）」で返す。
 */
export async function handleEvent(ev: LineEvent) {
  const userId = ev.source?.userId;
  if (!userId || ev.source?.type !== "user") return;

  if (ev.type === "unfollow") {
    await markUnfollowed(userId);
    return;
  }

  let friend: Friend;
  if (ev.type === "follow") {
    friend = (await upsertFriend(userId, true)).friend;
    await attributeOnFollow(friend);
    await enrollByFollow(friend.id);
    await syncRichMenu(friend.id);
  } else if (ev.type === "message" || ev.type === "postback") {
    friend = await ensureFriend(userId);
  } else {
    return;
  }

  const box = new Outbox(friend, ev.replyToken);
  if (ev.type === "message") {
    if (ev.message?.type === "text" && ev.message.text) await handleText(box, ev.message.text);
    else await logIncoming(friend.id, `[${ev.message?.type ?? "unknown"}]`);
  } else if (ev.type === "postback") {
    await handlePostback(box, ev.postback?.data ?? "");
  }
  await collectDueSteps(box);
  await collectPending(box);
  await box.flush();
}
