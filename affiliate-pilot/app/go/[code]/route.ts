import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|line-poker|twitterbot|embedly/i;

/** クリック計測リダイレクト: /go/CODE?ch=instagram */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const link = await prisma.trackingLink.findUnique({ where: { code } });
  if (!link) return new Response("Not found", { status: 404 });
  // SNS のリンクプレビュー用クローラーはクリックに数えない
  if (!BOT.test(req.headers.get("user-agent") ?? "")) {
    const ch = (new URL(req.url).searchParams.get("ch") || link.platform).replace(/[^a-z0-9_-]/gi, "").slice(0, 20);
    await prisma.linkClick.create({ data: { linkId: link.id, platform: ch } });
  }
  return Response.redirect(link.url, 302);
}
