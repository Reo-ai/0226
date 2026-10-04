import { get } from "@/lib/db";

export const runtime = "nodejs";

// アップロードした画像を配信する（LINE が取りに来る公開URL：/i/<番号>.jpg?w=<場所>）
export async function GET(_: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const id = Number(file.match(/^(\d+)\.(jpg|png)$/)?.[1]);
  if (!id) return new Response("Not found", { status: 404 });
  const img = await get<{ mime: string; data: string }>("SELECT mime, data FROM images WHERE id = ?", id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(img.data, "base64")), {
    headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
