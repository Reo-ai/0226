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

/** かんたん表示のメニュー（初心者向け・平易な言葉） */
export const SIMPLE_NAV = [
  { href: "/", label: "ホーム", short: "ホーム" },
  { href: "/academy", label: "学ぶ", short: "学ぶ" },
  { href: "/content", label: "投稿を作る", short: "作る" },
  { href: "/analytics", label: "成果を記録", short: "記録" },
  { href: "/settings", label: "設定", short: "設定" },
] as const;

/** かんたん表示での各画面の呼び方（くわしい表示の名前 → 平易な名前） */
export const SIMPLE_LABEL: Record<string, string> = {
  "/": "ホーム",
  "/coach": "今日の作戦（AIに相談）",
  "/roadmap": "90日の道のり",
  "/challenge": "初月5万円チャレンジ",
  "/accounts": "自分のSNS・ブログ",
  "/accounts/assessment": "アカウント診断",
  "/academy": "学ぶ",
  "/offers": "紹介する商品を選ぶ",
  "/offers/recommend": "おすすめ案件を提案",
  "/content": "投稿を作る",
  "/automation": "おまかせ機能",
  "/analytics": "成果を記録",
  "/settings": "設定",
};

/** パンくず用のラベル */
export const SEGMENT_LABEL: Record<string, string> = {
  recommend: "おすすめ案件を提案",
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
