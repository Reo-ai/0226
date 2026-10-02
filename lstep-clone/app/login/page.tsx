import { cookies } from "next/headers";
import { DENIED_COOKIE, lineLoginEnabled } from "@/lib/lineLogin";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  let lineMessage: string | null = null;
  if (line === "failed") lineMessage = "LINEログインに失敗しました。もう一度お試しください。";
  if (line === "denied") {
    const id = (await cookies()).get(DENIED_COOKIE)?.value;
    lineMessage = `このLINEアカウントは管理画面への許可がありません。${
      id ? `\nあなたのLINEユーザーID: ${id}\n管理者に追加してもらってください。` : ""
    }`;
  }
  return <LoginForm lineEnabled={lineLoginEnabled()} lineMessage={lineMessage} />;
}
