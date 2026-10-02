import { lineConnected } from "@/lib/lineConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 状態確認用（秘密の値は返さない）：LINE連携の有無とデータの保存先
export async function GET() {
  return Response.json({
    lineConnected: await lineConnected(),
    storage: process.env.DATABASE_URL?.startsWith("libsql") ? "turso" : "temporary",
  });
}
