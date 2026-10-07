import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser, workspacesOf } from "@/lib/auth";
import JoinForm from "./JoinForm";
import StartForm from "./StartForm";

export const dynamic = "force-dynamic";

// 使い始める画面：新しい公式LINEは手順どおりに鍵を貼り付けてつなぐ／すでに使っている公式LINEは管理者の許可で入る
export default async function StartPage() {
  const user = await sessionUser();
  if (!user) redirect("/login");
  const mine = await workspacesOf(user);
  return (
    <div style={{ maxWidth: 440, margin: "6vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <h1 style={{ margin: 0 }}>公式LINEをつなぐ</h1>
        <p style={{ margin: 0 }}>あなたの公式LINEの「Channel ID」と「Channel secret」を入れると使い始められます。</p>
        <StartForm />
      </div>

      <details className="more" style={{ marginTop: 8 }}>
        <summary>すでに使っている公式LINEの方はこちら</summary>
        <div className="panel" style={{ marginTop: 10 }}>
          <JoinForm />
        </div>
      </details>

      {mine.length > 0 && (
        <p style={{ marginTop: 24 }}>
          <Link href="/dashboard" className="hint">
            ← いまの画面に戻る
          </Link>
        </p>
      )}
    </div>
  );
}
