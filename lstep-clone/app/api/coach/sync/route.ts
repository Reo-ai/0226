import { JOB_STATUS, syncJobsFromCourse, type JobStatus } from "@/lib/coach";
import { getFriendByToken } from "@/lib/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 講座の画面（案件獲得の章）から、応募した案件を受け取る：
//   POST /api/coach/sync?w=<公式LINEの場所> { f: 友だちトークン, jobs: [{ id, title, site, url, status, appliedOn }] }
// 友だちトークンは、LINEのリンクから講座を開いた時に ?sq= で渡している
const ORIGIN = /^https:\/\/anken-navi-v\d+\.sns-studio\.workers\.dev$/;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return ORIGIN.test(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const headers = cors(req);
  let body: { f?: unknown; jobs?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  const friend = typeof body.f === "string" ? await getFriendByToken(body.f) : undefined;
  if (!friend || !Array.isArray(body.jobs)) return Response.json({ ok: false }, { status: 404, headers });
  const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const jobs = (body.jobs as Record<string, unknown>[])
    .slice(0, 500)
    .map((j) => {
      const url = text(j.url, 500);
      const on = text(j.appliedOn, 10);
      return {
        id: text(j.id, 80),
        title: text(j.title, 200),
        site: text(j.site, 60),
        url: /^https?:\/\//.test(url) ? url : "",
        status: (text(j.status, 20) in JOB_STATUS ? text(j.status, 20) : "applied") as JobStatus,
        appliedOn: /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10),
      };
    })
    .filter((j) => j.id && j.title);
  const changed = await syncJobsFromCourse(friend.id, jobs);
  return Response.json({ ok: true, changed }, { headers });
}
