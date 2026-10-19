import Link from "next/link";
import { logout } from "@/lib/actions";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "ダッシュボード"],
  ["/guide", "攻略ガイド"],
  ["/programs", "案件リサーチ"],
  ["/content", "AI投稿生成"],
  ["/links", "計測リンク"],
  ["/conversions", "成果"],
  ["/settings", "設定"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">アフィリエイト攻略</div>
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
