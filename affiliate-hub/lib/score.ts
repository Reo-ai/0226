import type { Program } from "./types";

/** 1件あたりの報酬（定率なら平均単価×料率） */
export function unitReward(p: Program): number {
  return p.reward_type === "rate" ? (p.avg_price * p.reward) / 100 : p.reward;
}

/** 想定EPC（1クリックあたりの承認報酬見込み） = 報酬 × 想定CVR × 承認率 */
export function expectedEpc(p: Program): number {
  return (unitReward(p) * (p.est_cvr / 100) * (p.approval_rate / 100));
}

/** 実績EPC。クリックが少ないうちは想定値に寄せる（ベイズ的な平滑化） */
export function blendedEpc(p: Program, clicks: number, earned: number): number {
  const prior = 200; // 想定値を200クリック分の重みで扱う
  return (expectedEpc(p) * prior + earned) / (prior + clicks);
}

export function scoreClass(epc: number): string {
  if (epc >= 30) return "hi";
  if (epc >= 10) return "mid";
  return "lo";
}

export const PROGRAM_STATUS: Record<Program["status"], string> = {
  candidate: "候補",
  active: "提携中",
  paused: "停止",
};

export const CONV_STATUS: Record<string, string> = {
  pending: "発生",
  approved: "承認",
  rejected: "否認",
};

export const PLATFORMS = [
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["x", "X"],
  ["youtube", "YouTubeショート"],
  ["blog", "ブログ"],
  ["line", "LINE"],
] as const;

export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS);

export const POST_KINDS = [
  ["review", "レビュー・使ってみた"],
  ["compare", "比較・ランキング"],
  ["howto", "ハウツー・悩み解決"],
  ["story", "ストーリー・ビフォーアフター"],
  ["hook", "バズ狙いのフック型"],
] as const;
