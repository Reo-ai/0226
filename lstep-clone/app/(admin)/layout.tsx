import Link from "next/link";
import { logout } from "@/lib/actions";
import { cookies } from "next/headers";
import { canCreateWorkspaces, currentRole, FLASH_COOKIE, requireViewer, sessionUser, workspacesOf } from "@/lib/auth";
import { unrepliedCount } from "@/lib/inbox";
import { currentWorkspace } from "@/lib/workspace";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

// メニュー：用途ごとにまとめる（項目が多いので、探しやすさ優先）
const NAV_GROUPS: { title: string; items: (readonly [string, string])[] }[] = [
  {
    title: "よく使う",
    items: [
      ["/dashboard", "ダッシュボード"],
      ["/inbox", "未返信"],
      ["/friends", "友だち"],
      ["/bookings", "予約の受付"],
    ],
  },
  {
    title: "配信",
    items: [
      ["/broadcasts", "一斉配信"],
      ["/scenarios", "ステップ配信"],
      ["/auto-replies", "自動応答"],
      ["/rich-menus", "リッチメニュー"],
      ["/forms", "回答フォーム"],
      ["/templates", "導線テンプレート"],
    ],
  },
  {
    title: "集客・分析",
    items: [
      ["/sources", "流入経路"],
      ["/links", "計測リンク"],
      ["/analytics", "クロス分析"],
      ["/scores", "行動スコア"],
    ],
  },
  {
    title: "友だちの情報",
    items: [
      ["/tags", "タグ"],
      ["/fields", "友だち情報欄"],
    ],
  },
  {
    title: "設定",
    items: [
      ["/line", "LINE連携"],
      ["/settings", "設定・AI"],
      ["/members", "メンバー"],
      ["/guide", "使い方"],
    ],
  },
];

const OWNER_ONLY = new Set(["/line", "/settings", "/templates", "/scores", "/members"]);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { guest } = await requireViewer();
  // 使える場所（ワークスペース）と、招待を作れるか（内海さんの場所の管理者だけ）
  const user = await sessionUser();
  const mine = user ? await workspacesOf(user) : [];
  const ws = await currentWorkspace();
  const canInvite = await canCreateWorkspaces(user);
  // スタッフには、設定・連携などオーナーだけの画面を出さない
  const role = await currentRole();
  const unreplied = await unrepliedCount();
  const flash = (await cookies()).get(FLASH_COOKIE)?.value;
  const current = mine.find((m) => m.id === ws);
  const groups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items
      .filter(([href]) => role !== "staff" || !OWNER_ONLY.has(href))
      .map(([href, label]) => [href, href === "/inbox" && unreplied > 0 ? `${label}（${unreplied}）` : label] as const),
  }));
  if (canInvite) groups[groups.length - 1].items.push(["/invites", "招待"] as const);
  return (
    <div className="shell">
      <AdminNav groups={groups} workspaceName={current?.name} workspaces={mine.length > 1 ? mine : []} currentWs={ws}>
        <form action={logout}>
          <button className="ghost small" style={{ color: "inherit" }}>
            {guest ? "閲覧を終える" : "ログアウト"}
          </button>
        </form>
      </AdminNav>
      <main className="main">
        {flash === "owner_only" && <div className="panel error">この操作はオーナーだけができます（スタッフは友だちへの返信・タグ・メモ・予約の管理ができます）</div>}
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
