import { z } from "zod";
import { ratio } from "./metrics";

/**
 * アカウント戦闘力診断。フォロワー数は判定に使わない（表示回数・反応・クリック・成約で判断する）。
 * 各指標は 0〜100、データがなければ null。基準は設定画面で編集できる。
 */

const range = z.object({ low: z.number().min(0), high: z.number().min(0) });

export const platformCriteriaSchema = z.object({
  monthlyImpressions: range, // 30日の表示回数（low で 20点、high で 100点）
  engagementRate: range, // 反応数 ÷ 表示回数
  ctr: range, // リンククリック ÷ 表示回数
  profileToClick: range, // リンククリック ÷ プロフィールアクセス
  cvr: range, // 成約 ÷ クリック
});
export type PlatformCriteria = z.infer<typeof platformCriteriaSchema>;

export const criteriaSchema = z.object({
  platforms: z.record(z.string(), platformCriteriaSchema),
  weights: z.object({ traffic: z.number(), engagement: z.number(), funnel: z.number(), offerFit: z.number(), conversion: z.number() }),
  stage: z.object({ minConfidence: z.number().min(0).max(1), growing: z.number(), grown: z.number() }),
  minClicksForCvr: z.number().int().min(1),
});
export type Criteria = z.infer<typeof criteriaSchema>;

const sns = (impLow: number, impHigh: number): PlatformCriteria => ({
  monthlyImpressions: { low: impLow, high: impHigh },
  engagementRate: { low: 0.01, high: 0.06 },
  ctr: { low: 0.001, high: 0.01 },
  profileToClick: { low: 0.02, high: 0.15 },
  cvr: { low: 0.005, high: 0.03 },
});

export const DEFAULT_CRITERIA: Criteria = {
  platforms: {
    blog: { monthlyImpressions: { low: 1000, high: 30000 }, engagementRate: { low: 0.005, high: 0.03 }, ctr: { low: 0.005, high: 0.03 }, profileToClick: { low: 0.02, high: 0.15 }, cvr: { low: 0.005, high: 0.03 } },
    instagram: sns(5000, 200000),
    x: sns(10000, 500000),
    tiktok: sns(10000, 500000),
    youtube: sns(5000, 200000),
  },
  weights: { traffic: 0.25, engagement: 0.15, funnel: 0.25, offerFit: 0.15, conversion: 0.2 },
  stage: { minConfidence: 0.4, growing: 40, grown: 70 },
  minClicksForCvr: 30,
};

export type AccountInput = {
  platform: string;
  followerCount: number | null;
  monthlyImpressions: number | null;
  monthlyPosts: number | null;
  monthlyEngagements: number | null;
  monthlyProfileVisits: number | null;
  monthlyClicks: number | null;
  monthlyConversions: number | null;
  niche: string;
};

export type OfferFitInput = { approvedMatching: number; candidateMatching: number; anyApproved: number };

export type Assessment = {
  traffic: number | null;
  engagement: number | null;
  funnel: number | null;
  offerFit: number | null;
  conversion: number | null;
  overall: number | null;
  confidence: number;
  stage: "beginner" | "growing" | "grown" | "insufficient";
  recommendations: string[];
};

/** 値を low〜high の間で 20〜100 点にする（対数スケール）。low 未満は 0〜20 */
export function scale(v: number | null, r: { low: number; high: number }): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  if (v <= 0) return 0;
  const lo = Math.max(r.low, 1e-9);
  const hi = Math.max(r.high, lo * 1.0001);
  if (v < lo) return Math.round((v / lo) * 20);
  if (v >= hi) return 100;
  return Math.round(20 + (80 * Math.log(v / lo)) / Math.log(hi / lo));
}

const avg = (xs: (number | null)[]) => {
  const ys = xs.filter((x): x is number => x !== null);
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
};

export function assess(a: AccountInput, fit: OfferFitInput, criteria: Criteria = DEFAULT_CRITERIA): Assessment {
  const c = criteria.platforms[a.platform] ?? criteria.platforms.instagram ?? DEFAULT_CRITERIA.platforms.instagram;

  const traffic = scale(a.monthlyImpressions, c.monthlyImpressions);
  const engagement = scale(ratio(a.monthlyEngagements, a.monthlyImpressions), c.engagementRate);
  const funnel = avg([scale(ratio(a.monthlyClicks, a.monthlyImpressions), c.ctr), scale(ratio(a.monthlyClicks, a.monthlyProfileVisits), c.profileToClick)]);

  // 案件との適合性: ジャンルが決まっていて、そのジャンルの案件と提携しているか
  let offerFit: number | null = null;
  if (a.niche.trim()) {
    offerFit = fit.approvedMatching > 0 ? Math.min(100, 70 + fit.approvedMatching * 10) : fit.candidateMatching > 0 ? 45 : fit.anyApproved > 0 ? 30 : 10;
  }

  // 成約実績: クリックが少なすぎるときは判定しない
  let conversion: number | null = null;
  if (a.monthlyClicks !== null && a.monthlyConversions !== null) {
    conversion = a.monthlyClicks >= criteria.minClicksForCvr ? scale(ratio(a.monthlyConversions, a.monthlyClicks), c.cvr) : null;
  }

  // データの信頼度: 主要な数字がどれだけ計測されているか＋クリックの母数
  const measured = [a.monthlyImpressions, a.monthlyEngagements, a.monthlyProfileVisits, a.monthlyClicks, a.monthlyConversions, a.monthlyPosts].filter((v) => v !== null).length / 6;
  const sample = a.monthlyClicks === null ? 0 : Math.min(1, a.monthlyClicks / (criteria.minClicksForCvr * 3));
  const confidence = Math.round((measured * 0.75 + sample * 0.25) * 100) / 100;

  const w = criteria.weights;
  const parts: [number | null, number][] = [[traffic, w.traffic], [engagement, w.engagement], [funnel, w.funnel], [offerFit, w.offerFit], [conversion, w.conversion]];
  const usable = parts.filter((p): p is [number, number] => p[0] !== null && p[1] > 0);
  const wsum = usable.reduce((s, [, wt]) => s + wt, 0);
  const overall = wsum > 0 ? Math.round(usable.reduce((s, [v, wt]) => s + v * wt, 0) / wsum) : null;

  let stage: Assessment["stage"];
  if (confidence < criteria.stage.minConfidence || overall === null || traffic === null) stage = "insufficient";
  else if (overall >= criteria.stage.grown) stage = "grown";
  else if (overall >= criteria.stage.growing) stage = "growing";
  else stage = "beginner";

  return { traffic, engagement, funnel, offerFit, conversion, overall, confidence, stage, recommendations: recommend({ traffic, engagement, funnel, offerFit, conversion }, a) };
}

const ADVICE: Record<string, { missing: string; low: string }> = {
  traffic: {
    missing: "直近30日の表示回数（インプレッション／PV）を管理画面で確認して入力しましょう。集客力はこの数字で判断します。",
    low: "表示回数を増やす: 投稿頻度を週3本以上にし、伸びた投稿と同じテーマ・型で続けて出しましょう。",
  },
  engagement: {
    missing: "いいね・保存・コメントなどの反応数を入力すると、内容が刺さっているかを判断できます。",
    low: "反応率を上げる: 冒頭の一文（フック）で「誰の・どんな悩み」かを明示し、保存したくなるまとめを入れましょう。",
  },
  funnel: {
    missing: "リンククリック数を計測しましょう。案件分析の計測リンクを使うと媒体別に数えられます。",
    low: "収益導線を整える: プロフィールに「リンク先で何が得られるか」を書き、投稿の最後でプロフィールへ誘導しましょう。",
  },
  offerFit: {
    missing: "ジャンルを登録しましょう。ジャンルが決まると、合う案件を選べます。",
    low: "案件との相性を高める: ジャンルに合う案件をASPで探し、提携申請しましょう。",
  },
  conversion: {
    missing: "成約数を記録しましょう（クリックが30回以上たまると成約率を判定します）。",
    low: "成約率を上げる: 比較・体験の根拠を示すコンテンツを作り、案件のターゲットと発信の読者がずれていないか見直しましょう。",
  },
};

/** 優先すべき改善を3つ。未計測 → 低い指標の順 */
export function recommend(scores: Record<keyof typeof ADVICE, number | null>, a: AccountInput): string[] {
  const order: (keyof typeof ADVICE)[] = ["traffic", "funnel", "conversion", "offerFit", "engagement"];
  const missing = order.filter((k) => scores[k] === null).map((k) => ADVICE[k].missing);
  const low = order
    .filter((k) => scores[k] !== null)
    .sort((x, y) => (scores[x] as number) - (scores[y] as number))
    .filter((k) => (scores[k] as number) < 70)
    .map((k) => ADVICE[k].low);
  const out = [...missing, ...low];
  if (out.length < 3) out.push("伸びている投稿と同じ型の投稿を増やし、成果の出た案件の紹介を続けましょう。");
  if (out.length < 3 && a.monthlyPosts !== null && a.monthlyPosts < 12) out.push("投稿数を週3本以上に増やし、データを貯めましょう。");
  if (out.length < 3) out.push("週次レポートで、作業時間あたりの確定報酬が高い施策に時間を寄せましょう。");
  return out.slice(0, 3);
}
