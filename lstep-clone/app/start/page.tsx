import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser, workspacesOf } from "@/lib/auth";
import StartForm from "./StartForm";

export const dynamic = "force-dynamic";

// 公式LINEの鍵（Channel ID と Channel secret）を入れて使い始める画面。招待は要らない
export default async function StartPage() {
  const user = await sessionUser();
  if (!user) redirect("/login");
  const mine = await workspacesOf(user);
  return (
    <div style={{ maxWidth: 440, margin: "8vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 16 }}>
        <h1 style={{ margin: 0 }}>公式LINEをつなぐ</h1>
        <p style={{ margin: 0 }}>あなたの公式LINEの「Channel ID」と「Channel secret」を入れると使い始められます。</p>
        <StartForm />
        <details className="more">
          <summary>どこで見られる？</summary>
          <ol className="hint" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">
                LINE Developers
              </a>
              を開いて、公式LINEのチャネル（Messaging API）を選ぶ
            </li>
            <li>「チャネル基本設定」の Channel ID と Channel secret をコピーする</li>
            <li>すでにスキルステップに登録されている公式LINEなら、その画面にそのまま入れます</li>
          </ol>
        </details>
        {mine.length > 0 && (
          <Link href="/dashboard" className="hint">
            ← いまの画面に戻る
          </Link>
        )}
      </div>
    </div>
  );
}
