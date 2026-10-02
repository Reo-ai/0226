// 「公式LINEでログイン」: 管理者が公式LINEに「ログイン」と送ると、1回だけ使えるログインURLを返す
import crypto from "node:crypto";
import { getSetting, setSetting } from "./db";
import { baseUrl } from "./env";
import { allowedAdminIds } from "./lineLogin";

export const LOGIN_KEYWORD = "ログイン";
const TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(`magic:${payload}`)
    .digest("base64url");
}

/** 公式LINEのベーシックID（@xxxx）。友だち追加URLから取り出す */
export function basicId(): string | null {
  const m = (process.env.LINE_ADD_FRIEND_URL || "").match(/@[\w.-]+/);
  return m ? m[0] : null;
}

/** 公式LINEのトークを「ログイン」入力済みで開くURL */
export function officialChatUrl(): string | null {
  const id = basicId();
  return id ? `https://line.me/R/oaMessage/${id}/?${encodeURIComponent(LOGIN_KEYWORD)}` : null;
}

export function isAdminLineUser(lineUserId: string): boolean {
  return allowedAdminIds().includes(lineUserId);
}

export function createMagicUrl(): string {
  const payload = `${Date.now() + TTL_MS}.${crypto.randomBytes(12).toString("hex")}`;
  return `${baseUrl()}/api/auth/magic?t=${payload}.${sign(payload)}`;
}

/** 署名・期限・未使用を確かめ、使用済みにする */
export async function consumeMagicToken(token: string): Promise<boolean> {
  const [exp, nonce, sig] = token.split(".");
  if (!exp || !nonce || !sig || !process.env.SESSION_SECRET) return false;
  const expected = sign(`${exp}.${nonce}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  if (Date.now() > Number(exp)) return false;
  const key = `magic_used:${nonce}`;
  if (await getSetting(key)) return false;
  await setSetting(key, String(Date.now()));
  return true;
}
