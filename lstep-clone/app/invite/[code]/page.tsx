import type { Metadata } from "next";
import { validInvite } from "@/lib/invites";
import { getSetting, mainGet } from "@/lib/db";
import { lineLoginEnabled } from "@/lib/lineLogin";
import { MAIN, runInWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "スキルコーチ・ステップへの招待", robots: { index: false } };

// 招待された人が開くページ（招待リンク）
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await validInvite(code);
  const staffOf = invite?.target_ws
    ? invite.target_ws === MAIN
      ? (await runInWorkspace(MAIN, () => getSetting("workspace.name", "メイン"))) || "メイン"
      : ((await mainGet<{ name: string }>("SELECT name FROM workspaces WHERE id = ?", invite.target_ws))?.name ?? "公式LINE")
    : null;
  return (
    <div style={{ maxWidth: 420, margin: "12vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <h1 style={{ marginBottom: 0 }}>スキルコーチ・ステップへの招待</h1>
        {invite ? (
          <>
            {staffOf ? (
              <p style={{ margin: 0, fontSize: 17 }}>
                「{staffOf}」の<b>スタッフ</b>として招待されています。LINEでログインすると、友だちへの返信などができるようになります。
              </p>
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  公式LINEの配信ツール「スキルコーチ・ステップ」に招待されています。
                  LINEでログインすると、あなた専用の管理画面ができます。
                </p>
                <ol className="hint" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>下のボタンから LINE でログイン</li>
                  <li>あなたの公式LINEの「Channel ID」と「Channel secret」を貼って連携</li>
                  <li>ステップ配信・自動応答・リッチメニューなどが使えるようになります</li>
                </ol>
              </>
            )}
            {lineLoginEnabled() ? (
              <a className="btn" href={`/api/invite/accept?code=${encodeURIComponent(code)}`} style={{ textAlign: "center", padding: 14, background: "#06c755", borderColor: "#06c755" }}>
                LINEでログインして始める
              </a>
            ) : (
              <button disabled>準備中です</button>
            )}
            <p className="hint" style={{ margin: 0 }}>この招待リンクは1回だけ使えます（有効期限 7日）。</p>
          </>
        ) : (
          <p style={{ margin: 0 }}>この招待リンクは使用済みか、期限が切れています。招待した人に新しいリンクをもらってください。</p>
        )}
      </div>
    </div>
  );
}
