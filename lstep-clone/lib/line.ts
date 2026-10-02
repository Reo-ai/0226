import crypto from "node:crypto";
import { accessToken, lineConfig, lineConnected } from "./lineConfig";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";
const MULTICAST_LIMIT = 500;
/** 1回の送信で送れる吹き出しの上限（LINEの仕様） */
export const MAX_BUBBLES = 5;

export type LineMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

export async function hasToken(): Promise<boolean> {
  return lineConnected();
}

export async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  const secret = (await lineConfig()).channelSecret;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  base?: string;
  raw?: { data: Uint8Array; contentType: string };
}

async function call(path: string, body?: unknown, opts: CallOptions & { token?: string } = {}): Promise<unknown> {
  const method = opts.method ?? (body === undefined && !opts.raw ? "GET" : "POST");
  const t = opts.token ?? (await accessToken());
  if (!t) {
    // トークン未設定時はドライラン（ローカル開発用）
    console.log(`[line:dry-run] ${method} ${path}`, opts.raw ? `<${opts.raw.contentType}>` : JSON.stringify(body ?? null));
    return null;
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${t}` };
  let payload: BodyInit | undefined;
  if (opts.raw) {
    headers["Content-Type"] = opts.raw.contentType;
    payload = Buffer.from(opts.raw.data);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${opts.base ?? API}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    throw new Error(`LINE API ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ---- メッセージ送信 ----

/** 応答メッセージ（無料・通数にカウントされない） */
export function reply(replyToken: string, messages: LineMessage[]) {
  return call("/message/reply", { replyToken, messages });
}

/** プッシュメッセージ（1人1通としてカウント） */
export function push(to: string, messages: LineMessage[]) {
  return call("/message/push", { to, messages });
}

export async function multicast(to: string[], messages: LineMessage[]) {
  for (let i = 0; i < to.length; i += MULTICAST_LIMIT) {
    await call("/message/multicast", { to: to.slice(i, i + MULTICAST_LIMIT), messages });
  }
}

// ---- プロフィール・通数 ----

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

/** LINE側で集計された今月の通数 { limit: null=上限なし, used } */
export async function getQuota(): Promise<{ limit: number | null; used: number } | null> {
  if (!(await hasToken())) return null;
  try {
    const [q, c] = (await Promise.all([call("/message/quota"), call("/message/quota/consumption")])) as [
      { type: "none" | "limited"; value?: number },
      { totalUsage: number },
    ];
    return { limit: q.type === "limited" ? (q.value ?? 0) : null, used: c.totalUsage };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---- 連携・アカウント情報 ----

export interface BotInfo {
  basicId: string;
  displayName: string;
  pictureUrl?: string;
}

/** アクセストークンが正しいか確かめ、公式LINEの情報を返す（連携画面用） */
export async function fetchBotInfo(token: string): Promise<BotInfo> {
  return (await call("/info", undefined, { token })) as BotInfo;
}

/** Webhook URL を設定して、LINEから届くか試す */
export async function setupWebhook(token: string, endpoint: string): Promise<{ success: boolean; reason?: string }> {
  await call("/channel/webhook/endpoint", { endpoint }, { token, method: "PUT" });
  return (await call("/channel/webhook/test", { endpoint }, { token })) as { success: boolean; reason?: string };
}

export interface FollowerStats {
  date: string;
  followers: number;
  targetedReaches: number;
  blocks: number;
}

/** LINE公式が集計した友だち数（前日分。連携前からの友だちも含む） */
export async function getFollowerStats(): Promise<FollowerStats | null> {
  if (!(await hasToken())) return null;
  const d = new Date(Date.now() + 9 * 3600_000 - 86400_000);
  const date = d.toISOString().slice(0, 10).replace(/-/g, "");
  try {
    const r = (await call(`/insight/followers?date=${date}`)) as Partial<FollowerStats> & { status: string };
    if (r.status !== "ready") return null;
    return { date, followers: r.followers ?? 0, targetedReaches: r.targetedReaches ?? 0, blocks: r.blocks ?? 0 };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---- リッチメニュー（API呼び出しは無料） ----

export async function createRichMenu(def: unknown): Promise<string | null> {
  const res = (await call("/richmenu", def)) as { richMenuId: string } | null;
  return res?.richMenuId ?? null;
}

export function uploadRichMenuImage(richMenuId: string, data: Uint8Array, contentType: string) {
  return call(`/richmenu/${richMenuId}/content`, undefined, { base: DATA_API, raw: { data, contentType } });
}

export function deleteRichMenu(richMenuId: string) {
  return call(`/richmenu/${richMenuId}`, undefined, { method: "DELETE" });
}

export function setDefaultRichMenu(richMenuId: string) {
  return call(`/user/all/richmenu/${richMenuId}`, undefined, { method: "POST" });
}

export function clearDefaultRichMenu() {
  return call(`/user/all/richmenu`, undefined, { method: "DELETE" });
}

export function linkRichMenu(userId: string, richMenuId: string) {
  return call(`/user/${encodeURIComponent(userId)}/richmenu/${richMenuId}`, undefined, { method: "POST" });
}

export function unlinkRichMenu(userId: string) {
  return call(`/user/${encodeURIComponent(userId)}/richmenu`, undefined, { method: "DELETE" });
}

// ---- LINEログイン（LIFF）のIDトークン検証 ----

export async function verifyIdToken(idToken: string): Promise<string | null> {
  const clientId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!clientId) return null;
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: clientId }),
  });
  if (!res.ok) {
    console.error("IDトークン検証エラー", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { sub?: string };
  return json.sub ?? null;
}
