import { redirect } from "next/navigation";
import { redeemHandoffToken } from "@/lib/handoff";

export const runtime = "nodejs";

// スマホでQRコードを読んだら開く：ログイン済みにしてダッシュボードへ
export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!(await redeemHandoffToken(token))) redirect("/login?line=handoff_expired");
  redirect("/dashboard");
}
