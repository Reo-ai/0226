import { redirect } from "next/navigation";
import { decideJoin, requestByApproveToken } from "@/lib/joinRequest";

export const dynamic = "force-dynamic";

// 管理者が LINE で受け取ったリンクから開く：スキルステップへの参加を許可／拒否する
export default async function ApprovePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ w?: string }> }) {
  const { token } = await params;
  const { w } = await searchParams;
  const r = await requestByApproveToken(token);
  const back = `/approve/${token}${w ? `?w=${encodeURIComponent(w)}` : ""}`;

  async function allow() {
    "use server";
    await decideJoin(token, true);
    redirect(back);
  }
  async function deny() {
    "use server";
    await decideJoin(token, false);
    redirect(back);
  }

  return (
    <div style={{ maxWidth: 420, margin: "10vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 16, textAlign: "center" }}>
        {!r ? (
          <>
            <h1 style={{ margin: 0 }}>時間切れです</h1>
            <p style={{ margin: 0 }}>このお願いは期限（30分）が切れました。</p>
          </>
        ) : r.status === "approved" ? (
          <>
            <h1 style={{ margin: 0 }}>✅ 許可しました</h1>
            <p style={{ margin: 0 }}>{r.display_name || "相手"}さんの画面が自動で開きます。</p>
          </>
        ) : r.status === "denied" ? (
          <h1 style={{ margin: 0 }}>拒否しました</h1>
        ) : (
          <>
            <h1 style={{ margin: 0 }}>管理画面への参加</h1>
            <p style={{ margin: 0 }}>
              <b>{r.display_name || "名前の分からない人"}</b>さんが、スキルステップの管理画面に入ろうとしています。
            </p>
            <p className="hint" style={{ margin: 0 }}>許可すると、配信・設定を含めてすべて操作できるようになります。心当たりがなければ拒否してください。</p>
            <form action={allow}>
              <button style={{ width: "100%", padding: 14 }}>許可する</button>
            </form>
            <form action={deny}>
              <button className="danger" style={{ width: "100%" }}>拒否する</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
