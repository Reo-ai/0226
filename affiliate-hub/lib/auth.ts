import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "admin_session";

function sessionValue(): string {
  const secret = process.env.SESSION_SECRET || "";
  const password = process.env.ADMIN_PASSWORD || "";
  return crypto.createHmac("sha256", secret).update(`admin:${password}`).digest("base64url");
}

export function checkPassword(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !process.env.SESSION_SECRET) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(password);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  (await cookies()).delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const expected = sessionValue();
  return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
}

export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}
