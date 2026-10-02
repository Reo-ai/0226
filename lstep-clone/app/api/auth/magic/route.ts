import { redirect } from "next/navigation";
import { setSession } from "@/lib/auth";
import { consumeMagicToken } from "@/lib/magicLogin";

export const runtime = "nodejs";

// 公式LINEから届いたログインURLを開いたとき
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  if (!(await consumeMagicToken(token))) redirect("/login?line=expired");
  await setSession();
  redirect("/dashboard");
}
