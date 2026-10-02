// 管理画面の「LINEでログイン」（LINEログイン v2.1 の認可コードフロー）
import { baseUrl } from "./env";
import { verifyIdToken } from "./line";

export const STATE_COOKIE = "line_login_state";
export const DENIED_COOKIE = "line_login_denied";

/** LINEログインチャネルのIDとシークレットがそろっていれば有効 */
export function lineLoginEnabled(): boolean {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

export function callbackUrl(): string {
  return `${baseUrl()}/api/auth/line/callback`;
}

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_LOGIN_CHANNEL_ID || "",
    redirect_uri: callbackUrl(),
    state,
    scope: "profile openid",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${q}`;
}

/** 認可コードを IDトークンに交換し、検証済みの LINE ユーザーIDを返す */
export async function userIdFromCode(code: string): Promise<string | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(),
      client_id: process.env.LINE_LOGIN_CHANNEL_ID || "",
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET || "",
    }),
  });
  if (!res.ok) {
    console.error("LINEログイン: トークン交換に失敗", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { id_token?: string };
  const userId = json.id_token ? await verifyIdToken(json.id_token) : null;
  if (!userId) console.error("LINEログイン: IDトークンの検証に失敗", Boolean(json.id_token));
  return userId;
}
