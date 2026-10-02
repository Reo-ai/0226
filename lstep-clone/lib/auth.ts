import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";
const GUEST_COOKIE = "guest_view";

function sessionValue(): string {
  const secret = process.env.SESSION_SECRET || "";
  const password = process.env.ADMIN_PASSWORD || "";
  return crypto.createHmac("sha256", secret).update(`admin:${password}`).digest("base64url");
}

export async function setSession() {
  (await cookies()).set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(GUEST_COOKIE);
}

/** ログインなしの閲覧（読み取り専用）を許可しているか。本物の友だちデータが入る前に OFF にする */
export function guestViewEnabled(): boolean {
  return process.env.GUEST_VIEW_ENABLED === "1";
}

export async function setGuestSession() {
  (await cookies()).set(GUEST_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function isGuest(): Promise<boolean> {
  return guestViewEnabled() && (await cookies()).get(GUEST_COOKIE)?.value === "1";
}

export async function isAuthed(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const expected = sessionValue();
  return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
}

/** 書き込み・個人情報の出力用。ゲストは通さない */
export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}

/** 画面の閲覧用。ゲスト閲覧中なら通し、その状態を返す */
export async function requireViewer(): Promise<{ guest: boolean }> {
  if (await isAuthed()) return { guest: false };
  if (await isGuest()) return { guest: true };
  redirect("/login");
}
