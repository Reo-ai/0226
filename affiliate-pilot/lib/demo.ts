import { prisma } from "./db";
import { addDays, jstDay } from "./format";
import { dedupeKey } from "./records";

/**
 * 画面の使い方を確かめるためのデモデータ。isDemo = true で保存し、設定画面から一括削除できる。
 * 実在の案件・報酬額と誤解されないよう、架空の名前と「デモ」の表記を付ける。
 */
export async function loadDemo(profileId: string) {
  await clearDemo();
  const channel = await prisma.channelAccount.create({
    data: { profileId, platform: "instagram", accountName: "（デモ）宅トレ記録アカウント", followerCount: 4200, monthlyImpressions: 68000, monthlyPosts: 14, monthlyEngagements: 2600, monthlyProfileVisits: 1900, monthlyClicks: 310, monthlyConversions: 4, niche: "筋トレ", targetAudience: "在宅勤務で運動不足の30代", isDemo: true },
  });
  const offerA = await prisma.affiliateOffer.create({
    data: { name: "（デモ）サンプル案件A：オンラインフィットネス無料体験", category: "筋トレ", commissionAmount: 3000, approvalRate: 0.8, partnershipStatus: "approved", conversionConditions: "（デモ）新規の無料体験申込完了", rejectionConditions: "（デモ）重複・いたずら申込", targetAudience: "運動不足の社会人", approvalTiming: "（デモ）発生から約45日", isDemo: true, lastVerifiedAt: new Date() },
  });
  await prisma.affiliateOffer.create({
    data: { name: "（デモ）サンプル案件B：プロテイン定期便", category: "筋トレ", commissionAmount: 1200, approvalRate: null, partnershipStatus: "candidate", conversionConditions: "（デモ）初回購入", targetAudience: "筋トレ初心者", isDemo: true },
  });
  const draft = await prisma.contentDraft.create({
    data: { platform: "instagram", contentType: "instagram_reel", title: "（デモ）在宅で続く10分トレの台本", body: "【PR】この投稿にはアフィリエイト広告を含みます。\n\n【冒頭2秒のフック】在宅勤務、気づいたら1日500歩…\n（デモの下書きです）", cta: "詳しくはプロフィールのリンクから。", status: "published", generatedBy: "template", affiliateOfferId: offerA.id, isDemo: true },
  });
  const pub = await prisma.publication.create({ data: { contentDraftId: draft.id, platform: "instagram", publishedUrl: "https://example.com/demo-post", publishedAt: addDays(new Date(), -10) } });
  const today = jstDay();
  for (let i = 14; i >= 1; i--) {
    const d = addDays(today, -i);
    const impressions = 1800 + ((i * 397) % 900);
    const clicks = Math.round(impressions * (0.004 + (i % 4) * 0.001));
    const conversions = i % 5 === 0 ? 1 : 0;
    const row = {
      recordDate: d, platform: "instagram", channelAccountId: channel.id, affiliateOfferId: offerA.id, publicationId: pub.id,
      impressions, clicks, conversions, approvedConversions: i > 10 ? conversions : null,
      pendingRevenue: conversions * 3000, confirmedRevenue: i > 10 ? conversions * 3000 : null, paidRevenue: null,
      workMinutes: 60 + (i % 3) * 15, note: "デモ", isDemo: true,
    };
    await prisma.performanceRecord.create({ data: { ...row, dedupeKey: `demo:${dedupeKey(row)}` } });
  }
}

export async function clearDemo() {
  await prisma.$transaction([
    prisma.performanceRecord.deleteMany({ where: { isDemo: true } }),
    prisma.contentDraft.deleteMany({ where: { isDemo: true } }),
    prisma.affiliateOffer.deleteMany({ where: { isDemo: true } }),
    prisma.channelAccount.deleteMany({ where: { isDemo: true } }),
  ]);
}
