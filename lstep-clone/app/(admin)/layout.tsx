import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireViewer } from "@/lib/auth";

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
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { guest } = await requireViewer();
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">スキルコーチ</div>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <form action={logout}>
          <button className="ghost small" style={{ color: "inherit" }}>
            {guest ? "閲覧を終える" : "ログアウト"}
          </button>
        </form>
      </nav>
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
