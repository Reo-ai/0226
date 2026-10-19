import { get, run } from "@/lib/db";
import type { Link } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|line-poker|twitterbot/i;

/** クリック計測リダイレクト: /go/CODE?ch=tiktok */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const link = await get<Link>("SELECT * FROM links WHERE code = ?", code);
  if (!link) return new Response("Not found", { status: 404 });

  // リンクプレビュー用のクローラーはクリックに数えない
  if (!BOT.test(req.headers.get("user-agent") ?? "")) {
    const channel = (new URL(req.url).searchParams.get("ch") || link.channel).slice(0, 32);
    await run(
      "INSERT INTO clicks (link_id, channel, referer, created_at) VALUES (?, ?, ?, ?)",
      link.id,
      channel,
      req.headers.get("referer")?.slice(0, 500) ?? null,
      Date.now(),
    );
  }
  return Response.redirect(link.url, 302);
}
