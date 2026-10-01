import { get, run } from "@/lib/db";
import { getFriendByToken } from "@/lib/friends";
import { addTag } from "@/lib/tags";
import type { Link } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** クリック計測リダイレクト: /r/CODE?f=友だちトークン&s=配信種別 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const link = await get<Link>("SELECT * FROM links WHERE code = ?", code);
  if (!link) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const token = url.searchParams.get("f");
  const friend = token ? await getFriendByToken(token) : undefined;
  await run(
    "INSERT INTO link_clicks (link_id, friend_id, message_source, created_at) VALUES (?, ?, ?, ?)",
    link.id,
    friend?.id ?? null,
    url.searchParams.get("s"),
    Date.now(),
  );
  if (friend && link.add_tag_id) await addTag(friend.id, link.add_tag_id);

  return Response.redirect(link.url, 302);
}
