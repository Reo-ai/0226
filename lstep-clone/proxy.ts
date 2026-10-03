import { NextResponse, type NextRequest } from "next/server";

// どのワークスペース（使う人ごとの場所）のリクエストかを決めて、ヘッダー x-ws に付ける
// - LINE の受信： /api/line/webhook/<ワークスペースID>
// - 友だちが開くページ（フォーム・計測リンク・記録ページ・流入経路）： URL の ?w=<ワークスペースID>（無ければ main）
// - 管理画面： ログイン時に保存した Cookie「ws」
const WS = /^[a-z0-9]{10}$/;
const PUBLIC = /^\/(f|r|h|join)\/|^\/api\/(join|stripe|line\/webhook)(\/|$)/;

export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete("x-ws"); // 外から送られた値は使わない
  const path = req.nextUrl.pathname;
  let ws: string | undefined;
  const hook = path.match(/^\/api\/line\/webhook\/([a-z0-9]{10})$/);
  if (hook) ws = hook[1];
  else if (PUBLIC.test(path)) ws = req.nextUrl.searchParams.get("w") ?? undefined;
  else ws = req.cookies.get("ws")?.value;
  if (ws && WS.test(ws)) headers.set("x-ws", ws);
  const res = NextResponse.next({ request: { headers } });

  // ログインしたままにする：管理画面を開くたびに、ログインの期限を3か月先まで延ばす
  // （中身の正しさは毎回サーバー側で署名を確かめるので、ここでは期限だけを延ばす）
  const session = req.cookies.get("admin_session")?.value;
  if (session && req.method === "GET" && !PUBLIC.test(path)) {
    const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: KEEP };
    res.cookies.set("admin_session", session, opts);
    const current = req.cookies.get("ws")?.value;
    if (current) res.cookies.set("ws", current, opts);
  }
  return res;
}

const KEEP = 60 * 60 * 24 * 90;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|richmenu/|brand/|gift/).*)"],
};
