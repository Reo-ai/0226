import crypto from "node:crypto";

const API = "https://api.line.me/v2/bot";
const MULTICAST_LIMIT = 500;

export type LineMessage = { type: "text"; text: string };

export function textMessage(text: string): LineMessage {
  return { type: "text", text: text.slice(0, 5000) };
}

function token(): string | undefined {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || undefined;
}

export function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

async function call(path: string, body?: unknown): Promise<unknown> {
  const t = token();
  if (!t) {
    // トークン未設定時はドライラン（ローカル開発用）
    console.log(`[line:dry-run] ${path}`, JSON.stringify(body));
    return null;
  }
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LINE API ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** 応答メッセージ（無料・配信数にカウントされない） */
export function reply(replyToken: string, messages: LineMessage[]) {
  return call("/message/reply", { replyToken, messages });
}

export function push(to: string, messages: LineMessage[]) {
  return call("/message/push", { to, messages });
}

export async function multicast(to: string[], messages: LineMessage[]) {
  for (let i = 0; i < to.length; i += MULTICAST_LIMIT) {
    await call("/message/multicast", { to: to.slice(i, i + MULTICAST_LIMIT), messages });
  }
}

export interface LineProfile {
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export async function getProfile(userId: string): Promise<LineProfile | null> {
  try {
    return (await call(`/profile/${encodeURIComponent(userId)}`)) as LineProfile | null;
  } catch (e) {
    console.error(e);
    return null;
  }
}
