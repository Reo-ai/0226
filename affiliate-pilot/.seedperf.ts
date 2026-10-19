import { prisma } from "./lib/db";
const p = await prisma.profile.create({ data: { experienceLevel: "none", dailyWorkMinutes: 90, monthlyBudget: 0, preferredPlatforms: '["instagram"]', onboardedAt: new Date(Date.now() - 400 * 86400000) } });
await prisma.goal.create({ data: { profileId: p.id, targetMonthlyRevenue: 50000, targetDate: new Date(Date.now() + 30 * 86400000) } });
const offers = [];
for (let i = 0; i < 20; i++) offers.push(await prisma.affiliateOffer.create({ data: { name: `案件${i}`, commissionAmount: 1000 + i * 100, approvalRate: 0.8 } }));
const rows = [];
const plats = ["blog", "instagram", "x", "tiktok", "youtube"];
for (let d = 0; d < 400; d++) for (const pl of plats) for (let o = 0; o < 3; o++) {
  const date = new Date(Date.now() - d * 86400000); date.setUTCHours(15, 0, 0, 0);
  rows.push({ dedupeKey: `${d}|${pl}|${o}`, recordDate: date, platform: pl, affiliateOfferId: offers[(d + o) % 20].id, impressions: 1000 + (d * 7) % 900, clicks: 10 + (d * 3) % 40, conversions: d % 4 === 0 ? 1 : 0, approvedConversions: d % 8 === 0 ? 1 : null, pendingRevenue: d % 4 === 0 ? 3000 : 0, confirmedRevenue: d % 8 === 0 ? 3000 : null, paidRevenue: null, workMinutes: 30 });
}
await prisma.performanceRecord.createMany({ data: rows });
console.log("records", rows.length);
