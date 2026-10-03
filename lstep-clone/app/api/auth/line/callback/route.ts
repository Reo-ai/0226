import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setSession, WS_COOKIE, workspacesOf } from "@/lib/auth";
import { acceptInvite, INVITE_COOKIE, validInvite } from "@/lib/invites";
import { authorizeAdmin } from "@/lib/lineConfig";
import { DENIED_COOKIE, lineLoginEnabled, profileFromCode, STATE_COOKIE } from "@/lib/lineLogin";
import { MAIN, runInWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";

// LINEから戻ってきたら：招待があれば専用の場所を作る／なければ自分が使える場所へ入れる
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete({ name: STATE_COOKIE, path: "/api/auth/line" });

  const code = url.searchParams.get("code");
  if (!lineLoginEnabled() || !code || !expected || url.searchParams.get("state") !== expected) {
    console.error("LINEログイン: 事前チェックで失敗", {
      enabled: lineLoginEnabled(),
      code: Boolean(code),
      stateCookie: Boolean(expected),
      stateMatch: url.searchParams.get("state") === expected,
      error: url.searchParams.get("error"),
    });
    redirect("/login?line=failed");
  }

  const profile = await profileFromCode(code);
  if (!profile) redirect("/login?line=failed");
  const userId = profile.sub;

  // 招待リンクから来た人：その人専用のワークスペースを作って、公式LINEの連携画面へ
  const invite = jar.get(INVITE_COOKIE)?.value;
  if (invite) {
    jar.delete(INVITE_COOKIE);
    const staffInvite = Boolean((await validInvite(invite))?.target_ws);
    let ws: string | null = null;
    try {
      ws = await acceptInvite(invite, userId, profile.name);
    } catch (e) {
      console.error("招待の受け取りに失敗", e);
      redirect("/login?line=invite_error");
    }
    if (!ws) redirect("/login?line=invite_invalid");
    await setSession(userId, ws);
    // スタッフとして入った人は、すでに連携済みの場所なので未返信の一覧へ
    redirect(staffInvite ? "/inbox?welcome=1" : "/line?welcome=1");
  }

  // 内海さんの場所（main）：管理者がまだ誰もいなければ、最初にログインした人を管理者にする
  await runInWorkspace(MAIN, () => authorizeAdmin(userId));
  const mine = await workspacesOf(userId);
  if (mine.length === 0) {
    // 招待されていない人。本人にだけ自分のIDを見せる（Cookie 経由・5分）
    jar.set(DENIED_COOKIE, userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/login",
      maxAge: 300,
    });
    redirect("/login?line=denied");
  }
  const last = jar.get(WS_COOKIE)?.value;
  const ws = mine.find((m) => m.id === last)?.id ?? mine[0].id;
  await setSession(userId, ws);
  redirect("/dashboard");
}
