import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lineLoginEnabled, profileFromCode } from "@/lib/lineLogin";
import { attachUser, consumeRequest, findRequest, finishLogin, ownRequest } from "@/lib/loginFlow";

export const runtime = "nodejs";

const CALLBACK_COOKIE = "login_cb";

// LINEから戻ってきたら：
// - ログインを始めたのと同じブラウザ → そのままログイン完了
// - 別のブラウザ（iPhone のホーム画面アプリから始めて Safari に戻った等）→ 番号の確認画面へ。確認すると、始めた画面のほうでログインが完了する
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rid = url.searchParams.get("state");
  const request = await findRequest(rid);
  if (!lineLoginEnabled() || !code || !request || request.used) {
    console.error("LINEログイン: 事前チェックで失敗", {
      enabled: lineLoginEnabled(),
      code: Boolean(code),
      request: Boolean(request),
      used: request?.used,
      error: url.searchParams.get("error"),
    });
    redirect("/login?line=failed");
  }

  const profile = await profileFromCode(code);
  if (!profile) redirect("/login?line=failed");

  if ((await ownRequest())?.rid === request.rid) {
    if (!(await consumeRequest(request.rid))) redirect("/login?line=failed");
    redirect(await finishLogin(profile.sub, profile.name));
  }

  await attachUser(request.rid, profile.sub, profile.name);
  // 確認ボタンを押せるのは、LINEから戻ってきたこのブラウザだけ
  (await cookies()).set(CALLBACK_COOKIE, request.rid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  redirect("/login/confirm");
}
