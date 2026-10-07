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
    <div style={{ maxWidth: 480, margin: "4vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 6 }}>公式LINEをつなぐ</h1>
      <p style={{ margin: "0 0 18px" }}>最初の1回だけ。1分ほどで終わります。</p>

      <div className="panel">
        <StartForm />
      </div>

      <div className="panel stack" style={{ gap: 4 }}>
        <details className="fold">
          <summary>すでにスキルステップで使っている公式LINE</summary>
          <p style={{ marginTop: 0 }}>公式LINEのIDを入れると、今の管理者の LINE に「許可しますか？」が届きます。許可されると、この画面が自動で開きます。</p>
          <JoinForm />
        </details>
      </div>

      <div className="panel stack" style={{ gap: 4 }}>
        <details className="fold">
          <summary>よくある質問</summary>
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <b>なぜ入れる必要があるの？</b>
              <div className="hint">
                公式LINEの持ち主だけが知っている「鍵」です。これがないと、このツールから配信や返信ができません。公式LINEのID（@〜）はだれでも見られるので、IDだけでは他人に使われてしまいます。
              </div>
            </div>
            <div>
              <b>入れても大丈夫？</b>
              <div className="hint">あなたの公式LINEとつなぐためだけに使います。データは公式LINEごとに別々に保存され、ほかの人からは見えません。</div>
            </div>
            <div>
              <b>「違います」と出る</b>
              <div className="hint">前後に空白が入っていないか、Channel ID と Channel secret を逆に入れていないか確かめてください。</div>
            </div>
            <div>
              <b>パソコンでもできる？</b>
              <div className="hint">できます。パソコンなら LINE Developers の「チャネル基本設定」でも同じ値が見られます。</div>
            </div>
          </div>
        </details>
      </div>

      {mine.length > 0 && (
        <Link href="/dashboard" className="hint">
          ← いまの画面に戻る
        </Link>
      )}
    </div>
  );
}
