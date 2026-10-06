import { consumeRequest, finishLogin, ownRequest } from "@/lib/loginFlow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ログインを始めた画面が数秒おきに聞きに来る：別のブラウザで確認が済んでいれば、この画面でログインを完了する
export async function GET() {
  const r = await ownRequest();
  if (!r || r.used) return Response.json({ state: "none" });
  if (r.approved && r.line_user_id) {
    if (!(await consumeRequest(r.rid))) return Response.json({ state: "none" });
    const next = await finishLogin(r.line_user_id, r.display_name ?? "");
    return Response.json({ state: "done", next });
  }
  return Response.json({ state: "waiting", code: r.code });
}
