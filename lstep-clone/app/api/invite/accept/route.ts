import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE, validInvite } from "@/lib/invites";

export const runtime = "nodejs";

// 招待ページの「LINEでログインして始める」：招待コードを覚えてから LINE ログインへ
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!(await validInvite(code))) redirect("/login?line=invite_invalid");
  (await cookies()).set(INVITE_COOKIE, code!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  redirect("/api/auth/line");
}
