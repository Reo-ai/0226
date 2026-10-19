import { toMarkdown } from "@/lib/content";
import { prisma } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { contentChecksSchema, parseJson } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const d = await prisma.contentDraft.findUnique({ where: { id } });
  if (!d) return new Response("Not found", { status: 404 });
  const checks = parseJson(contentChecksSchema, d.checks, { adDisclosure: false, userReviewed: false, facts: [] });
  const name = `${d.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60)}.md`;
  return new Response(toMarkdown(d, checks.facts), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`, "cache-control": "no-store" },
  });
}
