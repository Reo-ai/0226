"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, sessionToken } from "../session";
import type { ActionState } from "./form";

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const password = process.env.APP_PASSWORD;
  if (!password) redirect("/");
  const input = String(fd.get("password") ?? "");
  if (!safeEqual(await sessionToken(input), await sessionToken(password))) return { error: "パスワードが違います" };
  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const next = String(fd.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
