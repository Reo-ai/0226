import { redirect } from "next/navigation";
import { startLoginRequest } from "@/lib/loginFlow";
import { authorizeUrl, lineLoginEnabled } from "@/lib/lineLogin";

export const runtime = "nodejs";

// LINEの認可画面へ送り出す。受付票（rid）を state にして、この画面に秘密の値を持たせる（CSRF対策も兼ねる）
export async function GET() {
  if (!lineLoginEnabled()) redirect("/login");
  const rid = await startLoginRequest();
  redirect(authorizeUrl(rid));
}

// 画面から先に受付票を作る（ホーム画面のアプリでは、LINEログインを外のブラウザで開くため）
export async function POST() {
  if (!lineLoginEnabled()) return Response.json({ error: "準備中です" }, { status: 503 });
  const rid = await startLoginRequest();
  return Response.json({ url: authorizeUrl(rid) });
}
