import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireViewer, sessionUser, workspacesOf } from "@/lib/auth";
import { currentWorkspace, MAIN } from "@/lib/workspace";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

const NAV = [
  ["/dashboard", "ダッシュボード"],
  ["/friends", "友だち"],
  ["/broadcasts", "一斉配信"],
  ["/scenarios", "ステップ配信"],
  ["/auto-replies", "自動応答"],
  ["/rich-menus", "リッチメニュー"],
  ["/forms", "回答フォーム"],
  ["/sources", "流入経路"],
  ["/links", "計測リンク"],
  ["/tags", "タグ"],
  ["/line", "LINE連携"],
  ["/settings", "設定・AI"],
  ["/guide", "使い方"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { guest } = await requireViewer();
  // 使える場所（ワークスペース）と、招待を作れるか（内海さんの場所の管理者だけ）
  const user = await sessionUser();
  const mine = user ? await workspacesOf(user) : [];
  const ws = await currentWorkspace();
  const canInvite = mine.some((m) => m.id === MAIN);
  const items = canInvite ? [...NAV, ["/invites", "招待"] as const] : NAV;
  const current = mine.find((m) => m.id === ws);
  return (
    <div className="shell">
      <AdminNav items={items} workspaceName={current?.name} workspaces={mine.length > 1 ? mine : []} currentWs={ws}>
        <form action={logout}>
          <button className="ghost small" style={{ color: "inherit" }}>
            {guest ? "閲覧を終える" : "ログアウト"}
          </button>
        </form>
      </AdminNav>
      <main className="main">
        {guest && (
          <div className="panel guest-banner">
            ゲスト閲覧中（読み取り専用）です。保存・配信などの操作はできません。{" "}
            <Link href="/login">ログインする</Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
