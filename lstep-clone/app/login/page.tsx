import { cookies } from "next/headers";
import { DENIED_COOKIE, lineLoginEnabled } from "@/lib/lineLogin";
import { officialChatUrl } from "@/lib/magicLogin";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  let lineMessage: string | null = null;
  if (line === "failed") lineMessage = "LINEログインに失敗しました。もう一度お試しください。";
  if (line === "expired") lineMessage = "ログイン用リンクの期限が切れたか、すでに使われています。公式LINEにもう一度「ログイン」と送ってください。";
  if (line === "denied") {
    const id = (await cookies()).get(DENIED_COOKIE)?.value;
    lineMessage = `このLINEアカウントは管理画面への許可がありません。${
      id ? `\nあなたのLINEユーザーID: ${id}\n管理者に ADMIN_LINE_USER_IDS へ追加してもらってください。` : ""
    }`;
  }
  // 公式LINEでログインは、Messaging API がつながっている時だけ使える
  const officialUrl = process.env.LINE_CHANNEL_ACCESS_TOKEN ? officialChatUrl() : null;
  return <LoginForm lineEnabled={lineLoginEnabled()} officialUrl={officialUrl} lineMessage={lineMessage} />;
}
