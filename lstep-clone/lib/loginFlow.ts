// LINEログインを、どのブラウザに戻ってきても完了できるようにする
// iPhone では「ホーム画面のアプリ」「Safari」「LINEアプリ内のブラウザ」でログイン状態（Cookie）が別々なので、
// ログインを始めた画面に「受付票（rid と秘密の値）」を持たせ、LINEから戻った先で本人確認できたら、
// 始めた画面のほうが受付票を見せてログインを完了する（4桁の番号で同じ手続きか確かめる）
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { setSession, WS_COOKIE, workspacesOf } from "./auth";
import { mainGet, mainRun } from "./db";
import { acceptInvite, INVITE_COOKIE, validInvite } from "./invites";
import { authorizeAdmin } from "./lineConfig";
import { DENIED_COOKIE } from "./lineLogin";
import { MAIN, runInWorkspace } from "./workspace";

export const REQUEST_COOKIE = "login_req";
const TTL_MS = 10 * 60 * 1000;

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const cookieOpts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };

export interface LoginRequest {
  rid: string;
  code: string;
  line_user_id: string | null;
  display_name: string | null;
  approved: number;
  used: number;
  created_at: number;
}

/** ログインを始める：受付票を作り、この画面（Cookie）に秘密の値を持たせる。state として使う rid を返す */
export async function startLoginRequest(): Promise<string> {
  const rid = crypto.randomBytes(16).toString("hex");
  const secret = crypto.randomBytes(24).toString("base64url");
  const code = String(crypto.randomInt(1000, 10000));
  await mainRun("DELETE FROM login_requests WHERE created_at < ?", Date.now() - TTL_MS);
  await mainRun(
    "INSERT INTO login_requests (rid, secret_hash, code, created_at) VALUES (?, ?, ?, ?)",
    rid,
    hash(secret),
    code,
    Date.now(),
  );
  (await cookies()).set(REQUEST_COOKIE, `${rid}.${secret}`, cookieOpts);
  return rid;
}

export async function findRequest(rid: string | null | undefined): Promise<LoginRequest | undefined> {
  if (!rid || !/^[0-9a-f]{32}$/.test(rid)) return undefined;
  return mainGet<LoginRequest>("SELECT * FROM login_requests WHERE rid = ? AND created_at >= ?", rid, Date.now() - TTL_MS);
}

/** この画面が持っている受付票（秘密の値まで一致したものだけ） */
export async function ownRequest(): Promise<LoginRequest | undefined> {
  const v = (await cookies()).get(REQUEST_COOKIE)?.value;
  if (!v) return undefined;
  const [rid, secret] = v.split(".");
  const r = await findRequest(rid);
  if (!r || !secret) return undefined;
  const row = await mainGet<{ secret_hash: string }>("SELECT secret_hash FROM login_requests WHERE rid = ?", rid);
  return row && row.secret_hash === hash(secret) ? r : undefined;
}

/** LINEから戻った先で本人確認できた：受付票にだれかを記録する（承認はまだ） */
export async function attachUser(rid: string, userId: string, name: string) {
  await mainRun("UPDATE login_requests SET line_user_id = ?, display_name = ? WHERE rid = ? AND used = 0", userId, name, rid);
}

export async function approveRequest(rid: string) {
  await mainRun("UPDATE login_requests SET approved = 1 WHERE rid = ? AND line_user_id IS NOT NULL AND used = 0", rid);
}

/** 受付票を使い終わる（同じ票で二度ログインさせない）。使えたら true */
export async function consumeRequest(rid: string): Promise<boolean> {
  const { changes } = await mainRun("UPDATE login_requests SET used = 1 WHERE rid = ? AND used = 0", rid);
  (await cookies()).delete(REQUEST_COOKIE);
  return changes > 0;
}

/**
 * ログインを完了して、次に開く画面のパスを返す（招待の受け取り・使える場所の選択・ログイン状態の保存）
 * この関数を呼んだ画面（ブラウザ）にログイン状態が保存される
 */
export async function finishLogin(userId: string, name: string): Promise<string> {
  const jar = await cookies();
  // 招待リンクから来た人：その人専用の場所を作る（スタッフ招待なら今ある場所に入る）
  const invite = jar.get(INVITE_COOKIE)?.value;
  if (invite) {
    jar.delete(INVITE_COOKIE);
    const staffInvite = Boolean((await validInvite(invite))?.target_ws);
    let ws: string | null = null;
    try {
      ws = await acceptInvite(invite, userId, name);
    } catch (e) {
      console.error("招待の受け取りに失敗", e);
      return "/login?line=invite_error";
    }
    if (!ws) return "/login?line=invite_invalid";
    await setSession(userId, ws);
    return staffInvite ? "/inbox?welcome=1" : "/line?welcome=1";
  }
  // 内海さんの場所（main）：管理者がまだ誰もいなければ、最初にログインした人を管理者にする
  await runInWorkspace(MAIN, () => authorizeAdmin(userId));
  const mine = await workspacesOf(userId);
  if (mine.length === 0) {
    // 招待されていない人。本人にだけ自分のIDを見せる（Cookie 経由・5分）
    jar.set(DENIED_COOKIE, userId, { ...cookieOpts, path: "/login", maxAge: 300 });
    return "/login?line=denied";
  }
  const last = jar.get(WS_COOKIE)?.value;
  const ws = mine.find((m) => m.id === last)?.id ?? mine[0].id;
  await setSession(userId, ws);
  return "/dashboard";
}
