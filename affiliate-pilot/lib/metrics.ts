/**
 * 指標計算。未計測（null）は 0 と区別し、分母が 0・未計測のときは率を計算しない（null を返す）。
 * 比率はすべて 0〜1。
 */

export type Maybe = number | null | undefined;

/** n / d。どちらかが未計測、または d <= 0 なら null */
export function ratio(n: Maybe, d: Maybe): number | null {
  if (n === null || n === undefined || d === null || d === undefined) return null;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return n / d;
}

export const ctr = (clicks: Maybe, impressions: Maybe) => ratio(clicks, impressions);
export const cvr = (conversions: Maybe, clicks: Maybe) => ratio(conversions, clicks);
/** 承認率 = 承認済み成約数 ÷ 発生成約数 */
export const approvalRate = (approved: Maybe, conversions: Maybe) => ratio(approved, conversions);
/** 目標達成率 = 確定報酬 ÷ 目標 */
export const goalAchievement = (confirmed: Maybe, target: Maybe) => ratio(confirmed, target);
/** 作業1時間あたりの確定報酬 */
export const confirmedPerHour = (confirmed: Maybe, workMinutes: Maybe) => {
  const r = ratio(confirmed, workMinutes);
  return r === null ? null : r * 60;
};

/** null を除いて合計。すべて未計測なら null（0 と区別） */
export function sumMeasured(values: Maybe[]): number | null {
  let total: number | null = null;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    total = (total ?? 0) + v;
  }
  return total;
}

export type Totals = {
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  approvedConversions: number | null;
  pendingRevenue: number | null;
  confirmedRevenue: number | null;
  paidRevenue: number | null;
  workMinutes: number | null;
};

export type RecordLike = { [K in keyof Totals]: number | null };

export function totals(rows: RecordLike[]): Totals {
  const pick = (k: keyof Totals) => sumMeasured(rows.map((r) => r[k]));
  return {
    impressions: pick("impressions"),
    clicks: pick("clicks"),
    conversions: pick("conversions"),
    approvedConversions: pick("approvedConversions"),
    pendingRevenue: pick("pendingRevenue"),
    confirmedRevenue: pick("confirmedRevenue"),
    paidRevenue: pick("paidRevenue"),
    workMinutes: pick("workMinutes"),
  };
}

export function rates(t: Totals) {
  return {
    ctr: ctr(t.clicks, t.impressions),
    cvr: cvr(t.conversions, t.clicks),
    approvalRate: approvalRate(t.approvedConversions, t.conversions),
    confirmedPerHour: confirmedPerHour(t.confirmedRevenue, t.workMinutes),
  };
}

// ---- 逆算シミュレーター ----

export type SimulationInput = {
  targetConfirmedRevenue: Maybe; // 円
  confirmedPerConversion: Maybe; // 1件あたりの確定報酬（円）
  approvalRate: Maybe; // 0〜1
  cvr: Maybe; // 0〜1
  ctr: Maybe; // 0〜1
  currentImpressions?: Maybe;
  currentClicks?: Maybe;
};

export type SimulationResult =
  | {
      ok: true;
      approvedConversions: number;
      conversions: number;
      clicks: number;
      impressions: number;
      /** 現在の表示回数・クリック数に対する倍率（未入力なら null） */
      impressionsGap: number | null;
      clicksGap: number | null;
    }
  | { ok: false; missing: string[] };

const positive = (v: Maybe) => v !== null && v !== undefined && Number.isFinite(v) && v > 0;
const rate = (v: Maybe) => positive(v) && (v as number) <= 1;

/**
 * 必要承認済み成約数 = ceil(目標確定報酬 ÷ 1件あたりの確定報酬)
 * 必要発生成約数     = ceil(必要承認済み成約数 ÷ 承認率)
 * 必要クリック数     = ceil(必要発生成約数 ÷ CVR)
 * 必要表示回数       = ceil(必要クリック数 ÷ CTR)
 * ゼロ・未入力・範囲外があれば計算不能。
 */
export function simulate(input: SimulationInput): SimulationResult {
  const missing: string[] = [];
  if (!positive(input.targetConfirmedRevenue)) missing.push("目標確定報酬");
  if (!positive(input.confirmedPerConversion)) missing.push("1件あたりの確定報酬");
  if (!rate(input.approvalRate)) missing.push("承認率");
  if (!rate(input.cvr)) missing.push("CVR");
  if (!rate(input.ctr)) missing.push("CTR");
  if (missing.length) return { ok: false, missing };

  // 浮動小数の誤差で 1 つ多く切り上げないよう、わずかに丸めてから ceil する
  const up = (x: number) => Math.ceil(Number(x.toFixed(9)));
  const approvedConversions = up(input.targetConfirmedRevenue! / input.confirmedPerConversion!);
  const conversions = up(approvedConversions / input.approvalRate!);
  const clicks = up(conversions / input.cvr!);
  const impressions = up(clicks / input.ctr!);
  return {
    ok: true,
    approvedConversions,
    conversions,
    clicks,
    impressions,
    impressionsGap: ratio(impressions, input.currentImpressions),
    clicksGap: ratio(clicks, input.currentClicks),
  };
}

/** % 入力（例: "2.5"）を 0〜1 に。空・不正は null */
export function percentToRate(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

/** 数値入力。空は null（未計測）、不正も null */
export function optionalInt(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v.trim() === "") return null;
  const n = Number(v.replace(/[,，¥￥円\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}
