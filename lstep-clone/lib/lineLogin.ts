// 管理画面の「LINEでログイン」（LINEログイン v2.1 の認可コードフロー）
import { baseUrl } from "./env";

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

/** 認可コードを IDトークンに交換し、検証済みの LINE ユーザーIDと表示名を返す */
export async function profileFromCode(code: string): Promise<{ sub: string; name: string } | null> {
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
  const profile = json.id_token ? await verifyIdTokenProfile(json.id_token) : null;
  if (!profile) console.error("LINEログイン: IDトークンの検証に失敗", Boolean(json.id_token));
  return profile;
}

/** IDトークンを検証して、LINE ユーザーIDと表示名を返す */
async function verifyIdTokenProfile(idToken: string): Promise<{ sub: string; name: string } | null> {
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_LOGIN_CHANNEL_ID || "" }),
  });
  if (!res.ok) {
    console.error("IDトークン検証エラー", res.status, await res.text());
    return null;
  }
  const j = (await res.json()) as { sub?: string; name?: string };
  return j.sub ? { sub: j.sub, name: j.name ?? "" } : null;
}
