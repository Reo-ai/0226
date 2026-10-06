// パソコンでログインしている状態を、スマホに引き継ぐ（QRコード または 6桁の番号）
// LINE公式アカウントのアプリでは「管理者かどうか」を外から確かめられないため、すでにログインしている画面から渡す
import crypto from "node:crypto";
import { setSession } from "./auth";
import { mainGet, mainRun } from "./db";

const TTL_MS = 5 * 60 * 1000;
/** 番号の打ち間違いがこの回数を超えたら、出ている番号をすべて無効にする（総当たり対策） */
const MAX_FAILS = 10;

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/** 引き継ぎ用のQR（トークン）と番号を作る */
export async function createHandoff(lineUserId: string, ws: string): Promise<{ token: string; code: string; expiresAt: number }> {
  await mainRun("DELETE FROM handoffs WHERE expires_at < ? OR used = 1", Date.now());
  // 同じ人の古い番号は消して、いつも1つだけにする
  await mainRun("DELETE FROM handoffs WHERE line_user_id = ?", lineUserId);
  const token = crypto.randomBytes(24).toString("base64url");
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    if (!(await mainGet("SELECT 1 FROM handoffs WHERE code = ? AND used = 0 AND expires_at > ?", code, Date.now()))) break;
  }
  const expiresAt = Date.now() + TTL_MS;
  await mainRun(
    "INSERT INTO handoffs (token_hash, code, line_user_id, workspace_id, expires_at) VALUES (?, ?, ?, ?, ?)",
    hash(token),
    code,
    lineUserId,
    ws,
    expiresAt,
  );
  return { token, code, expiresAt };
}

async function use(where: string, arg: string): Promise<boolean> {
  const row = await mainGet<{ token_hash: string; line_user_id: string; workspace_id: string }>(
    `SELECT token_hash, line_user_id, workspace_id FROM handoffs WHERE ${where} AND used = 0 AND expires_at > ? AND fails <= ?`,
    arg,
    Date.now(),
    MAX_FAILS,
  );
  if (!row) return false;
  const { changes } = await mainRun("UPDATE handoffs SET used = 1 WHERE token_hash = ? AND used = 0", row.token_hash);
  if (changes === 0) return false;
  await setSession(row.line_user_id, row.workspace_id);
  return true;
}

/** QRコードから：この画面をログイン済みにする */
export function redeemHandoffToken(token: string): Promise<boolean> {
  return use("token_hash = ?", hash(token));
}

/** 6桁の番号から：この画面をログイン済みにする。間違いは数えて、多すぎたら全部無効にする */
export async function redeemHandoffCode(code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  if (await use("code = ?", code)) return true;
  await mainRun("UPDATE handoffs SET fails = fails + 1 WHERE used = 0 AND expires_at > ?", Date.now());
  return false;
}
