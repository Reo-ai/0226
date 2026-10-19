export const PLATFORMS = [
  { id: "blog", label: "ブログ" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
] as const;
export type Platform = (typeof PLATFORMS)[number]["id"];
export const PLATFORM_IDS = PLATFORMS.map((p) => p.id) as [Platform, ...Platform[]];
export const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? (id || "未指定");

export const EXPERIENCE_LEVELS = [
  { id: "none", label: "初心者（まったく初めて）" },
  { id: "beginner", label: "少し触ったことがある（成果0〜数件）" },
  { id: "intermediate", label: "成果が出たことがある（月1万円未満）" },
  { id: "advanced", label: "継続的に成果がある（月1万円以上）" },
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["id"];

export const OFFER_STATUS: Record<string, string> = {
  candidate: "候補",
  applied: "提携申請中",
  approved: "提携済み",
  rejected: "否認",
  paused: "停止",
};

export const CONTENT_TYPES = [
  { id: "blog_outline", label: "ブログ記事構成", platform: "blog" },
  { id: "blog_draft", label: "ブログ記事下書き", platform: "blog" },
  { id: "comparison_outline", label: "比較記事構成", platform: "blog" },
  { id: "instagram_post", label: "Instagram投稿文", platform: "instagram" },
  { id: "instagram_reel", label: "Instagramリール台本", platform: "instagram" },
  { id: "x_post", label: "X投稿文", platform: "x" },
  { id: "tiktok_script", label: "TikTok動画台本", platform: "tiktok" },
  { id: "youtube_script", label: "YouTube動画台本", platform: "youtube" },
  { id: "youtube_description", label: "YouTube概要欄", platform: "youtube" },
  { id: "cta", label: "CTA文案", platform: "" },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["id"];
export const contentTypeLabel = (id: string) => CONTENT_TYPES.find((c) => c.id === id)?.label ?? id;

export const DRAFT_STATUS: Record<string, string> = {
  draft: "下書き",
  awaiting_review: "確認待ち",
  approved: "公開OK",
  published: "公開済み",
};

export const JOB_STATUS: Record<string, string> = {
  draft: "下書き",
  awaiting_review: "確認待ち",
  approved: "承認済み",
  completed: "完了",
  failed: "失敗",
};

export const STAGE_LABEL: Record<string, string> = {
  beginner: "初心者",
  growing: "成長途中",
  grown: "成長済み",
  insufficient: "データ不足",
};

export const READINESS_LABEL: Record<string, string> = {
  ready: "すぐに案件紹介を始められる",
  funnel: "集客はあるが導線改善が必要",
  traffic: "集客データが不足している",
  offer: "案件選定が必要",
  track: "収益化実績が不足している",
};
