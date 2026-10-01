import { get } from "@/lib/db";
import { verifyIdToken } from "@/lib/line";
import { recordVisit } from "@/lib/sources";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { code, idToken } = (await req.json().catch(() => ({}))) as { code?: string; idToken?: string };
  const source = code ? await get<Source>("SELECT * FROM sources WHERE code = ?", code) : undefined;
  if (!source) return Response.json({ ok: false }, { status: 404 });
  const userId = idToken ? await verifyIdToken(idToken) : null;
  await recordVisit(source, userId);
  return Response.json({ ok: true, identified: Boolean(userId) });
}
