import { cookies } from "next/headers";
import { DENIED_COOKIE, lineLoginEnabled } from "@/lib/lineLogin";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  const { line } = await searchParams;
  let lineMessage: string | null = null;
  if (line === "handoff_expired") lineMessage = "QRコードの時間が切れたか、使用済みです。パソコンの「スマホで開く」で新しいQRコードを出してください。";
  if (line === "failed") lineMessage = "LINEログインに失敗しました。もう一度お試しください。";
  if (line === "invite_invalid") lineMessage = "この招待リンクは使用済みか、期限が切れています。招待した人に新しいリンクをもらってください。";
  if (line === "invite_error") lineMessage = "あなた専用の場所を作れませんでした。少し時間をおいて、もう一度招待リンクから試してください。";
  if (line === "denied") {
    const id = (await cookies()).get(DENIED_COOKIE)?.value;
    lineMessage = `このLINEアカウントはまだ招待されていません。${
      id ? `\nあなたのLINEユーザーID: ${id}\n招待リンクを送ってもらってください。` : ""
    }`;
  }
  return <LoginForm lineEnabled={lineLoginEnabled()} lineMessage={lineMessage} />;
}
