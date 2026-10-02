import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setSession } from "@/lib/auth";
import { authorizeAdmin } from "@/lib/lineConfig";
import { DENIED_COOKIE, lineLoginEnabled, STATE_COOKIE, userIdFromCode } from "@/lib/lineLogin";

export const runtime = "nodejs";

// LINEから戻ってきたら、許可済みのユーザーだけ管理画面に入れる
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete({ name: STATE_COOKIE, path: "/api/auth/line" });

  const code = url.searchParams.get("code");
  if (!lineLoginEnabled() || !code || !expected || url.searchParams.get("state") !== expected) {
    redirect("/login?line=failed");
  }

  const userId = await userIdFromCode(code);
  if (!userId) redirect("/login?line=failed");

  if (!(await authorizeAdmin(userId))) {
    // 許可リストに追加できるよう、本人にだけ自分のIDを見せる（Cookie 経由・5分）
    jar.set(DENIED_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/login",
      maxAge: 300,
    });
    redirect("/login?line=denied");
  }

  await setSession();
  redirect("/dashboard");
}
