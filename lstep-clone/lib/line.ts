import crypto from "node:crypto";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";
const MULTICAST_LIMIT = 500;
/** 1回の送信で送れる吹き出しの上限（LINEの仕様） */
export const MAX_BUBBLES = 5;

export type LineMessage =
  | { type: "text"; text: string }
  | { type: "image"; originalContentUrl: string; previewImageUrl: string };

export function hasToken(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

interface CallOptions {
  method?: "GET" | "POST" | "DELETE";
  base?: string;
  raw?: { data: Uint8Array; contentType: string };
}

async function call(path: string, body?: unknown, opts: CallOptions = {}): Promise<unknown> {
  const method = opts.method ?? (body === undefined && !opts.raw ? "GET" : "POST");
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
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
  if (!hasToken()) return null;
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
  if (!res.ok) return null;
  const json = (await res.json()) as { sub?: string };
  return json.sub ?? null;
}
