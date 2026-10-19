import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { appBaseUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 生成中のまま止まったジョブ（パイプラインが落ちた等）を取り直すまでの時間 */
const STALE_MS = 3 * 3600_000;

function authorized(req: Request): boolean {
  const token = process.env.PIPELINE_TOKEN;
  if (!token) return false;
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(token);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** 動画化待ちのコンテンツを取得し「生成中」にする（リポジトリ直下の npm start -- hub-sync が呼ぶ） */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.max(1, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 3));
  const now = new Date();
  const ready = await prisma.contentDraft.findMany({
    where: { OR: [{ videoStatus: "queued" }, { videoStatus: "running", videoUpdatedAt: { lt: new Date(now.getTime() - STALE_MS) } }] },
    orderBy: { videoUpdatedAt: "asc" },
    take: limit,
    include: { offer: { include: { trackingLinks: { take: 1, orderBy: { createdAt: "asc" } } } } },
  });
  // 同時に呼ばれても二重に配らないよう、状態が変わっていないものだけを取る
  const jobs = [];
  const base = await appBaseUrl();
  for (const d of ready) {
    const { count } = await prisma.contentDraft.updateMany({ where: { id: d.id, videoStatus: d.videoStatus, videoUpdatedAt: d.videoUpdatedAt }, data: { videoStatus: "running", videoUpdatedAt: now } });
    if (!count) continue;
    const link = d.offer?.trackingLinks[0];
    jobs.push({
      id: d.id,
      platform: d.platform,
      kind: d.contentType,
      body: d.body,
      theme: d.videoTheme,
      service: d.videoService,
      program: d.offer ? { name: d.offer.name, category: d.offer.category, notes: d.offer.notes } : null,
      linkUrl: link ? `${base}/go/${link.code}?ch=${d.platform}` : null,
    });
  }
  return Response.json({ jobs });
}

/** 生成結果の報告: { id, status: "done" | "failed", result } */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown; result?: unknown } | null;
  if (typeof body?.id !== "string" || (body.status !== "done" && body.status !== "failed")) {
    return Response.json({ error: "id と status（done/failed）が必要です" }, { status: 400 });
  }
  const { count } = await prisma.contentDraft.updateMany({
    where: { id: body.id },
    data: { videoStatus: body.status, videoResult: JSON.stringify(body.result ?? {}).slice(0, 20_000), videoUpdatedAt: new Date() },
  });
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
