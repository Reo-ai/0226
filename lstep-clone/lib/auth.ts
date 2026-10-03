import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSetting, mainAll, mainGet } from "./db";
import { adminLineIds } from "./lineConfig";
import { currentWorkspace, isValidWorkspaceId, MAIN, runInWorkspace } from "./workspace";

const COOKIE = "admin_session";
const GUEST_COOKIE = "guest_view";
/** いま操作しているワークスペース（proxy.ts がこれを見てリクエストに付ける） */
export const WS_COOKIE = "ws";

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

function sign(lineUserId: string): string {
  return crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(`session:${lineUserId}`)
    .digest("base64url");
}

/** ログインを保つ期間（3か月。管理画面を開くたびに proxy.ts が延長する） */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

/** ログインした LINE ユーザーを Cookie に記録する（署名付き・ログインしたまま） */
export async function setSession(lineUserId: string, ws?: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${lineUserId}.${sign(lineUserId)}`, cookieOpts(SESSION_MAX_AGE));
  if (ws) jar.set(WS_COOKIE, ws, cookieOpts(60 * 60 * 24 * 365));
}

export async function setWorkspaceCookie(ws: string) {
  (await cookies()).set(WS_COOKIE, ws, cookieOpts(60 * 60 * 24 * 365));
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(GUEST_COOKIE);
}

/** Cookie からログイン中の LINE ユーザーIDを取り出す（署名が合わなければ null） */
export async function sessionUser(): Promise<string | null> {
  if (!process.env.SESSION_SECRET) return null;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return null;
  const i = v.lastIndexOf(".");
  if (i <= 0) return null;
  const user = v.slice(0, i);
  const given = v.slice(i + 1);
  const expected = sign(user);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)) ? user : null;
}

/** その LINE ユーザーが使えるワークスペース一覧（main は内海さんの場所） */
export async function workspacesOf(lineUserId: string): Promise<{ id: string; name: string }[]> {
  const list: { id: string; name: string }[] = [];
  if ((await runInWorkspace(MAIN, adminLineIds)).includes(lineUserId)) {
    const name = await runInWorkspace(MAIN, () => getSetting("workspace.name", "メイン"));
    list.push({ id: MAIN, name: name || "メイン" });
  }
  const rows = await mainAll<{ id: string; name: string }>(
    `SELECT w.id, w.name FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.line_user_id = ? ORDER BY w.created_at`,
    lineUserId,
  );
  return [...list, ...rows];
}

/** ログインなしの閲覧（読み取り専用）を許可しているか。main（内海さんの場所）だけで使える */
export function guestViewEnabled(): boolean {
  return process.env.GUEST_VIEW_ENABLED === "1";
}

export async function setGuestSession() {
  const jar = await cookies();
  jar.set(GUEST_COOKIE, "1", cookieOpts(60 * 60 * 24));
  jar.set(WS_COOKIE, MAIN, cookieOpts(60 * 60 * 24 * 365));
}

export async function isGuest(): Promise<boolean> {
  return (
    guestViewEnabled() && (await currentWorkspace()) === MAIN && (await cookies()).get(GUEST_COOKIE)?.value === "1"
  );
}

/** ログインしていて、いまのワークスペースのメンバーか */
export async function isAuthed(): Promise<boolean> {
  const user = await sessionUser();
  if (!user) return false;
  return (await adminLineIds()).includes(user);
}

export type Role = "owner" | "staff";
export const FLASH_COOKIE = "flash";

/**
 * いまの場所での役割。owner＝すべて操作できる／staff＝友だち対応（トーク・タグ・メモ・情報欄・予約）だけ
 * main は設定・環境変数の管理者が owner、workspace_members に入っている人はその役割
 */
export async function currentRole(): Promise<Role | null> {
  const user = await sessionUser();
  if (!user || !(await isAuthed())) return null;
  const ws = await currentWorkspace();
  const m = await mainGet<{ role: string }>("SELECT role FROM workspace_members WHERE workspace_id = ? AND line_user_id = ?", ws, user);
  return m?.role === "staff" ? "staff" : "owner";
}

/** 新しい場所（公式LINEごとの管理画面）の招待を作れる人：main のオーナー（スタッフは不可） */
export async function canCreateWorkspaces(user: string | null): Promise<boolean> {
  if (!user || !(await runInWorkspace(MAIN, adminLineIds)).includes(user)) return false;
  const staff = await mainGet("SELECT 1 FROM workspace_members WHERE workspace_id = ? AND line_user_id = ? AND role = 'staff'", MAIN, user);
  return !staff;
}

/** オーナーだけの操作（設定・配信・削除・メンバー管理など） */
export async function requireOwner() {
  const role = await currentRole();
  if (!role) redirect("/login");
  if (role !== "owner") {
    // スタッフ：元の画面に戻して理由を出す
    const ref = (await headers()).get("referer");
    let back = "/inbox";
    try {
      if (ref) back = new URL(ref).pathname;
    } catch {
      // 読めなければ未返信の一覧へ
    }
    // どの画面でも上にお知らせを出す（管理画面のレイアウトが読む。数秒で消える）
    (await cookies()).set(FLASH_COOKIE, "owner_only", { path: "/", maxAge: 10, sameSite: "lax" });
    redirect(back);
  }
}

/** オーナーだけの画面：スタッフは未返信の一覧へ戻す（ゲスト閲覧は main の見学用なのでそのまま） */
export async function requireOwnerPage() {
  if ((await currentRole()) === "staff") redirect("/inbox");
}

/** 書き込み・個人情報の出力用。ゲストは通さない */
export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}

/** 画面の閲覧用。ゲスト閲覧中なら通し、その状態を返す */
export async function requireViewer(): Promise<{ guest: boolean }> {
  if (await isAuthed()) return { guest: false };
  if (await isGuest()) return { guest: true };
  // ログインはしているが、選んでいる場所のメンバーではない（Cookie が古いなど）→ 自分の場所へ
  const user = await sessionUser();
  if (user) {
    const mine = await workspacesOf(user);
    const ws = (await cookies()).get(WS_COOKIE)?.value;
    if (mine.length > 0 && (!isValidWorkspaceId(ws) || !mine.some((m) => m.id === ws))) {
      redirect(`/api/workspace/switch?ws=${mine[0].id}`);
    }
  }
  redirect("/login");
}
