// Stripe の決済完了通知（Webhook）で「購入済み」タグを自動で付ける
import crypto from "node:crypto";
import { get, getSetting, run } from "./db";
import { pushToFriend, queuePending } from "./delivery";
import { QuotaError } from "./quota";
import { currentWorkspace, MAIN } from "./workspace";
import { getFriendByToken } from "./friends";
import { addScore } from "./score";
import { addTag } from "./tags";

/** Stripe-Signature ヘッダー（t=時刻,v1=署名）を確かめる。5分より古い通知は受け付けない */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i), kv.slice(i + 1)];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const given = header
    .split(",")
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3));
  return given.some((g) => g.length === expected.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(expected)));
}

export const STRIPE_SECRET_KEY = "stripe.webhook_secret";
export const STRIPE_THANKS_KEY = "stripe.thanks_message";

/** その場所の署名シークレット（画面から登録）。main は環境変数でも可 */
export async function stripeWebhookSecret(): Promise<string> {
  const saved = await getSetting(STRIPE_SECRET_KEY);
  if (saved) return saved;
  return (await currentWorkspace()) === MAIN ? process.env.STRIPE_WEBHOOK_SECRET || "" : "";
}

const PURCHASE_TAG = process.env.PURCHASE_TAG_NAME || "購入済み";

/** 決済が完了した友だちに「購入済み」タグを付ける。付けた友だちのIDを返す（見つからなければ null） */
export async function markPurchased(friendToken: string | null | undefined): Promise<number | null> {
  if (!friendToken) return null;
  const friend = await getFriendByToken(friendToken);
  if (!friend) return null;
  let tag = await get<{ id: number }>("SELECT id FROM tags WHERE name = ?", PURCHASE_TAG);
  if (!tag) {
    await run("INSERT INTO tags (name, color) VALUES (?, ?)", PURCHASE_TAG, "#16a34a");
    tag = await get<{ id: number }>("SELECT id FROM tags WHERE name = ?", PURCHASE_TAG);
  }
  if (tag) await addTag(friend.id, tag.id);
  await addScore(friend.id, "purchase");
  // お礼のメッセージ（設定してあれば）
  const thanks = await getSetting(STRIPE_THANKS_KEY);
  if (thanks) {
    try {
      await pushToFriend(friend, thanks, "auto");
    } catch (e) {
      if (e instanceof QuotaError) await queuePending([friend.id], [{ content: thanks, source: "auto", refId: null }]);
      else console.error("購入のお礼を送れませんでした", e);
    }
  }
  return friend.id;
}
