/** APP_PASSWORD を設定したときのログイン用トークン（Web Crypto なので proxy でも使える） */
export const SESSION_COOKIE = "pilot_session";

export async function sessionToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("affiliate-pilot-session-v1"));
  return Buffer.from(sig).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
