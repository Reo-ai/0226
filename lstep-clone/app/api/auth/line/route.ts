import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeUrl, lineLoginEnabled, STATE_COOKIE } from "@/lib/lineLogin";

export const runtime = "nodejs";

// LINEの認可画面へ送り出す（CSRF対策の state を Cookie に保存）
export async function GET() {
  if (!lineLoginEnabled()) redirect("/login");
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/line",
    maxAge: 600,
  });
  redirect(authorizeUrl(state));
}
