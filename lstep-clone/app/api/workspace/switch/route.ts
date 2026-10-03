import { redirect } from "next/navigation";
import { sessionUser, setWorkspaceCookie, workspacesOf } from "@/lib/auth";

export const runtime = "nodejs";

// 使うワークスペースを切り替える（自分がメンバーの場所だけ）
export async function GET(req: Request) {
  const ws = new URL(req.url).searchParams.get("ws");
  const user = await sessionUser();
  if (!user) redirect("/login");
  const mine = await workspacesOf(user);
  if (!ws || !mine.some((m) => m.id === ws)) redirect("/login?line=denied");
  await setWorkspaceCookie(ws);
  redirect("/dashboard");
}
