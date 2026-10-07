import { setWorkspaceCookie } from "@/lib/auth";
import { ownJoinRequest } from "@/lib/joinRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 頼んだ画面が数秒おきに聞きに来る：許可されていれば、その場所を開けるようにする
export async function GET() {
  const r = await ownJoinRequest();
  if (!r) return Response.json({ state: "none" });
  if (r.status === "approved") {
    await setWorkspaceCookie(r.workspace_id);
    return Response.json({ state: "approved" });
  }
  return Response.json({ state: r.status });
}
