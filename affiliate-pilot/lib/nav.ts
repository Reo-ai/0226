import {
  Bot, Briefcase, ChartColumn, Gauge, GraduationCap, LayoutDashboard, Map, Settings, SquarePen, Trophy, Users, Zap,
} from "lucide-react";

export const NAV = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/coach", label: "AI司令塔", icon: Bot },
  { href: "/roadmap", label: "90日ロードマップ", icon: Map },
  { href: "/challenge", label: "初月5万円チャレンジ", icon: Trophy },
  { href: "/accounts", label: "アカウント", icon: Users },
  { href: "/accounts/assessment", label: "戦闘力診断", icon: Gauge },
  { href: "/academy", label: "攻略大学", icon: GraduationCap },
  { href: "/offers", label: "案件分析", icon: Briefcase },
  { href: "/content", label: "コンテンツ工房", icon: SquarePen },
  { href: "/automation", label: "自動化センター", icon: Zap },
  { href: "/analytics", label: "収益分析", icon: ChartColumn },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

/** スマホ下部ナビ（残りは「メニュー」から） */
export const MOBILE_NAV = ["/", "/coach", "/content", "/analytics"] as const;

/** パンくず用のラベル */
export const SEGMENT_LABEL: Record<string, string> = {
  coach: "AI司令塔",
  roadmap: "90日ロードマップ",
  challenge: "初月5万円チャレンジ",
  accounts: "アカウント",
  assessment: "戦闘力診断",
  academy: "攻略大学",
  offers: "案件分析",
  compare: "案件比較",
  asp: "ASP一覧",
  content: "コンテンツ工房",
  automation: "自動化センター",
  analytics: "収益分析",
  settings: "設定",
};

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/accounts") return pathname === "/accounts";
  return pathname === href || pathname.startsWith(href + "/");
}
