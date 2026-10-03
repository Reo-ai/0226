// Stripe の決済完了通知（Webhook）で「購入済み」タグを自動で付ける
import crypto from "node:crypto";
import { get, run } from "./db";
import { getFriendByToken } from "./friends";
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
  return friend.id;
}
