import { OFFER_STATUS } from "@/lib/constants";
import { csvResponse, toCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { dateKey } from "@/lib/format";
import { getProfile } from "@/lib/profile";

export const runtime = "nodejs";

/** 案件のCSVエクスポート（インポートと同じ見出し） */
export async function GET() {
  if (!(await getProfile())) return new Response("Unauthorized", { status: 401 });
  const offers = await prisma.affiliateOffer.findMany({ orderBy: { name: "asc" }, include: { network: true } });
  const body = toCsv(
    ["ASP名", "案件名", "ジャンル", "商品URL", "報酬単価", "成果条件", "否認条件", "承認率", "提携状態", "対象ユーザー", "承認時期", "最終確認日", "サンプル"],
    offers.map((o) => [
      o.network?.name ?? "", o.name, o.category, o.offerUrl, o.commissionAmount, o.conversionConditions, o.rejectionConditions,
      o.approvalRate === null ? null : Math.round(o.approvalRate * 1000) / 10, OFFER_STATUS[o.partnershipStatus] ?? o.partnershipStatus,
      o.targetAudience, o.approvalTiming, o.lastVerifiedAt ? dateKey(o.lastVerifiedAt) : "", o.isDemo ? "サンプル" : "",
    ]),
  );
  return csvResponse(`affiliate-pilot-offers-${dateKey(new Date())}.csv`, body);
}
