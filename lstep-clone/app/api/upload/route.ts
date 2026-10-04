import { isAuthed } from "@/lib/auth";
import { run } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { currentWorkspace, withWs } from "@/lib/workspace";

export const runtime = "nodejs";

// 管理画面からの画像アップロード（ブラウザ側で縮めた JPEG/PNG を受け取り、データベースに保存して公開URLを返す）
const MAX_BYTES = 1_000_000; // LINE のプレビュー画像の上限（1MB）に合わせる

export async function POST(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "ログインしてください" }, { status: 401 });
  const { dataUrl } = (await req.json().catch(() => ({}))) as { dataUrl?: string };
  const m = dataUrl?.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return Response.json({ error: "JPEG か PNG の画像を選んでください" }, { status: 400 });
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_BYTES) return Response.json({ error: "画像が大きすぎます（1MBまで）" }, { status: 400 });
  const { lastId } = await run("INSERT INTO images (mime, data, created_at) VALUES (?, ?, ?)", m[1], m[2], Date.now());
  const ext = m[1] === "image/png" ? "png" : "jpg";
  return Response.json({ url: withWs(`${baseUrl()}/i/${lastId}.${ext}`, await currentWorkspace()) });
}
