import crypto from "node:crypto";
import { all, get, run } from "@/lib/db";
import type { Link, Post, Program } from "@/lib/types";
import { baseUrl } from "@/lib/env";

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

/** 待機中のジョブを取得し「生成中」にする（hub-sync が呼ぶ） */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.max(1, Math.min(10, Number(new URL(req.url).searchParams.get("limit")) || 3));
  const now = Date.now();
  const posts = await all<Post>(
    `UPDATE posts SET video_status = 'running', video_updated_at = ?
     WHERE id IN (SELECT id FROM posts
                  WHERE video_status = 'queued' OR (video_status = 'running' AND video_updated_at < ?)
                  ORDER BY video_updated_at LIMIT ?)
     RETURNING *`,
    now,
    now - STALE_MS,
    limit,
  );
  const jobs = await Promise.all(
    posts.map(async (p) => {
      const program = p.program_id ? await get<Program>("SELECT * FROM programs WHERE id = ?", p.program_id) : undefined;
      const link = p.link_id ? await get<Link>("SELECT * FROM links WHERE id = ?", p.link_id) : undefined;
      return {
        id: p.id,
        platform: p.platform,
        kind: p.kind,
        body: p.body,
        theme: p.video_theme,
        service: p.video_service,
        program: program && { name: program.name, category: program.category, notes: program.notes },
        linkUrl: link ? `${baseUrl()}/go/${link.code}?ch=${p.platform}` : null,
      };
    }),
  );
  return Response.json({ jobs });
}

/** 生成結果の報告: { id, status: "done" | "failed", result } */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: number; status?: string; result?: unknown } | null;
  if (!body?.id || !["done", "failed"].includes(body.status ?? "")) {
    return Response.json({ error: "id と status（done/failed）が必要です" }, { status: 400 });
  }
  const { changes } = await run(
    "UPDATE posts SET video_status = ?, video_result = ?, video_updated_at = ? WHERE id = ?",
    body.status!,
    JSON.stringify(body.result ?? {}).slice(0, 20_000),
    Date.now(),
    body.id,
  );
  if (!changes) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
