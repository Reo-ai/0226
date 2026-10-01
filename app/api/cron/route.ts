import { runDueJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? url.searchParams.get("key");
  if (!secret || given !== secret) return new Response("unauthorized", { status: 401 });
  await runDueJobs();
  return Response.json({ ok: true });
}
