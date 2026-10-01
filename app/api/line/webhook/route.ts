import { after } from "next/server";
import { runDueJobs } from "@/lib/jobs";
import { verifySignature } from "@/lib/line";
import { handleEvent, type LineEvent } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-line-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }
  const { events = [] } = JSON.parse(body) as { events?: LineEvent[] };
  // LINEへは即200を返し、処理はレスポンス後に行う
  after(async () => {
    for (const ev of events) {
      try {
        await handleEvent(ev);
      } catch (e) {
        console.error("webhook event failed", e);
      }
    }
    // 友だち追加・タグ付与で発生した即時ステップをすぐ送る
    await runDueJobs();
  });
  return Response.json({ ok: true });
}
