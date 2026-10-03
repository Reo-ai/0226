import { get } from "@/lib/db";
import { userIdFromAccessToken, verifyIdToken } from "@/lib/line";
import { recordVisit } from "@/lib/sources";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { code, idToken, accessToken } = (await req.json().catch(() => ({}))) as { code?: string; idToken?: string; accessToken?: string };
  const source = code ? await get<Source>("SELECT * FROM sources WHERE code = ?", code) : undefined;
  if (!source) return Response.json({ ok: false }, { status: 404 });
  // IDトークン（openid の許可がある時）→ だめならアクセストークンで本人を確かめる
  const userId = (idToken ? await verifyIdToken(idToken) : null) ?? (accessToken ? await userIdFromAccessToken(accessToken) : null);
  if (!userId) console.error("流入経路：LINEの人を特定できませんでした", { idToken: Boolean(idToken), accessToken: Boolean(accessToken) });
  await recordVisit(source, userId);
  return Response.json({ ok: true, identified: Boolean(userId) });
}
