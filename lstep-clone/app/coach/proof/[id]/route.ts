import { isAuthed } from "@/lib/auth";
import { get } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 応募の写真を見せる。個人情報が写ることがあるので、ログインした運営だけ
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed())) return new Response("ログインが必要です", { status: 401 });
  const img = await get<{ mime: string; data: string }>("SELECT mime, data FROM coach_proofs WHERE id = ?", Number((await ctx.params).id));
  if (!img) return new Response("見つかりません", { status: 404 });
  return new Response(Buffer.from(img.data, "base64"), {
    headers: { "Content-Type": img.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
