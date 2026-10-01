import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "ダッシュボード"],
  ["/friends", "友だち"],
  ["/broadcasts", "一斉配信"],
  ["/scenarios", "ステップ配信"],
  ["/auto-replies", "自動応答"],
  ["/rich-menus", "リッチメニュー"],
  ["/forms", "回答フォーム"],
  ["/sources", "流入経路"],
  ["/links", "計測リンク"],
  ["/tags", "タグ"],
  ["/settings", "設定・AI"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">LINE配信管理</div>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <form action={logout}>
          <button className="ghost small" style={{ color: "inherit" }}>
            ログアウト
          </button>
        </form>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
