import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "./lib/session";

/**
 * APP_PASSWORD が設定されているときだけログインを必須にする（インターネット公開時用）。
 * 計測リンク（/go）と動画パイプライン API（トークン認証）は対象外。
 */
export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|go/|api/pipeline|_next/|favicon).*)"],
};
