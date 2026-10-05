import { get, run } from "@/lib/db";
import { getFriendByToken } from "@/lib/friends";
import { addScore } from "@/lib/score";
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
    "INSERT INTO link_clicks (link_id, friend_id, message_source, ref_id, created_at) VALUES (?, ?, ?, ?, ?)",
    link.id,
    friend?.id ?? null,
    url.searchParams.get("s"),
    Number(url.searchParams.get("m")) || null,
    Date.now(),
  );
  if (friend && link.add_tag_id) await addTag(friend.id, link.add_tag_id);
  await addScore(friend?.id, "click", link.id);

  // Stripe の支払いリンクなら、誰の支払いか分かるように友だちのトークンを付ける（決済完了の自動判定用）
  let dest = link.url;
  if (friend) {
    try {
      const u = new URL(link.url);
      if (/(^|\.)(buy|checkout)\.stripe\.com$/.test(u.hostname)) {
        u.searchParams.set("client_reference_id", friend.token);
        dest = u.toString();
      }
      // 講座サイトなら、章クリアを /api/progress に知らせてもらうため友だちのトークンを渡す
      const courseOrigins = (process.env.COURSE_ORIGINS || "https://skillquest-v2.pages.dev,https://sho-claude-code-course.pages.dev").split(",");
      if (courseOrigins.map((o) => o.trim()).includes(u.origin)) {
        u.searchParams.set("sq", friend.token);
        dest = u.toString();
      }
    } catch {
      // URL として読めなければそのまま転送する
    }
  }
  return Response.redirect(dest, 302);
}
