import fs from "node:fs/promises";
import path from "node:path";
import { get } from "@/lib/db";
import { getFriendByToken } from "@/lib/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 購入者だけに配る特典PDF。/p/<名前>?f=友だちトークン で開き、「購入済み」タグがある人にだけ返す。
// ファイルは public ではなく private/gift/ に置く（URLを知っていても購入者以外は開けない）
const FILES: Record<string, string> = {
  profile: "skillquest-bonus-profile.pdf",
  prompts: "skillquest-bonus-prompts.pdf",
};
const PURCHASE_TAG = process.env.PURCHASE_TAG_NAME || "購入済み";

function page(message: string, status: number) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>特典</title>` +
      `<body style="font-family:sans-serif;padding:32px;line-height:1.8;color:#1d2433"><p>${message}</p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = FILES[file];
  if (!name) return page("ページが見つかりません。", 404);

  const token = new URL(req.url).searchParams.get("f");
  const friend = token ? await getFriendByToken(token) : undefined;
  const bought =
    friend &&
    (await get<{ n: number }>(
      "SELECT COUNT(*) n FROM friend_tags ft JOIN tags t ON t.id = ft.tag_id WHERE ft.friend_id = ? AND t.name = ?",
      friend.id,
      PURCHASE_TAG,
    ));
  if (!bought?.n) {
    return page("この特典は、講座をご購入いただいた方だけがご覧になれます。<br>LINEのトークに届いたリンクから開いてください。", 403);
  }
  const data = await fs.readFile(path.join(process.cwd(), "private", "gift", name));
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
