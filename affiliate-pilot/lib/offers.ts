import { z } from "zod";
import { dataBlock, runAI } from "./ai";

export type OfferLike = {
  name: string;
  category: string;
  commissionAmount: number | null;
  approvalRate: number | null;
  partnershipStatus: string;
  conversionConditions: string;
  rejectionConditions: string;
  targetAudience: string;
  offerUrl: string;
  lastVerifiedAt: Date | null;
};

/** 想定EPC（1クリックあたりの確定報酬見込み）= 報酬 × CVR × 承認率。どれかが不明なら null */
export function expectedEpc(o: Pick<OfferLike, "commissionAmount" | "approvalRate">, cvr: number | null): number | null {
  if (o.commissionAmount === null || o.approvalRate === null || cvr === null) return null;
  return o.commissionAmount * cvr * o.approvalRate;
}

/** 収益シミュレーション: 想定クリック数から確定報酬の見込みを計算（仮定に基づく） */
export function offerSimulation(o: Pick<OfferLike, "commissionAmount" | "approvalRate">, clicks: number | null, cvr: number | null) {
  if (clicks === null || cvr === null || o.commissionAmount === null) return null;
  const conversions = clicks * cvr;
  return {
    conversions,
    pending: conversions * o.commissionAmount,
    confirmed: o.approvalRate === null ? null : conversions * o.approvalRate * o.commissionAmount,
  };
}

export const fitSchema = z.object({
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().max(200)).max(5),
  concerns: z.array(z.string().max(200)).max(5),
  checkItems: z.array(z.string().max(200)).max(5),
});
export type Fit = z.infer<typeof fitSchema>;

const includesEither = (a: string, b: string) => !!a && !!b && (a.includes(b) || b.includes(a));

/** ルールによる適合性評価（AIなしでも動く） */
export function ruleFit(o: OfferLike, ctx: { niche: string; audiences: string[]; platforms: string[] }): Fit {
  let score = 40;
  const reasons: string[] = [];
  const concerns: string[] = [];
  const checkItems: string[] = [];
  if (includesEither(o.category, ctx.niche)) { score += 25; reasons.push(`ジャンル「${o.category}」があなたの発信ジャンル「${ctx.niche}」と一致しています`); }
  else if (ctx.niche) { score -= 10; concerns.push(`ジャンル「${o.category || "未設定"}」が発信ジャンル「${ctx.niche}」と一致していません`); }
  if (o.targetAudience && ctx.audiences.some((a) => includesEither(a, o.targetAudience))) { score += 10; reasons.push("案件の対象ユーザーと、アカウントのターゲット層が近いです"); }
  if (o.partnershipStatus === "approved") { score += 10; reasons.push("提携済みのため、すぐに紹介を始められます"); }
  else if (o.partnershipStatus === "rejected") { score -= 30; concerns.push("提携が否認されています"); }
  if (o.approvalRate === null) { checkItems.push("承認率がASPに掲載されているか確認してください（未登録のため収益見込みを計算できません）"); }
  else if (o.approvalRate >= 0.8) { score += 10; reasons.push(`承認率が${Math.round(o.approvalRate * 100)}%と高めです`); }
  else if (o.approvalRate < 0.4) { score -= 10; concerns.push(`承認率が${Math.round(o.approvalRate * 100)}%と低く、発生しても確定しにくい案件です`); }
  if (o.commissionAmount === null) checkItems.push("報酬単価を登録してください");
  if (!o.conversionConditions) checkItems.push("成果条件（何をしたら報酬になるか）をASPで確認して登録してください");
  if (!o.rejectionConditions) checkItems.push("否認条件（報酬にならないケース）をASPで確認して登録してください");
  if (!o.lastVerifiedAt || Date.now() - o.lastVerifiedAt.getTime() > 30 * 86_400_000) checkItems.push("条件は変わることがあります。ASPで最新の内容を確認し、最終確認日を更新してください");
  return { score: Math.max(0, Math.min(100, score)), reasons, concerns, checkItems: checkItems.slice(0, 5) };
}

/** 案件分析AI: 適合性評価。AIなしならルールで評価 */
export async function evaluateFit(o: OfferLike, ctx: { niche: string; audiences: string[]; platforms: string[] }) {
  return runAI({
    system: "あなたはアフィリエイト案件の選定を支援する案件分析AIです。ユーザーの発信内容と案件の相性を評価します。",
    prompt: [
      "案件とユーザーの相性を0〜100点で評価し、おすすめ理由・懸念点・ユーザーがASPで確認すべき項目を挙げてください。",
      "案件データにない報酬額・承認率・条件を推測で補わないこと。不明な点は checkItems に入れること。",
      dataBlock("案件", o),
      dataBlock("ユーザー", ctx),
      dataBlock("ルールによる評価（参考）", ruleFit(o, ctx)),
    ].join("\n\n"),
    schema: fitSchema,
    fallback: () => ruleFit(o, ctx),
  });
}
