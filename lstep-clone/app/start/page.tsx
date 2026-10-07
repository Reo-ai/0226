import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser, workspacesOf } from "@/lib/auth";
import JoinForm from "./JoinForm";
import StartForm from "./StartForm";

export const dynamic = "force-dynamic";

// 使い始める画面：すでに使われている公式LINEなら管理者の許可で入る／新しい公式LINEなら鍵を入れてつなぐ
export default async function StartPage() {
  const user = await sessionUser();
  if (!user) redirect("/login");
  const mine = await workspacesOf(user);
  return (
    <div style={{ maxWidth: 460, margin: "6vh auto", padding: 16 }}>
      <h1>スキルステップを使い始める</h1>

      <div className="panel stack" style={{ gap: 14 }}>
        <h2 style={{ margin: 0 }}>すでに使っている公式LINEに入る</h2>
        <p style={{ margin: 0 }}>公式LINEのIDを入れると、今の管理者の LINE に「許可しますか？」が届きます。</p>
        <JoinForm />
      </div>

      <div className="panel stack" style={{ gap: 14 }}>
        <h2 style={{ margin: 0 }}>新しく公式LINEをつなぐ</h2>
        <a className="btn ghost" href="https://manager.line.biz/" target="_blank" rel="noopener noreferrer" style={{ textAlign: "center" }}>
          公式LINEの管理画面を開く ↗
        </a>
        <ol className="hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>アカウントを選ぶ → 右上の「設定」→「Messaging API」</li>
          <li>Channel ID と Channel secret をコピーして、下に貼り付け</li>
        </ol>
        <StartForm />
      </div>

      {mine.length > 0 && (
        <Link href="/dashboard" className="hint">
          ← いまの画面に戻る
        </Link>
      )}
    </div>
  );
}
