import { getFriendByToken } from "@/lib/friends";
import { recordChapter, recordMissions } from "@/lib/nudge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 講座サイトからの進み具合の通知：
//   QUESTクリア   POST { f: 友だちトークン, course: "A", chapter: 3 }
//   済ミッション数 POST { f: 友だちトークン, course: "A", chapter: 3, missions: 2 }（増えた時だけ「進めた」になる）
// 友だちトークンは、LINEのリンク（/r/lp など）から講座サイトを開いた時に ?sq= で渡している
const ALLOWED = (process.env.COURSE_ORIGINS || "https://skillquest-v2.pages.dev,https://sho-claude-code-course.pages.dev")
  .split(",")
  .map((s) => s.trim());

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return ALLOWED.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const headers = cors(req);
  let body: { f?: unknown; chapter?: unknown; course?: unknown; missions?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  const chapter = Number(body.chapter);
  const token = typeof body.f === "string" ? body.f : "";
  if (!token || !Number.isInteger(chapter) || chapter < 1 || chapter > 99) {
    return Response.json({ ok: false }, { status: 400, headers });
  }
  const friend = await getFriendByToken(token);
  if (!friend) return Response.json({ ok: false }, { status: 404, headers });
  const course = typeof body.course === "string" ? body.course.slice(0, 20) : "";
  const missions = Number(body.missions);
  if (body.missions !== undefined) {
    if (!Number.isInteger(missions) || missions < 1 || missions > 99) return Response.json({ ok: false }, { status: 400, headers });
    const fresh = await recordMissions(friend.id, course, chapter, missions);
    return Response.json({ ok: true, fresh }, { headers });
  }
  const fresh = await recordChapter(friend.id, chapter, "site", course);
  return Response.json({ ok: true, fresh }, { headers });
}
